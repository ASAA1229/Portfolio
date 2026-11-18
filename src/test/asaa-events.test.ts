// @vitest-environment node
//
// MOCK ASAA: the events endpoint is an in-test fetch stub. Nothing here talks to a real ASAA service.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  buildEnvelope,
  classifyAdminEvent,
  enqueueEvent,
  eventsCheck,
  flushEvents,
  OUTBOX_KEY,
  OUTBOX_MAX,
  resetEventThrottles,
  resolveEventsConfig,
} from "@/lib/asaa-events";
import { resetNamedLimiters } from "@/lib/login-limiter";
import { MemoryR2 } from "./helpers/memory-r2";

vi.mock("@tanstack/react-start/server-entry", () => ({
  default: {
    fetch: () => new Response("<html></html>", { headers: { "content-type": "text/html" } }),
  },
}));
const { default: server } = await import("@/server");

const envelopeSchema = z.fromJSONSchema(
  JSON.parse(
    readFileSync("contracts/asaa-ecosystem/v1/event-envelope.schema.json", "utf8"),
  ) as Parameters<typeof z.fromJSONSchema>[0],
);
const manifestSchema = z.fromJSONSchema(
  JSON.parse(
    readFileSync("contracts/asaa-ecosystem/v1/service-manifest.schema.json", "utf8"),
  ) as Parameters<typeof z.fromJSONSchema>[0],
);

const EVENTS_ENV = {
  ASAA_EVENTS_URL: "http://127.0.0.1:8101",
  ASAA_EVENTS_TOKEN: "mock-events-token-not-real",
  ASAA_ORG_ID: "org-123",
};
const config = resolveEventsConfig(EVENTS_ENV)!;
const ORIGIN = "http://portfolio.test";

type Received = { url: string; headers: Headers; body: Record<string, unknown> };
let received: Received[];
let respond: (call: Received) => Response | Promise<Response>;

