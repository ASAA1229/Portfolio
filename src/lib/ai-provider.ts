/**
 * Server-side AI provider selection for portfolio routes.
 *
 * Preference order:
 *   1. JARVIS — the owner's personal AI gateway (OpenAI-compatible /v1/chat/completions),
 *      configured with JARVIS_AI_URL + JARVIS_AI_KEY.
 *   2. OpenAI Responses API — only when OPENAI_API_KEY is set.
 *   3. None — callers return 503 and the UI uses its offline, profile-grounded answers.
 *
 * Keys are read from server-side environment only and never sent to the browser.
 */

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiProvider {
  name: "jarvis" | "openai";
  endpoint: string;
  headers: Record<string, string>;
  body(instructions: string, messages: ChatTurn[]): Record<string, unknown>;
  /** Extract assistant text from one parsed SSE event; undefined when the event carries none. */
  extractDelta(event: unknown): string | undefined;
  /** Provider-reported stream error code, if this event signals failure. */
  streamErrorCode(event: unknown): string | undefined;
}

type Env = Record<string, string | undefined>;

const JARVIS_KEY_PATTERN = /^jrv_[a-f0-9]{12}_[A-Za-z0-9_-]{43}$/;

/** Accept https anywhere, plain http only for loopback development. */
export function normalizeJarvisUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) return null;
  return url.toString().replace(/\/+$/, "").replace(/\/v1$/, "");
}

export function resolveAiProvider(env: Env): AiProvider | null {
  const jarvisUrl = normalizeJarvisUrl(env["JARVIS_AI_URL"]);
  const jarvisKey = env["JARVIS_AI_KEY"];
  if (jarvisUrl && jarvisKey && JARVIS_KEY_PATTERN.test(jarvisKey)) {
    return {
      name: "jarvis",
      endpoint: `${jarvisUrl}/v1/chat/completions`,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jarvisKey}` },
      body: (instructions, messages) => ({
        model: "jarvis",
        stream: true,
        messages: [{ role: "system", content: instructions }, ...messages],
      }),
      extractDelta: (event) => {
        const delta = (event as { choices?: Array<{ delta?: { content?: unknown } }> })
          ?.choices?.[0]?.delta?.content;
        return typeof delta === "string" && delta ? delta : undefined;
      },
      streamErrorCode: (event) => {
        const error = (event as { error?: { code?: unknown; type?: unknown } })?.error;
        if (!error) return undefined;
        return String(error.code ?? error.type ?? "stream_error");
      },
    };
  }

  const openAiKey = env["OPENAI_API_KEY"];
  if (openAiKey) {
    return {
      name: "openai",
      endpoint: "https://api.openai.com/v1/responses",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
      body: (instructions, messages) => ({
        model: "gpt-4.1-mini",
        stream: true,
        store: false,
        instructions,
        input: messages,
      }),
      extractDelta: (event) => {
        const typed = event as { type?: unknown; delta?: unknown };
        return typed?.type === "response.output_text.delta" &&
          typeof typed.delta === "string" &&
          typed.delta
          ? typed.delta
          : undefined;
      },
      streamErrorCode: (event) => {
        const typed = event as {
          type?: unknown;
          error?: { code?: unknown; type?: unknown };
          response?: { error?: { code?: unknown; type?: unknown } };
        };
        if (typed?.type !== "error" && typed?.type !== "response.failed") return undefined;
        const providerError = typed.error ?? typed.response?.error ?? {};
        return String(providerError.code ?? providerError.type ?? "stream_error");
      },
    };
  }
  return null;
}

export const AI_NOT_CONFIGURED_MESSAGE =
  "AI is not configured. Set JARVIS_AI_URL and JARVIS_AI_KEY (your JARVIS personal AI gateway), or OPENAI_API_KEY, in the server-side environment, then restart or redeploy.";
