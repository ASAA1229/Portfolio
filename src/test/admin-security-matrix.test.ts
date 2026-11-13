// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdminCookie } from "@/lib/admin-auth";
import { SESSION_EPOCH_KEY } from "@/lib/admin-audit";
import server from "@/server";
import { MemoryR2 } from "./helpers/memory-r2";

const ORIGIN = "https://portfolio.test";
const PASSWORD = "correct-horse-battery-staple";
const SECRET = "test-session-secret-with-sufficient-length-0123456789";
const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

function makeEnv(r2: MemoryR2, overrides: Record<string, unknown> = {}) {
  return {
    ENVIRONMENT: "production",
    PORTFOLIO_ADMIN_PASSWORD: PASSWORD,
    PORTFOLIO_ADMIN_SESSION_SECRET: SECRET,
    RESUME_BUCKET: r2,
    ...overrides,
  };
}

async function sessionCookie(env: Record<string, unknown>, epoch = "0") {
  const value = await createAdminCookie(env, epoch);
  if (!value) throw new Error("cookie could not be created");
  return `portfolio_admin_session=${value}`;
}

function call(
  env: unknown,
  method: string,
  path: string,
  init: {
    cookie?: string;
    origin?: string | null;
    body?: BodyInit;
    headers?: Record<string, string>;
  } = {},
) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.origin !== null && method !== "GET") headers.set("origin", init.origin ?? ORIGIN);
  return server.fetch(
    new Request(ORIGIN + path, {
      method,
      headers,
      ...(init.body === undefined ? {} : { body: init.body }),
    }),
    env,
    {},
  );
}

/** Every Admin API route the server exposes, including parameterised and mutating ones. */
const ADMIN_API: [method: string, path: string][] = [
  ["GET", "/api/admin/session"],
  ["POST", "/api/admin/session/renew"],
  ["POST", "/api/admin/logout"],
  ["POST", "/api/admin/logout-all"],
  ["GET", "/api/admin/audit"],
  ["GET", "/api/admin/resumes"],
  ["POST", "/api/admin/resumes"],
  ["GET", "/api/admin/resumes/history?profileId=ammu"],
  ["GET", "/api/admin/resumes/consistency"],
  ["POST", "/api/admin/resumes/reconcile"],
  ["POST", "/api/admin/resumes/rollback"],
  ["GET", "/api/admin/resources/consistency"],
  ["GET", `/api/admin/resumes/${UUID}/download`],
  ["POST", `/api/admin/resumes/${UUID}/publish`],
  ["POST", `/api/admin/resumes/${UUID}/unpublish`],
  ["POST", `/api/admin/resumes/${UUID}/extract`],
  ["DELETE", `/api/admin/resumes/${UUID}`],
  ["GET", "/api/admin/images"],
  ["POST", "/api/admin/images"],
  ["POST", "/api/admin/images/cleanup"],
  ["GET", `/api/admin/images/${UUID}/file`],
  ["GET", `/api/admin/images/${UUID}/versions`],
  ["POST", `/api/admin/images/${UUID}/restore`],
  ["POST", `/api/admin/images/${UUID}/replace`],
  ["POST", `/api/admin/images/${UUID}/publish`],
  ["POST", `/api/admin/images/${UUID}/unpublish`],
  ["DELETE", `/api/admin/images/${UUID}`],
  ["GET", "/api/admin/personas?profileId=ammu"],
  ["POST", "/api/admin/personas/draft"],
  ["POST", "/api/admin/personas/publish"],
  ["POST", "/api/admin/personas/rollback"],
  ["POST", "/api/admin/personas/unpublish"],
  ["GET", "/api/admin/content?profileId=ammu"],
  ["POST", "/api/admin/content/draft"],
  ["POST", "/api/admin/content/publish"],
  ["POST", "/api/admin/content/rollback"],
  ["POST", "/api/admin/content/unpublish"],
  ["POST", "/api/admin/content/signoff"],
  ["GET", "/api/admin/backup"],
  ["POST", "/api/admin/backup/restore"],
  ["GET", "/api/admin/storage"],
  ["POST", "/api/admin/storage/migrate"],
  ["GET", "/api/admin/storage/recovery"],
  ["POST", "/api/admin/storage/recovery"],
  ["GET", "/api/admin/does-not-exist"],
];

const ADMIN_PAGES = [
  "/admin",
  "/admin/",
  "/admin/content",
  "/admin/personas",
  "/admin/resumes",
  "/admin/images",
  "/admin/backup",
  "/admin/audit",
];

const REQUIRED_HEADERS: Record<string, string> = {
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow, noarchive",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "cross-origin-opener-policy": "same-origin",
};

