/**
 * Server-side AI provider selection for portfolio routes.
 *
 * Preference order:
 *   1. JARVIS — the owner's personal AI gateway (OpenAI-compatible /v1/chat/completions),
 *      configured with JARVIS_AI_URL + JARVIS_AI_KEY.
 *   2. OpenAI Responses API — a paid provider, used only when the owner explicitly
 *      opts in with PORTFOLIO_AI_ALLOW_PAID_FALLBACK=true AND sets OPENAI_API_KEY
 *      (PORT-US-037: no paid provider is ever selected silently).
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
  /**
   * Request headers; JARVIS also receives the profile scope (X-Jarvis-Profile) and the correlation id
   * (X-Request-ID) when one is supplied.
   */
  headers(profileId: string, requestId?: string): Record<string, string>;
  body(instructions: string, messages: ChatTurn[], profileId: string): Record<string, unknown>;
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

const AI_ENV_KEYS = [
  "JARVIS_AI_URL",
  "JARVIS_AI_KEY",
  "OPENAI_API_KEY",
  "PORTFOLIO_AI_ALLOW_PAID_FALLBACK",
  "JARVIS_AI_ENABLED",
  "PORTFOLIO_AI_DAILY_LIMIT",
] as const;

/**
 * Collect the AI settings from Worker bindings first, then process.env (the same precedence the rest of
 * the server uses for secrets), so callers holding the Worker env do not depend on process.env population.
 */
export function aiEnvFrom(bindings: unknown, processEnv?: Env): Env {
  const source = (bindings && typeof bindings === "object" ? bindings : {}) as Record<
    string,
    unknown
  >;
  const out: Env = {};
  for (const key of AI_ENV_KEYS) {
    const bound = source[key];
    out[key] = typeof bound === "string" ? bound : processEnv?.[key];
  }
  return out;
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

/** Reuse a valid incoming X-Request-ID (ASAA correlation contract), otherwise generate a new one. */
export function correlationRequestId(incoming: string | null | undefined): string {
  return incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID();
}

export function resolveAiProvider(env: Env): AiProvider | null {
  const jarvisUrl = normalizeJarvisUrl(env["JARVIS_AI_URL"]);
  const jarvisKey = env["JARVIS_AI_KEY"];
  // The JARVIS gateway is optional and independently switchable: JARVIS_AI_ENABLED=false turns it off
  // without removing its settings. It is never used unless the URL and a valid key are configured.
  const jarvisEnabled = env["JARVIS_AI_ENABLED"] !== "false";
  if (jarvisEnabled && jarvisUrl && jarvisKey && JARVIS_KEY_PATTERN.test(jarvisKey)) {
    return {
      name: "jarvis",
      endpoint: `${jarvisUrl}/v1/chat/completions`,
      // The gateway enforces the site key's allowed profiles from both the header and
      // the body field, so one site key cannot be used to answer as another profile.
      headers: (profileId, requestId) => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${jarvisKey}`,
        "X-Jarvis-Profile": profileId,
        ...(requestId ? { "X-Request-ID": requestId } : {}),
      }),
      body: (instructions, messages, profileId) => ({
        model: "jarvis",
        stream: true,
        jarvis_profile: profileId,
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
  const paidFallbackApproved = env["PORTFOLIO_AI_ALLOW_PAID_FALLBACK"] === "true";
  if (openAiKey && paidFallbackApproved) {
    return {
      name: "openai",
      endpoint: "https://api.openai.com/v1/responses",
      headers: () => ({ "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` }),
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

/** Safe, non-secret description of the active provider for health/admin views. */
export function describeAiProvider(env: Env): {
  provider: "jarvis" | "openai" | "offline";
  paidFallbackApproved: boolean;
} {
  const provider = resolveAiProvider(env);
  return {
    provider: provider?.name ?? "offline",
    paidFallbackApproved: env["PORTFOLIO_AI_ALLOW_PAID_FALLBACK"] === "true",
  };
}

/**
 * Public response when no provider is active. Deliberately generic: setting names and provider details
 * belong in the owner-only monitoring view, never in a response a visitor can read.
 */
export const AI_NOT_CONFIGURED_MESSAGE =
  "Live AI is not available right now. Showing answers from the published profile instead.";
