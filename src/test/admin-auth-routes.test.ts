import { describe, expect, it } from "vitest";
import server from "@/server";

class MemoryBucket {
  private readonly objects = new Map<string, string>();

  async get(key: string) {
    const value = this.objects.get(key);
    if (value === undefined) return null;
    return {
      async json<T>() {
        return JSON.parse(value) as T;
      },
      async arrayBuffer() {
        return new TextEncoder().encode(value).buffer;
      },
    };
  }

  async put(key: string, value: string | Uint8Array | ArrayBuffer) {
    const text =
      typeof value === "string"
        ? value
        : new TextDecoder().decode(value instanceof Uint8Array ? value : new Uint8Array(value));
    this.objects.set(key, text);
  }

  async delete(key: string) {
    this.objects.delete(key);
  }
}

const origin = "http://portfolio.test";
const env = (bucket: MemoryBucket) => ({
  ENVIRONMENT: "test",
  PORTFOLIO_ADMIN_PASSWORD: "test-admin-password",
  PORTFOLIO_ADMIN_SESSION_SECRET: "test-session-secret-with-sufficient-length",
  RESUME_BUCKET: bucket,
});

function request(bucketEnv: ReturnType<typeof env>, pathname: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== "GET") headers.set("origin", origin);
  return server.fetch(new Request(origin + pathname, { ...init, headers }), bucketEnv, {});
}

describe("admin authentication route lifecycle", () => {
  it("logs in, reports the session, and invalidates all sessions on logout-all", async () => {
    const bucket = new MemoryBucket();
    const runtime = env(bucket);
    const login = await request(runtime, "/api/admin/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "auth-lifecycle-test",
      },
      body: JSON.stringify({ password: "test-admin-password" }),
    });

    expect(login.status).toBe(200);
    expect(login.headers.get("cache-control")).toContain("no-store");
    expect(login.headers.get("x-content-type-options")).toBe("nosniff");
    expect(login.headers.get("x-robots-tag")).toContain("noindex");
    expect(login.headers.get("referrer-policy")).toBe("no-referrer");
    expect(login.headers.get("permissions-policy")).toContain("camera=()");
    expect(login.headers.get("x-frame-options")).toBe("DENY");
    expect(login.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    const setCookie = login.headers.get("set-cookie");
    expect(setCookie).toContain("portfolio_admin_session=");
    const cookie = setCookie!.split(";")[0]!;

    const session = await request(runtime, "/api/admin/session", {
      headers: { cookie },
    });
    expect(session.status).toBe(200);
    await expect(session.json()).resolves.toEqual({ authenticated: true });

    const renewal = await request(runtime, "/api/admin/session/renew", {
      method: "POST",
      headers: { cookie },
      body: "{}",
    });
    expect(renewal.status).toBe(200);
    expect(renewal.headers.get("set-cookie")).toContain("portfolio_admin_session=");

    const logoutAll = await request(runtime, "/api/admin/logout-all", {
      method: "POST",
      headers: { cookie },
    });
    expect(logoutAll.status).toBe(200);
    await expect(logoutAll.json()).resolves.toMatchObject({ endedAllSessions: true });

    const oldSession = await request(runtime, "/api/admin/session", {
      headers: { cookie },
    });
    expect(oldSession.status).toBe(404);
  });

  it("rate-limits repeated failed logins from the same trusted client address", async () => {
    const runtime = env(new MemoryBucket());
    const client = `rate-limit-${crypto.randomUUID()}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(runtime, "/api/admin/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": client,
        },
        body: JSON.stringify({ password: "incorrect-password" }),
      });
      expect(response.status).toBe(401);
    }

    const blocked = await request(runtime, "/api/admin/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": client,
      },
      body: JSON.stringify({ password: "incorrect-password" }),
    });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("refuses login when private session storage is unavailable", async () => {
    const runtime = {
      ENVIRONMENT: "test",
      PORTFOLIO_ADMIN_PASSWORD: "test-admin-password",
      PORTFOLIO_ADMIN_SESSION_SECRET: "test-session-secret-with-sufficient-length",
    };
    const response = await server.fetch(
      new Request(origin + "/api/admin/login", {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({ password: "test-admin-password" }),
      }),
      runtime,
      {},
    );
    expect(response.status).toBe(503);
  });

  it("rejects login requests without a same-origin header", async () => {
    const runtime = env(new MemoryBucket());
    const response = await server.fetch(
      new Request(origin + "/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "test-admin-password" }),
      }),
      runtime,
      {},
    );
    expect(response.status).toBe(404);
  });

  it.each([
    "/admin",
    "/admin/content",
    "/api/admin/resumes",
    "/api/admin/images",
    "/api/admin/backup",
    "/api/admin/storage/recovery",
  ])("rejects unauthenticated access to %s", async (path) => {
    const response = await request(env(new MemoryBucket()), path);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("fails closed when the stored session epoch is malformed", async () => {
    const bucket = new MemoryBucket();
    const runtime = env(bucket);
    const login = await request(runtime, "/api/admin/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "bad-epoch-test",
      },
      body: JSON.stringify({ password: "test-admin-password" }),
    });
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    await bucket.put("private-admin/session-epoch.json", JSON.stringify({ epoch: "not-an-epoch" }));
    const session = await request(runtime, "/api/admin/session", {
      headers: { cookie },
    });
    expect(session.status).toBe(404);
  });

  it("rejects cross-origin admin mutations even with a valid session", async () => {
    const bucket = new MemoryBucket();
    const runtime = env(bucket);
    const login = await request(runtime, "/api/admin/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "csrf-test",
      },
      body: JSON.stringify({ password: "test-admin-password" }),
    });
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    const response = await server.fetch(
      new Request(origin + "/api/admin/logout-all", {
        method: "POST",
        headers: { cookie, origin: "https://attacker.example" },
      }),
      runtime,
      {},
    );
    expect(response.status).toBe(404);
  });
});
