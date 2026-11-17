// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MemoryR2 } from "./helpers/memory-r2";

// The SSR entry cannot boot under Vitest; the manifest is answered by the Worker before SSR.
vi.mock("@tanstack/react-start/server-entry", () => ({
  default: {
    fetch: () => new Response("<html></html>", { headers: { "content-type": "text/html" } }),
  },
}));
const { default: server } = await import("@/server");

// The vendored central contract is the single source of truth; zod converts the JSON Schema.
const schema = z.fromJSONSchema(
  JSON.parse(
    readFileSync("contracts/asaa-ecosystem/v1/service-manifest.schema.json", "utf8"),
  ) as Parameters<typeof z.fromJSONSchema>[0],
);

const URL_ = "https://portfolio.test/.well-known/asaa-service";
const JARVIS_KEY = `jrv_0123456789ab_${"K".repeat(43)}`;

describe("ASAA service manifest (/.well-known/asaa-service)", () => {
  it("is valid against the v1 contract, unauthenticated and not cacheable", async () => {
    const response = await server.fetch(
      new Request(URL_),
      { ENVIRONMENT: "production", RESUME_BUCKET: new MemoryR2() },
      {},
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body: unknown = await response.json();
    expect(schema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      schema: "asaa.service-manifest.v1",
      service: "portfolio",
      project: "PORTFOLIO",
      environment: "production",
      status: "ok",
      checks: { storage: "ok", ai: "disabled" },
      contracts: { serviceManifest: "v1" },
    });
    expect((body as { capabilities: string[] }).capabilities).toEqual(
      expect.arrayContaining([
        "portfolio.profiles",
        "portfolio.published-feeds",
        "ai.chat-consumer",
      ]),
    );
  });

  it("reports storage disabled without a binding and degrades the overall status", async () => {
    const body = (await (await server.fetch(new Request(URL_), {}, {})).json()) as {
      status: string;
      checks: Record<string, string>;
    };
    expect(schema.safeParse(body).success).toBe(true);
    expect(body.checks["storage"]).toBe("disabled");
    expect(body.status).toBe("degraded");
  });

  it("reports storage down when the bucket probe fails", async () => {
    const broken = {
      get: async () => {
        throw new Error("r2 unavailable");
      },
      put: async () => undefined,
      delete: async () => undefined,
    };
    const body = (await (
      await server.fetch(new Request(URL_), { RESUME_BUCKET: broken }, {})
    ).json()) as { status: string; checks: Record<string, string> };
    expect(schema.safeParse(body).success).toBe(true);
    expect(body.checks["storage"]).toBe("down");
    expect(body.status).toBe("degraded");
  });

  it("reports ai ok from configuration only, without calling the gateway or leaking settings", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const response = await server.fetch(
        new Request(URL_),
        {
          RESUME_BUCKET: new MemoryR2(),
          JARVIS_AI_URL: "https://jarvis.example.test",
          JARVIS_AI_KEY: JARVIS_KEY,
        },
        {},
      );
      const text = await response.text();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(JSON.parse(text).checks.ai).toBe("ok");
      expect(text).not.toContain(JARVIS_KEY);
      expect(text).not.toContain("jarvis.example.test");
      expect(text).not.toMatch(/https?:\/\//);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("answers HEAD and rejects other methods", async () => {
    const env = { RESUME_BUCKET: new MemoryR2() };
    expect((await server.fetch(new Request(URL_, { method: "HEAD" }), env, {})).status).toBe(200);
    const post = await server.fetch(new Request(URL_, { method: "POST" }), env, {});
    // Non-GET/HEAD requests fall through to SSR (mocked as HTML here), never the manifest.
    expect(post.headers.get("content-type") ?? "").toContain("text/html");
  });
});
