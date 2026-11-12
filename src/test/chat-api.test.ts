import { afterEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/api/chat";

type Handler = (input: { request: Request }) => Promise<Response>;

const POST = (Route.options as { server?: { handlers?: { POST?: Handler } } }).server?.handlers
  ?.POST;

function post(body: unknown): Promise<Response> {
  return POST!({
    request: new Request("http://localhost:8080/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
}

function stubNoProvider() {
  vi.stubEnv("JARVIS_AI_URL", "");
  vi.stubEnv("JARVIS_AI_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/chat request flow", () => {
  it("rejects malformed request bodies with 400 and a safe message", async () => {
    const response = await post({ messages: [] });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request" });
  });

  it("rejects unknown profiles with 400 and a safe message", async () => {
    const response = await post({
      person: "stranger",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error?: string };
    expect(payload.error).toBe("Invalid request");
  });

  it("returns 503 with a safe message when no AI provider is configured", async () => {
    stubNoProvider();
    const response = await post({
      person: "abhishek",
      messages: [{ role: "user", content: "What are your skills?" }],
    });
    expect(response.status).toBe(503);
    const payload = (await response.json()) as { error?: string };
    expect(Object.keys(payload)).toEqual(["error"]);
    expect(payload.error).toMatch(/^AI is not configured\. Set JARVIS_AI_URL and JARVIS_AI_KEY/);
  });

  it("never reports configuration errors for valid profiles without a key", async () => {
    stubNoProvider();
    const response = await post({
      person: "ammu",
      messages: [{ role: "user", content: "Introduce this portfolio to a visitor." }],
    });
    expect(response.status).toBe(503);
    const payload = (await response.json()) as { error?: string };
    expect(payload.error).toMatch(/^AI is not configured/);
    // Lovable AI is paused; the response must not point operators at it.
    expect(payload.error?.toLowerCase()).not.toContain("lovable");
  });

  it("uses the JARVIS personal AI gateway when configured and streams its text", async () => {
    const key = "jrv_0123456789ab_" + "A".repeat(43);
    vi.stubEnv("JARVIS_AI_URL", "https://jarvis.example.test/v1/");
    vi.stubEnv("JARVIS_AI_KEY", key);
    vi.stubEnv("OPENAI_API_KEY", "sk-should-not-be-used");
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const events = [
        { choices: [{ delta: { role: "assistant" } }] },
        { choices: [{ delta: { content: "Ammu builds " } }] },
        { choices: [{ delta: { content: "dashboards." } }] },
      ];
      const body =
        events
          .map(
            (event) => `data: ${JSON.stringify(event)}

`,
          )
          .join("") + "data: [DONE]";
      return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
    });

    const response = await post({
      person: "ammu",
      messages: [{ role: "user", content: "What does Ammu build?" }],
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Ammu builds dashboards.");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://jarvis.example.test/v1/chat/completions");
    expect((calls[0]!.init.headers as Record<string, string>)["Authorization"]).toBe(
      `Bearer ${key}`,
    );
    const sent = JSON.parse(String(calls[0]!.init.body)) as {
      model: string;
      stream: boolean;
      messages: Array<{ role: string; content: string }>;
    };
    expect(sent.model).toBe("jarvis");
    // Profile scope travels in both the header and the body for gateway enforcement.
    expect((calls[0]!.init.headers as Record<string, string>)["X-Jarvis-Profile"]).toBe("ammu");
    expect((sent as unknown as { jarvis_profile?: string }).jarvis_profile).toBe("ammu");
    expect(sent.stream).toBe(true);
    expect(sent.messages[0]!.role).toBe("system");
    expect(sent.messages[0]!.content).toContain("Dudala Amulya");
    expect(sent.messages.at(-1)).toEqual({ role: "user", content: "What does Ammu build?" });
  });


  it("grounds Abhishek chat in the currently published CMS document", async () => {
    const key = "jrv_0123456789ab_" + "C".repeat(43);
    vi.stubEnv("JARVIS_AI_URL", "https://jarvis.example.test");
    vi.stubEnv("JARVIS_AI_KEY", key);
    const calls: Array<{ init: RequestInit }> = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      calls.push({ init });
      return new Response("data: [DONE]\\n\\n", {
        headers: { "Content-Type": "text/event-stream" },
      });
    });

    const response = await post({
      person: "abhishek",
      _publishedContent: {
        basics: { headline: "Owner-published engineering headline" },
        skills: [{ cat: "Owner Skills", desc: "Approved CMS skills", items: ["Rust", "PostgreSQL"] }],
      },
      messages: [{ role: "user", content: "What skills are listed?" }],
    });
    expect(response.status).toBe(200);
    const sent = JSON.parse(String(calls[0]!.init.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(sent.messages[0]!.content).toContain("Owner-published engineering headline");
    expect(sent.messages[0]!.content).toContain("PostgreSQL");
  });

  it("merges published CMS content into only the selected profile's JARVIS knowledge", async () => {
    const key = "jrv_0123456789ab_" + "D".repeat(43);
    vi.stubEnv("JARVIS_AI_URL", "https://jarvis.example.test");
    vi.stubEnv("JARVIS_AI_KEY", key);
    const calls: Array<{ init: RequestInit }> = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      calls.push({ init });
      return new Response("data: [DONE]\\n\\n", {
        headers: { "Content-Type": "text/event-stream" },
      });
    });

    const response = await post({
      person: "ammu",
      _publishedContent: {
        basics: { headline: "Ammu owner-approved headline" },
        skills: [{ cat: "Analytics", desc: "Approved", items: ["Power BI Custom"] }],
      },
      messages: [{ role: "user", content: "What skills do you use?" }],
    });
    expect(response.status).toBe(200);
    const sent = JSON.parse(String(calls[0]!.init.body)) as {
      messages: Array<{ role: string; content: string }>;
      jarvis_profile: string;
    };
    expect(sent.jarvis_profile).toBe("ammu");
    expect(sent.messages[0]!.content).toContain("Ammu owner-approved headline");
    expect(sent.messages[0]!.content).toContain("Power BI Custom");
    expect(sent.messages[0]!.content).not.toContain("Owner-published engineering headline");
  });

  it("maps a rejected JARVIS key to a safe 401 message", async () => {
    vi.stubEnv("JARVIS_AI_URL", "https://jarvis.example.test");
    vi.stubEnv("JARVIS_AI_KEY", "jrv_0123456789ab_" + "B".repeat(43));
    vi.stubGlobal("fetch", async () => new Response('{"error":{"message":"x"}}', { status: 401 }));
    const response = await post({ person: "sai", messages: [{ role: "user", content: "Hi" }] });
    expect(response.status).toBe(401);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toMatch(/rejected its server API key/);
    expect(payload.error).not.toContain("jrv_");
  });
});