function expectNoWrites(r2: MemoryR2) {
  expect(r2.log.filter((entry) => entry.op === "put" || entry.op === "delete")).toEqual([]);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("every Admin API route rejects unauthenticated callers", () => {
  it.each(ADMIN_API)("%s %s", async (method, path) => {
    const r2 = new MemoryR2();
    const response = await call(makeEnv(r2), method, path);
    expect(response.status).toBe(404);
    expectNoWrites(r2);
    expect(await response.text()).not.toMatch(/resume|image|persona|audit/i);
    for (const [name, value] of Object.entries(REQUIRED_HEADERS)) {
      expect(response.headers.get(name), name).toBe(value);
    }
    expect(response.headers.get("strict-transport-security")).toContain("max-age=");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });
});

describe("every Admin page rejects unauthenticated callers before rendering", () => {
  it.each(ADMIN_PAGES)("%s", async (path) => {
    const r2 = new MemoryR2();
    const response = await call(makeEnv(r2), "GET", path);
    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expectNoWrites(r2);
  });
});

describe("encoded and mixed-case paths cannot bypass the auth boundary", () => {
  it.each([
    "/API/ADMIN/audit",
    "/api/%61dmin/audit",
    "/api/%2561dmin/audit",
    "/api/admin//audit",
    "/api/admin/audit/",
    "/api/admin/./audit",
    "/%61dmin",
    "/ADMIN/Content",
    "/api/admin/%2e%2e/admin/audit",
    "/api/admin/audit%00",
    "/api/admin/%zz",
  ])("%s", async (path) => {
    const r2 = new MemoryR2();
    const response = await call(makeEnv(r2), "GET", path);
    expect([400, 404]).toContain(response.status);
    expect(await response.text()).not.toContain("entries");
  });
});

describe("invalid, forged and expired sessions are rejected", () => {
  it("rejects tampered, truncated, foreign-secret and garbage cookies", async () => {
    const r2 = new MemoryR2();
    const env = makeEnv(r2);
    const good = await sessionCookie(env);
    const [name, value] = good.split("=") as [string, string];
    const [expiry, signature] = value.split(".") as [string, string];
    const forged = [
      `${name}=${expiry}.${signature.slice(0, -2)}AA`,
      `${name}=${Number(expiry) + 99999}.${signature}`,
      `${name}=${expiry}`,
      `${name}=`,
      `${name}=${"A".repeat(500)}`,
      await sessionCookie(makeEnv(r2, { PORTFOLIO_ADMIN_SESSION_SECRET: `${SECRET}-other` })),
      `other_cookie=${value}`,
    ];
    for (const cookie of forged) {
      const response = await call(env, "GET", "/api/admin/audit", { cookie });
      expect(response.status, cookie.slice(0, 40)).toBe(404);
    }
    expect((await call(env, "GET", "/api/admin/audit", { cookie: good })).status).toBe(200);
  });

  it("expires sessions after their bounded lifetime", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const r2 = new MemoryR2();
    const env = makeEnv(r2);
    const cookie = await sessionCookie(env);
    expect((await call(env, "GET", "/api/admin/session", { cookie })).status).toBe(200);
    vi.setSystemTime(new Date("2026-01-01T07:59:00Z"));
    expect((await call(env, "GET", "/api/admin/session", { cookie })).status).toBe(200);
    vi.setSystemTime(new Date("2026-01-01T08:00:01Z"));
    expect((await call(env, "GET", "/api/admin/session", { cookie })).status).toBe(404);
  });

  it("revokes every issued session on logout-all and honours only the new epoch", async () => {
    const r2 = new MemoryR2();
    const env = makeEnv(r2);
    const oldCookie = await sessionCookie(env);
    const revoked = await call(env, "POST", "/api/admin/logout-all", { cookie: oldCookie });
    expect(revoked.status).toBe(200);
    expect(revoked.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await call(env, "GET", "/api/admin/session", { cookie: oldCookie })).status).toBe(404);
    const fresh = await sessionCookie(env, "1");
    expect((await call(env, "GET", "/api/admin/session", { cookie: fresh })).status).toBe(200);
  });

  it("invalidates sessions when the signing secret is rotated", async () => {
    const r2 = new MemoryR2();
    const before = makeEnv(r2);
    const cookie = await sessionCookie(before);
    const rotated = makeEnv(r2, {
      PORTFOLIO_ADMIN_SESSION_SECRET: "rotated-secret-that-is-long-enough-to-pass-0123456789",
    });
    expect((await call(before, "GET", "/api/admin/session", { cookie })).status).toBe(200);
    expect((await call(rotated, "GET", "/api/admin/session", { cookie })).status).toBe(404);
  });

  it("fails closed when required secrets or session storage are missing or malformed", async () => {
    const r2 = new MemoryR2();
    const env = makeEnv(r2);
    const cookie = await sessionCookie(env);
    for (const broken of [
      makeEnv(r2, { PORTFOLIO_ADMIN_SESSION_SECRET: "short" }),
      makeEnv(r2, { PORTFOLIO_ADMIN_SESSION_SECRET: undefined }),
      makeEnv(r2, { RESUME_BUCKET: undefined }),
    ]) {
      expect((await call(broken, "GET", "/api/admin/session", { cookie })).status).toBe(404);
    }
    // Malformed persisted epoch must not fall back to epoch 0.
    await r2.put(SESSION_EPOCH_KEY, JSON.stringify({ epoch: "-1" }));
    expect((await call(env, "GET", "/api/admin/session", { cookie })).status).toBe(404);
    await r2.put(SESSION_EPOCH_KEY, "not json");
    expect((await call(env, "GET", "/api/admin/session", { cookie })).status).toBe(404);
    // Weak configuration also refuses login outright.
    const weakLogin = await call(
      makeEnv(r2, { PORTFOLIO_ADMIN_PASSWORD: "short" }),
      "POST",
      "/api/admin/login",
      { body: JSON.stringify({ password: "short" }) },
    );
    expect(weakLogin.status).toBe(503);
  });

  it("never honours the development auth bypass outside an explicit dev environment", async () => {
    const r2 = new MemoryR2();
    for (const flags of [
      { PORTFOLIO_ADMIN_AUTH_BYPASS: "true" },
      { PORTFOLIO_ADMIN_AUTH_BYPASS: "true", ENVIRONMENT: "production" },
      { PORTFOLIO_ADMIN_AUTH_BYPASS: "true", ENVIRONMENT: "test" },
    ]) {
      const response = await call(makeEnv(r2, flags), "GET", "/api/admin/audit");
      expect(response.status, JSON.stringify(flags)).toBe(404);
    }
  });
});

