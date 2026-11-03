import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SYSTEM_PROMPT } from "@/lib/portfolio-chat";
import { getPersonPortfolio } from "@/lib/person-portfolios";
import { buildRelevantProfileKnowledge } from "@/lib/portfolio-knowledge";

const body = z.object({
  person: z.enum(["abhishek", "ammu", "bava", "sai"]).optional(),
  mode: z.enum(["chat", "intro"]).optional(),
  page: z.string().max(160).optional(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) }))
    .min(1)
    .max(30),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Enforce a transport limit before parsing JSON to avoid oversized request bodies.
        const contentLength = request.headers.get("content-length");
        if (contentLength !== null) {
          if (!/^\\d+$/.test(contentLength)) {
            return Response.json({ error: "Invalid request length" }, { status: 400 });
          }
          if (!Number.isSafeInteger(Number(contentLength)) || Number(contentLength) > 70 * 1024) {
            return Response.json({ error: "Request body too large" }, { status: 413 });
          }
        }
        const parsed = body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

        const profile = parsed.data.person && parsed.data.person !== "abhishek"
          ? getPersonPortfolio(parsed.data.person)
          : undefined;
        if (parsed.data.person && parsed.data.person !== "abhishek" && !profile) {
          return Response.json({ error: "Unknown portfolio" }, { status: 400 });
        }

        const profilePrompt = profile
          ? [
              `You are the portfolio assistant for ${profile.name} (${profile.nickname}). Answer visitors' questions in a friendly, concise way (under 150 words) using ONLY the verified portfolio facts below. Never invent employers, dates, metrics, credentials, links, personal details or project details. If a detail is marked to be confirmed or resume pending, say so clearly. Use the current verified profile data below as the source of truth for each request. The Bava profile now contains Anjini Kumar’s resume-based details; do not treat it as a demo profile. Do not ask for sensitive personal information. Never use markdown link syntax — write plain emails and URLs.`,
              `CURRENT PAGE CONTEXT: ${parsed.data.page ?? "not provided"}`,
              parsed.data.mode === "intro"
                ? "Create a warm, natural spoken AI introduction of about 90–130 words using the verified profile facts. Introduce professional focus, education, strongest skills, experience, and one or two projects. Make clear this is an AI presenting the portfolio, not the person or a cloned voice. Do not invent facts."
                : "Answer as a concise, friendly portfolio AI assistant using only the verified facts below. If information is missing, say so.",
              "CURRENT VERIFIED PORTFOLIO DATA (generated from the profile source of truth on every request):",
              buildRelevantProfileKnowledge(
                profile,
                parsed.data.messages.filter((message) => message.role === "user").at(-1)?.content ?? "",
                parsed.data.mode === "intro" ? "intro" : "chat",
              ),
            ].join("\n")
          : parsed.data.mode === "intro"
            ? `${SYSTEM_PROMPT}\n\nCreate a warm, natural spoken AI introduction of about 90–130 words using only the verified Abhishek portfolio facts above. Introduce professional focus, education, experience, strongest skills, and one or two projects. Make clear this is an AI presenting the portfolio, not Abhishek himself or a cloned voice. Current page: ${parsed.data.page ?? "not provided"}.`
            : `${SYSTEM_PROMPT}\n\nCurrent page context: ${parsed.data.page ?? "not provided"}. Use the verified portfolio facts above as the source of truth for this response.`;

        // OpenAI is the only active AI provider for now. Lovable AI is paused.
        const openAiKey = process.env["OPENAI_API_KEY"];
        if (!openAiKey) {
          return Response.json(
            { error: "AI is not configured. Add OPENAI_API_KEY to .env.local for local development or to the deployment's server-side environment secrets, then restart or redeploy." },
            { status: 503 },
          );
        }

        const endpoint = "https://api.openai.com/v1/responses";
        const key = openAiKey;
        const model = "gpt-4.1-mini";
        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), 45_000);
        const cleanupRequest = () => {
          clearTimeout(timeout);
          request.signal.removeEventListener("abort", onRequestAbort);
        };
        const onRequestAbort = () => {
          abortController.abort();
          cleanupRequest();
        };
        request.signal.addEventListener("abort", onRequestAbort, { once: true });
        if (request.signal.aborted) onRequestAbort();

        let upstream: Response;
        try {
          upstream = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model,
              stream: true,
              store: false,
              instructions: profilePrompt,
              input: parsed.data.messages.map((message) => ({
                role: message.role,
                content: message.content,
              })),
            }),
            signal: abortController.signal,
          });
        } catch (error) {
          cleanupRequest();
          const message = error instanceof Error && error.name === "AbortError"
            ? "The AI request timed out. Please try again."
            : "Could not connect to the AI service. Please try again shortly.";
          return Response.json({ error: message }, { status: 502 });
        }

        if (!upstream.ok || !upstream.body) {
          cleanupRequest();
          const status = upstream.status || 502;
          const upstreamText = await upstream.text().catch(() => "");
          // Avoid returning raw provider errors that may contain implementation details.
          const message = status === 401 || status === 403
            ? "The AI provider rejected its server API key. Check the deployment secret and provider access."
            : status === 429
              ? "The AI service is rate-limited or out of available quota. Check the API billing and usage limits."
              : "The AI service could not complete the request. Please try again.";
          console.error("Portfolio chat provider error", { provider: "openai", status, detail: upstreamText.slice(0, 500) });
          return Response.json({ error: message }, { status: status >= 400 && status < 600 ? status : 502 });
        }

        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";
        const stream = upstream.body.pipeThrough(
          new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
              buffer += decoder.decode(chunk, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";
              for (const line of lines) {
                if (!line.startsWith("data:")) continue;
                const data = line.slice(5).trim();
                if (!data || data === "[DONE]") continue;
                try {
                  const event = JSON.parse(data);
                  if (event.type === "response.output_text.delta" && event.delta) {
                    controller.enqueue(encoder.encode(event.delta));
                  } else if (event.type === "error" || event.type === "response.failed") {
                    const providerError = event.error ?? event.response?.error ?? {};
                    const code = providerError.code ?? providerError.type;
                    console.error("Portfolio chat stream error", {
                      provider: "openai",
                      code,
                      detail: JSON.stringify(event).slice(0, 500),
                    });
                    // A 200 SSE response can still fail after streaming starts. Surface a
                    // useful message instead of returning an empty body that looks successful.
                    const friendlyError = code === "credit_balance_exhausted" || code === "insufficient_quota"
                      ? "Live AI is unavailable because the OpenAI API project has no credits remaining. Add API credits in the OpenAI Platform billing settings, then try again. Your portfolio's offline answers are still available."
                      : code === "rate_limit_exceeded"
                        ? "Live AI is temporarily rate-limited. Please wait a moment and try again."
                        : "Live AI could not complete this response. Please try again later.";
                    controller.enqueue(encoder.encode("\n\n" + friendlyError));
                    controller.terminate();
                  }
                } catch {
                  // Ignore non-JSON SSE messages.
                }
              }
            },
            flush() {
              cleanupRequest();
            },
          }),
        );

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
