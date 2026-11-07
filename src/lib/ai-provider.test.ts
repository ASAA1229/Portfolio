import { describe, expect, it } from "vitest";
import { normalizeJarvisUrl, resolveAiProvider } from "@/lib/ai-provider";

const jarvisKey = "jrv_0123456789ab_" + "x".repeat(43);

describe("AI provider selection", () => {
  it("prefers JARVIS over OpenAI when both are configured", () => {
    const provider = resolveAiProvider({
      JARVIS_AI_URL: "https://ai.example.test",
      JARVIS_AI_KEY: jarvisKey,
      OPENAI_API_KEY: "sk-test",
    });
    expect(provider?.name).toBe("jarvis");
    expect(provider?.endpoint).toBe("https://ai.example.test/v1/chat/completions");
  });

  it("falls back to OpenAI, then to no provider", () => {
    // A paid provider is never selected silently (PORT-US-037).
    expect(resolveAiProvider({ OPENAI_API_KEY: "sk-test" })).toBeNull();
    expect(
      resolveAiProvider({ OPENAI_API_KEY: "sk-test", PORTFOLIO_AI_ALLOW_PAID_FALLBACK: "true" })
        ?.name,
    ).toBe("openai");
    expect(resolveAiProvider({})).toBeNull();
  });

  it("ignores malformed JARVIS keys and insecure remote URLs", () => {
    expect(
      resolveAiProvider({ JARVIS_AI_URL: "https://ai.example.test", JARVIS_AI_KEY: "sk-wrong" }),
    ).toBeNull();
    expect(normalizeJarvisUrl("http://ai.example.test")).toBeNull();
    expect(normalizeJarvisUrl("https://user:pw@ai.example.test")).toBeNull();
    expect(normalizeJarvisUrl("http://127.0.0.1:3100/v1/")).toBe("http://127.0.0.1:3100");
  });

  it("extracts only text deltas from JARVIS stream events", () => {
    const provider = resolveAiProvider({
      JARVIS_AI_URL: "https://ai.example.test",
      JARVIS_AI_KEY: jarvisKey,
    })!;
    expect(provider.extractDelta({ choices: [{ delta: { content: "hi" } }] })).toBe("hi");
    expect(provider.extractDelta({ choices: [{ delta: { role: "assistant" } }] })).toBeUndefined();
    expect(provider.streamErrorCode({ error: { code: "rate_limited" } })).toBe("rate_limited");
  });
});