beforeEach(() => {
  resetEventThrottles();
  resetNamedLimiters();
  received = [];
  respond = () => new Response(null, { status: 201 });
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const call: Received = {
      url: String(url),
      headers: new Headers(init.headers),
      body: JSON.parse(String(init.body)) as Record<string, unknown>,
    };
    received.push(call);
    return respond(call);
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const envelope = (type = "portfolio.admin.login") =>
  buildEnvelope(config, { type, severity: "info", data: { status: 200 } });

describe("configuration", () => {
  it("is disabled unless URL, token and org id are all set", () => {
    for (const missing of Object.keys(EVENTS_ENV)) {
      expect(resolveEventsConfig({ ...EVENTS_ENV, [missing]: "" })).toBeNull();
    }
    expect(resolveEventsConfig({})).toBeNull();
    expect(resolveEventsConfig(EVENTS_ENV)).not.toBeNull();
  });

  it("requires https unless loopback", () => {
    expect(
      resolveEventsConfig({ ...EVENTS_ENV, ASAA_EVENTS_URL: "http://asaa.example.test" }),
    ).toBeNull();
    expect(
      resolveEventsConfig({ ...EVENTS_ENV, ASAA_EVENTS_URL: "https://asaa.example.test" }),
    ).not.toBeNull();
    expect(
      resolveEventsConfig({ ...EVENTS_ENV, ASAA_EVENTS_URL: "http://localhost:8101/" }),
    ).not.toBeNull();
  });
});

describe("classification and envelope", () => {
  it.each([
    ["POST", "/api/admin/login", 200, "portfolio.admin.login", "info"],
    ["POST", "/api/admin/login", 401, "portfolio.admin.login-failed", "warning"],
    ["POST", "/api/admin/logout", 200, "portfolio.admin.logout", "info"],
    ["POST", "/api/admin/logout-all", 200, "portfolio.admin.logout-all", "warning"],
    ["POST", "/api/admin/resumes", 201, "portfolio.admin.resume-uploaded", "info"],
    [
      "POST",
      "/api/admin/resumes/0b0c8f6e-1a2b-4c3d-8e9f-0a1b2c3d4e5f/publish",
      200,
      "portfolio.admin.resume-published",
      "info",
    ],
    [
      "DELETE",
      "/api/admin/resumes/0b0c8f6e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
      200,
      "portfolio.admin.resume-deleted",
      "warning",
    ],
    ["POST", "/api/admin/images", 201, "portfolio.admin.image-uploaded", "info"],
    ["POST", "/api/admin/content/publish", 200, "portfolio.admin.content-published", "info"],
    ["POST", "/api/admin/content/rollback", 200, "portfolio.admin.content-rolled-back", "info"],
    ["POST", "/api/admin/personas/publish", 200, "portfolio.admin.persona-published", "info"],
    ["POST", "/api/admin/backup/restore", 200, "portfolio.admin.backup-restored", "warning"],
    ["POST", "/api/admin/content/publish", 400, "portfolio.admin.content-published", "warning"],
  ])("%s %s (%i) -> %s", (method, path, status, type, severity) => {
    const result = classifyAdminEvent({ method, path, status })!;
    expect(result.type).toBe(type);
    expect(result.severity).toBe(severity);
    const built = buildEnvelope(config, { type: result.type, severity: result.severity, data: {} });
    expect(envelopeSchema.safeParse(built).success).toBe(true);
  });

  it("ignores reads and session renewal", () => {
    expect(
      classifyAdminEvent({ method: "GET", path: "/api/admin/resumes", status: 200 }),
    ).toBeNull();
    expect(
      classifyAdminEvent({ method: "POST", path: "/api/admin/session/renew", status: 200 }),
    ).toBeNull();
    expect(
      classifyAdminEvent({ method: "GET", path: "/api/published-resumes", status: 200 }),
    ).toBeNull();
  });

  it("builds a schema-valid envelope and only keeps a valid correlation id", () => {
    const valid = buildEnvelope(config, {
      type: "portfolio.admin.login",
      severity: "info",
      correlationId: "req-12345678",
      subject: "resume/abc",
      data: {},
    });
    expect(valid.correlationId).toBe("req-12345678");
    expect(envelopeSchema.safeParse(valid).success).toBe(true);
    const invalid = buildEnvelope(config, {
      type: "portfolio.admin.login",
      severity: "info",
      correlationId: "bad id!",
      data: {},
    });
    expect(invalid.correlationId).toBeUndefined();
  });
});

describe("outbox delivery (mock ASAA)", () => {
  it("delivers with Bearer auth, X-Request-ID and a schema-valid idempotent envelope", async () => {
    const r2 = new MemoryR2();
    const event = envelope();
    await enqueueEvent(r2, event);
    const result = await flushEvents(r2, config);
    expect(result).toEqual({ delivered: 1, dropped: 0, pending: 0 });
    const call = received[0]!;
    expect(call.url).toBe("http://127.0.0.1:8101/api/v1/integration/events");
    expect(call.headers.get("authorization")).toBe(`Bearer ${EVENTS_ENV.ASAA_EVENTS_TOKEN}`);
    expect(call.headers.get("x-request-id")).toMatch(/^[A-Za-z0-9._-]{8,64}$/);
    expect(call.body["id"]).toBe(event.id);
    expect(envelopeSchema.safeParse(call.body).success).toBe(true);
    expect(JSON.stringify(call.body)).not.toContain(EVENTS_ENV.ASAA_EVENTS_TOKEN);
  });

  it("does not enqueue the same event id twice", async () => {
    const r2 = new MemoryR2();
    const event = envelope();
    await enqueueEvent(r2, event);
    await enqueueEvent(r2, event);
    await flushEvents(r2, config);
    expect(received).toHaveLength(1);
  });

  it("treats 409 as already delivered", async () => {
    respond = () => new Response(null, { status: 409 });
    const r2 = new MemoryR2();
    await enqueueEvent(r2, envelope());
    expect(await flushEvents(r2, config)).toMatchObject({ delivered: 1, pending: 0 });
  });

  it("drops events ASAA rejects as invalid (400/413/422)", async () => {
    respond = () => new Response(null, { status: 422 });
    const r2 = new MemoryR2();
    await enqueueEvent(r2, envelope());
    expect(await flushEvents(r2, config)).toMatchObject({ delivered: 0, dropped: 1, pending: 0 });
  });

  it("keeps events on 5xx or network failure, backs off, and retries later with the same id", async () => {
    const r2 = new MemoryR2();
    const event = envelope();
    await enqueueEvent(r2, event);
    await enqueueEvent(r2, envelope("portfolio.admin.logout"));
    respond = () => new Response(null, { status: 503 });
    const first = await flushEvents(r2, config, { now: 1_000_000 });
    expect(first).toMatchObject({ delivered: 0, pending: 2 });
    expect(received).toHaveLength(1); // the batch stops on the first endpoint failure
    // Still in backoff: nothing is attempted.
    expect((await flushEvents(r2, config, { now: 1_000_100 })).delivered).toBe(0);
    expect(received).toHaveLength(1);
    // After the backoff window both are delivered, the original id unchanged.
    respond = () => new Response(null, { status: 201 });
    const later = await flushEvents(r2, config, { now: 1_000_000 + 3_600_000 });
    expect(later).toMatchObject({ delivered: 2, pending: 0 });
    expect(received.map((call) => call.body["id"])).toContain(event.id);

    received = [];
    await enqueueEvent(r2, envelope());
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(await flushEvents(r2, config)).toMatchObject({ delivered: 0, pending: 1 });
  });

  it("bounds the outbox", async () => {
    const r2 = new MemoryR2();
    for (let i = 0; i < OUTBOX_MAX + 5; i++) await enqueueEvent(r2, envelope());
    const stored = await (await r2.get(OUTBOX_KEY))!.json<{
      entries: unknown[];
      dropped: number;
    }>();
    expect(stored.entries).toHaveLength(OUTBOX_MAX);
    expect(stored.dropped).toBe(5);
    expect(await eventsCheck(r2, config)).toBe("down");
  });

  it("reports delivery health for the manifest", async () => {
    const r2 = new MemoryR2();
    expect(await eventsCheck(r2, null)).toBe("disabled");
    expect(await eventsCheck(r2, config)).toBe("ok");
    await enqueueEvent(r2, envelope());
    respond = () => new Response(null, { status: 500 });
    await flushEvents(r2, config);
    expect(await eventsCheck(r2, config)).toBe("degraded");
  });
});

describe("flood resistance", () => {
  it("evicts routine events before security events when the outbox is full", async () => {
    const r2 = new MemoryR2();
    const security = buildEnvelope(config, {
      type: "portfolio.admin.backup-restored",
      severity: "warning",
      data: {},
    });
    await enqueueEvent(r2, security);
    for (let i = 0; i < OUTBOX_MAX + 50; i++)
      await enqueueEvent(r2, envelope("portfolio.admin.login"));
    const stored = await (await r2.get(OUTBOX_KEY))!.json<{
      entries: { envelope: { id: string } }[];
      dropped: number;
    }>();
    expect(stored.entries).toHaveLength(OUTBOX_MAX);
    expect(stored.entries.some((entry) => entry.envelope.id === security.id)).toBe(true);
  });

  it("evicts the oldest security event only when every entry is a security event", async () => {
    const r2 = new MemoryR2();
    const first = buildEnvelope(config, {
      type: "portfolio.admin.logout-all",
      severity: "warning",
      data: {},
    });
    await enqueueEvent(r2, first);
    for (let i = 0; i < OUTBOX_MAX; i++)
      await enqueueEvent(
        r2,
        buildEnvelope(config, {
          type: "portfolio.admin.logout-all",
          severity: "warning",
          data: {},
        }),
      );
    const stored = await (await r2.get(OUTBOX_KEY))!.json<{
      entries: { envelope: { id: string } }[];
    }>();
    expect(stored.entries).toHaveLength(OUTBOX_MAX);
    expect(stored.entries.some((entry) => entry.envelope.id === first.id)).toBe(false);
  });

  const settleAll = async (pending: Promise<unknown>[]) =>
    void (await Promise.all(pending.splice(0)));

  it("aggregates failed logins per client and never reports throttled attempts", async () => {
    const r2 = new MemoryR2();
    const env = {
      ENVIRONMENT: "test",
      PORTFOLIO_ADMIN_PASSWORD: "test-admin-password",
      PORTFOLIO_ADMIN_SESSION_SECRET: "test-session-secret-with-sufficient-length",
      RESUME_BUCKET: r2,
      ...EVENTS_ENV,
    };
    const pending: Promise<unknown>[] = [];
    const ctx = { waitUntil: (promise: Promise<unknown>) => void pending.push(promise) };
    const statuses: number[] = [];
    for (let i = 0; i < 60; i++) {
      const response = await server.fetch(
        new Request(`${ORIGIN}/api/admin/login`, {
          method: "POST",
          headers: {
            origin: ORIGIN,
            "content-type": "application/json",
            "cf-connecting-ip": "flood-client",
          },
          body: JSON.stringify({ password: "wrong-password-value" }),
        }),
        env,
        ctx,
      );
      statuses.push(response.status);
    }
    await settleAll(pending);
    expect(statuses).toContain(429);
    const failed = received.filter((call) => call.body["type"] === "portfolio.admin.login-failed");
    // 5 real rejections before the lockout: reported at attempt 1 and attempt 5 only.
    expect(failed.map((call) => (call.body["data"] as { attempts: number }).attempts)).toEqual([
      1, 5,
    ]);
    expect(received.length).toBeLessThanOrEqual(2);
  });

  it("does not report transaction-less SSO callbacks at all", async () => {
    const r2 = new MemoryR2();
    const env = {
      ENVIRONMENT: "test",
      PORTFOLIO_ADMIN_SESSION_SECRET: "test-session-secret-with-sufficient-length",
      PORTFOLIO_OIDC_ISSUER: "http://127.0.0.1:8280/realms/asaa",
      PORTFOLIO_OIDC_CLIENT_ID: "portfolio-admin",
      PORTFOLIO_OIDC_CLIENT_SECRET: "mock-secret",
      RESUME_BUCKET: r2,
      ...EVENTS_ENV,
    };
    const pending: Promise<unknown>[] = [];
    const ctx = { waitUntil: (promise: Promise<unknown>) => void pending.push(promise) };
    for (let i = 0; i < 20; i++) {
      await server.fetch(new Request(`${ORIGIN}/api/admin/sso/callback?error=x`), env, ctx);
    }
    await settleAll(pending);
    expect(received).toHaveLength(0);
    expect(await r2.get(OUTBOX_KEY)).toBeNull();
  });

  it("throttles manifest-triggered delivery retries to one per 30 seconds", async () => {
    const r2 = new MemoryR2();
    const env = { ENVIRONMENT: "test", RESUME_BUCKET: r2, ...EVENTS_ENV };
    await enqueueEvent(r2, envelope());
    respond = () => new Response(null, { status: 201 });
    const pending: Promise<unknown>[] = [];
    const ctx = { waitUntil: (promise: Promise<unknown>) => void pending.push(promise) };
    for (let i = 0; i < 10; i++) {
      await server.fetch(new Request(`${ORIGIN}/.well-known/asaa-service`), env, ctx);
    }
    await settleAll(pending);
    expect(received).toHaveLength(1); // delivered once; later probes within 30 s did not flush
    await enqueueEvent(r2, envelope("portfolio.admin.logout"));
    for (let i = 0; i < 5; i++) {
      await server.fetch(new Request(`${ORIGIN}/.well-known/asaa-service`), env, ctx);
    }
    await settleAll(pending);
    expect(received).toHaveLength(1); // still inside the 30 s window
  });
});

describe("producer wired into the Worker", () => {
  const baseEnv = (r2: MemoryR2, extra: Record<string, unknown> = {}) => ({
    ENVIRONMENT: "test",
    PORTFOLIO_ADMIN_PASSWORD: "test-admin-password",
    PORTFOLIO_ADMIN_SESSION_SECRET: "test-session-secret-with-sufficient-length",
    RESUME_BUCKET: r2,
    ...extra,
  });
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (promise: Promise<unknown>) => void pending.push(promise) };
  const settle = async () => void (await Promise.all(pending.splice(0)));
  const post = (env: object, path: string, body: unknown, headers: Record<string, string> = {}) =>
    server.fetch(
      new Request(ORIGIN + path, {
        method: "POST",
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          "cf-connecting-ip": `evt-${Math.random()}`,
          ...headers,
        },
        body: JSON.stringify(body),
      }),
      env,
      ctx,
    );

  it("sends nothing and stores nothing when disabled (the default)", async () => {
    const r2 = new MemoryR2();
    const env = baseEnv(r2);
    await post(env, "/api/admin/login", { password: "test-admin-password" });
    await settle();
    expect(received).toHaveLength(0);
    expect(await r2.get(OUTBOX_KEY)).toBeNull();
    const manifest = await (
      await server.fetch(new Request(`${ORIGIN}/.well-known/asaa-service`), env, ctx)
    ).json();
    expect(manifestSchema.safeParse(manifest).success).toBe(true);
    expect(manifest.checks.asaaEvents).toBe("disabled");
  });

  it("reports login and failed login without credentials, and forwards a valid X-Request-ID", async () => {
    const r2 = new MemoryR2();
    const env = baseEnv(r2, EVENTS_ENV);
    const ok = await post(
      env,
      "/api/admin/login",
      { password: "test-admin-password" },
      { "x-request-id": "corr-0001-abcd" },
    );
    expect(ok.status).toBe(200);
    const bad = await post(env, "/api/admin/login", { password: "wrong-password-value" });
    expect(bad.status).toBe(401);
    await settle();

    const types = received.map((call) => call.body["type"]);
    expect(types).toContain("portfolio.admin.login");
    expect(types).toContain("portfolio.admin.login-failed");
    const login = received.find((call) => call.body["type"] === "portfolio.admin.login")!;
    expect(login.body["correlationId"]).toBe("corr-0001-abcd");
    expect(login.headers.get("x-request-id")).toBe("corr-0001-abcd");
    expect(login.body["orgId"]).toBe("org-123");
    expect(login.body["project"]).toBe("PORTFOLIO");
    expect(login.body["source"]).toBe("portfolio");
    expect((login.body["data"] as Record<string, unknown>)["method"]).toBe("password");
    expect((login.body["data"] as Record<string, unknown>)["actor"]).toBe("password-admin");
    const failed = received.find((call) => call.body["type"] === "portfolio.admin.login-failed")!;
    expect(failed.body["severity"]).toBe("warning");
    const text = JSON.stringify(received.map((call) => call.body));
    expect(text).not.toContain("wrong-password-value");
    expect(text).not.toContain("test-admin-password");
    for (const call of received) expect(envelopeSchema.safeParse(call.body).success).toBe(true);
  });

  it("reports content actions as metadata only, never the submitted content", async () => {
    const r2 = new MemoryR2();
    const env = baseEnv(r2, EVENTS_ENV);
    const login = await post(env, "/api/admin/login", { password: "test-admin-password" });
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    received.length = 0;
    const secretText = "PRIVATE-PROFILE-HEADLINE-DO-NOT-LEAK";
    await post(
      env,
      "/api/admin/content/publish",
      { profileId: "ammu", content: { basics: { headline: secretText } } },
      { cookie },
    );
    await settle();
    const event = received.find((call) =>
      String(call.body["type"]).startsWith("portfolio.admin.content"),
    );
    expect(event).toBeDefined();
    expect(event!.body["type"]).toBe("portfolio.admin.content-published");
    expect(JSON.stringify(received.map((call) => call.body))).not.toContain(secretText);
    expect(envelopeSchema.safeParse(event!.body).success).toBe(true);
  });

  it("queues events while ASAA is down and retries from the next manifest probe", async () => {
    const r2 = new MemoryR2();
    const env = baseEnv(r2, EVENTS_ENV);
    respond = () => new Response(null, { status: 503 });
    await post(env, "/api/admin/login", { password: "test-admin-password" });
    await settle();
    let manifest = await (
      await server.fetch(new Request(`${ORIGIN}/.well-known/asaa-service`), env, ctx)
    ).json();
    await settle();
    expect(manifest.checks.asaaEvents).toBe("degraded");
    expect(manifestSchema.safeParse(manifest).success).toBe(true);

    // Backoff passes and ASAA recovers: the next probe flushes the queued event.
    respond = () => new Response(null, { status: 201 });
    vi.useFakeTimers({ now: Date.now() + 2 * 3_600_000, toFake: ["Date"] });
    try {
      await server.fetch(new Request(`${ORIGIN}/.well-known/asaa-service`), env, ctx);
      await settle();
    } finally {
      vi.useRealTimers();
    }
    manifest = await (
      await server.fetch(new Request(`${ORIGIN}/.well-known/asaa-service`), env, ctx)
    ).json();
    expect(manifest.checks.asaaEvents).toBe("ok");
    const stored = await (await r2.get(OUTBOX_KEY))!.json<{ entries: unknown[] }>();
    expect(stored.entries).toHaveLength(0);
  });
});
