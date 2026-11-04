import { afterEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/api/chat";

type Handler = (input: { request: Request }) => Promise<Response>;

const POST = (Route.options as { server?: { handlers?: { POST?: Handler } } }).server?.handlers?.POST;

function post(body: unknown): Promise<Response> {
  return POST!({
    request: new Request("http://localhost:8080/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
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

  it("returns 503 with a safe message when LOVABLE_API_KEY is missing", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "");
    const response = await post({
      person: "abhishek",
      messages: [{ role: "user", content: "What are your skills?" }],
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "AI not configured" });
  });

  it("never reports configuration errors for valid profiles without a key", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "");
    const response = await post({
      person: "ammu",
      messages: [{ role: "user", content: "Introduce this portfolio to a visitor." }],
    });
    const payload = (await response.json()) as { error?: string };
    expect(payload.error).toBe("AI not configured");
    expect(payload.error?.toLowerCase()).not.toContain("lovable");
  });
});