describe("CSRF and same-origin enforcement on every mutating Admin route", () => {
  const mutations = ADMIN_API.filter(([method]) => method !== "GET");

  it.each(mutations)(
    "%s %s refuses missing, foreign and null origins even with a valid session",
    async (method, path) => {
      const r2 = new MemoryR2();
      const env = makeEnv(r2);
      const cookie = await sessionCookie(env);
      for (const origin of [
        null,
        "https://evil.example",
        "null",
        "http://portfolio.test",
        `${ORIGIN}.evil.example`,
      ]) {
        const response = await call(env, method, path, { cookie, origin });
        expect(response.status, `origin=${origin}`).toBe(404);
      }
      const crossSite = await call(env, method, path, {
        cookie,
        headers: { "sec-fetch-site": "cross-site" },
      });
      expect(crossSite.status).toBe(404);
      expectNoWrites(r2);
    },
  );

  it("does not let a cross-origin login attempt reach password verification", async () => {
    const r2 = new MemoryR2();
    const response = await call(makeEnv(r2), "POST", "/api/admin/login", {
      origin: "https://evil.example",
      body: JSON.stringify({ password: PASSWORD }),
    });
    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("issues a Strict, HttpOnly, Secure session cookie on a same-origin login", async () => {
    const r2 = new MemoryR2();
    const response = await call(makeEnv(r2), "POST", "/api/admin/login", {
      body: JSON.stringify({ password: PASSWORD }),
      headers: { "cf-connecting-ip": "198.51.100.1" },
    });
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
    expect(cookie).toMatch(/Max-Age=\d+/);
  });
});

describe("distributed failed-login throttling through the Admin login route", () => {
  async function attempt(env: unknown, ip: string, password = "wrong-password-value") {
    return call(env, "POST", "/api/admin/login", {
      body: JSON.stringify({ password }),
      headers: { "cf-connecting-ip": ip },
    });
  }

  it("shares failed-attempt state through storage so another isolate is blocked too", async () => {
    const r2 = new MemoryR2();
    const isolateA = makeEnv(r2);
    for (let i = 0; i < 5; i += 1)
      expect((await attempt(isolateA, "203.0.113.50")).status).toBe(401);
    // A second isolate/region: a different env object over the same shared bucket state.
    const copy = new MemoryR2();
    for (const key of r2.keys("private-admin/ratelimit/")) await copy.put(key, r2.text(key)!);
    const isolateB = makeEnv(copy);
    const blocked = await attempt(isolateB, "203.0.113.50", PASSWORD);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    // The correct password does not bypass the throttle, and other clients are unaffected.
    expect((await attempt(isolateB, "203.0.113.51", PASSWORD)).status).toBe(200);
  });

  it("denies login when the throttle store cannot be consulted", async () => {
    const r2 = new MemoryR2();
    r2.hook = (op, key) => {
      if (op === "get" && key.startsWith("private-admin/ratelimit/")) throw new Error("store down");
    };
    const response = await attempt(makeEnv(r2), "203.0.113.60", PASSWORD);
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("uses a bound KV namespace when one is configured", async () => {
    const store = new Map<string, string>();
    const kv = {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => void store.set(key, value),
      delete: async (key: string) => void store.delete(key),
    };
    const r2 = new MemoryR2();
    const env = makeEnv(r2, { LOGIN_RATE_LIMIT_KV: kv });
    for (let i = 0; i < 5; i += 1) await attempt(env, "203.0.113.70");
    expect(store.size).toBe(1);
    expect(r2.keys("private-admin/ratelimit/")).toEqual([]);
    expect((await attempt(env, "203.0.113.70", PASSWORD)).status).toBe(429);
  });
});
