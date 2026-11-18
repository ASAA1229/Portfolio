// @vitest-environment node
//
// MOCK IdP: every network call in this file is answered by an in-test stub (discovery, JWKS and token
// endpoints) that signs ID tokens with an RSA key generated here. Nothing talks to a real Keycloak.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readAuditLog } from "@/lib/admin-audit";
import { resetOidcCaches, resetOidcWarnings } from "@/lib/oidc";
import { resetNamedLimiters } from "@/lib/login-limiter";
import { MemoryR2 } from "./helpers/memory-r2";

// The SSR entry cannot boot under Vitest; admin APIs are answered by the Worker before SSR.
vi.mock("@tanstack/react-start/server-entry", () => ({
  default: {
    fetch: () => new Response("<html></html>", { headers: { "content-type": "text/html" } }),
  },
}));
const { default: server } = await import("@/server");

const ORIGIN = "http://127.0.0.1:5174";
const ISSUER = "http://127.0.0.1:8280/realms/asaa";
const CLIENT_ID = "portfolio-admin";
const CLIENT_SECRET = "mock-client-secret-not-real";
const SESSION_SECRET = "test-session-secret-with-sufficient-length";

const b64url = (input: string | Uint8Array) =>
  Buffer.from(typeof input === "string" ? input : input).toString("base64url");

class MockIdp {
  key!: CryptoKeyPair;
  otherKey!: CryptoKeyPair;
  jwk!: JsonWebKey;
  kid = "mock-kid-1";
  tokenCalls: { body: URLSearchParams; authorization: string | null }[] = [];
  /** Captured from the authorization redirect so the token endpoint can enforce PKCE and the nonce. */
  pending: { nonce: string; challenge: string; redirectUri: string } | null = null;
  claims: () => Record<string, unknown> = () => ({});
  signWith: "good" | "other" | "none" | "hs256" = "good";
  tokenStatus = 200;

  async init() {
    const algorithm = {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    };
    this.key = (await crypto.subtle.generateKey(algorithm, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    this.otherKey = (await crypto.subtle.generateKey(algorithm, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    this.jwk = await crypto.subtle.exportKey("jwk", this.key.publicKey);
  }

  async sign(payload: Record<string, unknown>): Promise<string> {
    const alg = this.signWith === "none" ? "none" : this.signWith === "hs256" ? "HS256" : "RS256";
    const head = b64url(JSON.stringify({ alg, kid: this.kid, typ: "JWT" }));
    const body = b64url(JSON.stringify(payload));
    const input = `${head}.${body}`;
    if (this.signWith === "none") return `${input}.`;
    if (this.signWith === "hs256") return `${input}.${b64url("x".repeat(32))}`;
    const privateKey = this.signWith === "other" ? this.otherKey.privateKey : this.key.privateKey;
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      privateKey,
      new TextEncoder().encode(input),
    );
    return `${input}.${b64url(new Uint8Array(signature))}`;
  }

  defaultClaims(): Record<string, unknown> {
    const now = Math.floor(Date.now() / 1000);
    return {
      iss: ISSUER,
      aud: CLIENT_ID,
      azp: CLIENT_ID,
      sub: "kc-user-1234",
      preferred_username: "alice",
      iat: now,
      auth_time: now,
      exp: now + 300,
      nonce: this.pending?.nonce,
      amr: ["pwd", "otp"],
      realm_access: { roles: ["portfolio-admin", "offline_access"] },
      ...this.claims(),
    };
  }

  async handle(url: string, init?: RequestInit): Promise<Response> {
    if (url === `${ISSUER}/.well-known/openid-configuration`) {
      return Response.json({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/protocol/openid-connect/auth`,
        token_endpoint: `${ISSUER}/protocol/openid-connect/token`,
        jwks_uri: `${ISSUER}/protocol/openid-connect/certs`,
      });
    }
    if (url === `${ISSUER}/protocol/openid-connect/certs`) {
      return Response.json({
        keys: [{ ...this.jwk, kid: this.kid, use: "sig", alg: "RS256" }],
      });
    }
    if (url === `${ISSUER}/protocol/openid-connect/token`) {
      const body = new URLSearchParams(String(init?.body ?? ""));
      const headers = new Headers(init?.headers);
      this.tokenCalls.push({ body, authorization: headers.get("authorization") });
      const expectedBasic = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`;
      const verifier = body.get("code_verifier") ?? "";
      const challenge = b64url(
        new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
      );
      if (
        this.tokenStatus !== 200 ||
        body.get("grant_type") !== "authorization_code" ||
        body.get("code") !== "good-code" ||
        headers.get("authorization") !== expectedBasic ||
        challenge !== this.pending?.challenge ||
        body.get("redirect_uri") !== this.pending?.redirectUri
      ) {
        return Response.json(
          { error: "invalid_grant" },
          { status: this.tokenStatus === 200 ? 400 : this.tokenStatus },
        );
      }
      return Response.json({
        id_token: await this.sign(this.defaultClaims()),
        token_type: "Bearer",
      });
    }
    return new Response("unexpected request to " + url, { status: 599 });
  }
}

let idp: MockIdp;
let r2: MemoryR2;
let ipCounter = 0;
let errors: string[];

const baseEnv = (extra: Record<string, unknown> = {}) => ({
  ENVIRONMENT: "test",
  PORTFOLIO_ADMIN_PASSWORD: "test-admin-password",
  PORTFOLIO_ADMIN_SESSION_SECRET: SESSION_SECRET,
  PORTFOLIO_OIDC_ISSUER: ISSUER,
  PORTFOLIO_OIDC_CLIENT_ID: CLIENT_ID,
  PORTFOLIO_OIDC_CLIENT_SECRET: CLIENT_SECRET,
  RESUME_BUCKET: r2,
  ...extra,
});

function call(env: object, path: string, init: RequestInit = {}, ip = "sso-test-ip") {
  const headers = new Headers(init.headers);
  headers.set("cf-connecting-ip", ip);
  if (init.method && init.method !== "GET") headers.set("origin", ORIGIN);
  return server.fetch(new Request(ORIGIN + path, { ...init, headers }), env, {});
}

async function begin(env: object, ip: string) {
  const response = await call(env, "/api/admin/sso/start", {}, ip);
  expect(response.status).toBe(302);
  const location = new URL(response.headers.get("location")!);
  const txCookie = response.headers.get("set-cookie")!.split(";")[0]!;
  idp.pending = {
    nonce: location.searchParams.get("nonce")!,
    challenge: location.searchParams.get("code_challenge")!,
    redirectUri: location.searchParams.get("redirect_uri")!,
  };
  return { response, location, txCookie, state: location.searchParams.get("state")! };
}

async function finish(
  env: object,
  tx: { txCookie: string; state: string },
  overrides: { state?: string; code?: string; cookie?: string | null; query?: string } = {},
  ip = "sso-test-ip",
) {
  const query =
    overrides.query ??
    new URLSearchParams({
      code: overrides.code ?? "good-code",
      state: overrides.state ?? tx.state,
    }).toString();
  const cookie = overrides.cookie === undefined ? tx.txCookie : overrides.cookie;
  return call(env, `/api/admin/sso/callback?${query}`, { headers: cookie ? { cookie } : {} }, ip);
}

const nextIp = () => `sso-ip-${++ipCounter}`;

async function signIn(env: object, ip = nextIp()) {
  const tx = await begin(env, ip);
  const response = await finish(env, tx, {}, ip);
  return { response, ip, tx };
}

function sessionCookie(response: Response): string {
  const cookies = response.headers.getSetCookie();
  const session = cookies.find((value) => value.startsWith("portfolio_admin_session="));
  return session!.split(";")[0]!;
}

beforeEach(async () => {
  resetOidcCaches();
  resetOidcWarnings();
  resetNamedLimiters();
  r2 = new MemoryR2();
  idp = new MockIdp();
  await idp.init();
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "));
  });
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => idp.handle(String(url), init));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SSO availability and options", () => {
  it("is off unless issuer, client id and client secret are all configured", async () => {
    for (const missing of [
      "PORTFOLIO_OIDC_ISSUER",
      "PORTFOLIO_OIDC_CLIENT_ID",
      "PORTFOLIO_OIDC_CLIENT_SECRET",
    ]) {
      const env = { ...baseEnv(), [missing]: "" };
      const options = await (await call(env, "/api/admin/login/options")).json();
      expect(options).toEqual({ sso: false, password: true });
      expect((await call(env, "/api/admin/sso/start")).status).toBe(404);
    }
  });

  it("offers SSO when configured and keeps the password form by default", async () => {
    expect(await (await call(baseEnv(), "/api/admin/login/options")).json()).toEqual({
      sso: true,
      password: true,
    });
  });

  it("refuses a non-https, non-loopback issuer", async () => {
    const env = baseEnv({ PORTFOLIO_OIDC_ISSUER: "http://idp.example.test/realms/asaa" });
    expect(await (await call(env, "/api/admin/login/options")).json()).toMatchObject({
      sso: false,
    });
    expect((await call(env, "/api/admin/sso/start")).status).toBe(404);
  });
});

describe("authorization request (Authorization Code + PKCE)", () => {
  it("redirects to the IdP with state, nonce and an S256 challenge, and sets a signed Lax cookie", async () => {
    const { response, location } = await begin(baseEnv(), nextIp());
    expect(location.origin + location.pathname).toBe(`${ISSUER}/protocol/openid-connect/auth`);
    expect(location.searchParams.get("response_type")).toBe("code");
    expect(location.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(location.searchParams.get("state")!.length).toBeGreaterThanOrEqual(32);
    expect(location.searchParams.get("nonce")!.length).toBeGreaterThanOrEqual(32);
    expect(location.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/admin/sso/callback`);
    expect(location.searchParams.get("scope")).toBe("openid profile");
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/api/admin/sso");
    expect(cookie).not.toContain(CLIENT_SECRET);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("does not start from a cross-site request", async () => {
    const response = await call(baseEnv(), "/api/admin/sso/start", {
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(response.status).toBe(404);
  });

  it("uses the configured redirect URI when provided", async () => {
    const env = baseEnv({
      PORTFOLIO_OIDC_REDIRECT_URI: "http://127.0.0.1:8300/api/admin/sso/callback",
    });
    const { location } = await begin(env, nextIp());
    expect(location.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:8300/api/admin/sso/callback",
    );
  });
});

describe("successful sign-in", () => {
  it("creates the same admin session cookie, redirects to the admin, and never leaks the client secret", async () => {
    const env = baseEnv();
    const { response } = await signIn(env);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/admin/resumes");
    const cookie = sessionCookie(response);
    const all = response.headers.getSetCookie().join(" ");
    expect(all).toContain("HttpOnly");
    expect(all).toContain("SameSite=Strict");
    expect(all).not.toContain(CLIENT_SECRET);

    // The token exchange used the confidential client with PKCE.
    const token = idp.tokenCalls[0]!;
    expect(token.body.get("code_verifier")).toBeTruthy();
    expect(token.authorization).toMatch(/^Basic /);

    const session = await call(env, "/api/admin/session", { headers: { cookie } });
    expect(session.status).toBe(200);
    expect(errors.join("\n")).not.toContain(CLIENT_SECRET);
  });

  it("attributes audited admin actions to the SSO identity, and password logins to password-admin", async () => {
    const env = baseEnv();
    const { response } = await signIn(env);
    const cookie = sessionCookie(response);
    const mutation = await call(env, "/api/admin/session/renew", {
      method: "POST",
      headers: { cookie },
    });
    expect(mutation.status).toBe(200);

    const password = await call(
      env,
      "/api/admin/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "test-admin-password" }),
      },
      nextIp(),
    );
    expect(password.status).toBe(200);

    const log = await readAuditLog(r2);
    const actors = log.entries.map((entry) => [
      entry.action,
      entry.actor,
      entry.actorLabel ?? null,
    ]);
    expect(actors).toContainEqual(["GET sso/callback", "kc-user-1234", "alice"]);
    expect(actors).toContainEqual(["POST session/renew", "kc-user-1234", "alice"]);
    expect(actors).toContainEqual(["POST login", "password-admin", null]);
  });

  it("keeps the identity across session renewal and ends with logout-everywhere", async () => {
    const env = baseEnv();
    const { response } = await signIn(env);
    const cookie = sessionCookie(response);
    const renewed = await call(env, "/api/admin/session/renew", {
      method: "POST",
      headers: { cookie },
    });
    const renewedCookie = sessionCookie(renewed);
    expect(
      (await call(env, "/api/admin/session", { headers: { cookie: renewedCookie } })).status,
    ).toBe(200);
    const logoutAll = await call(env, "/api/admin/logout-all", {
      method: "POST",
      headers: { cookie: renewedCookie },
    });
    expect(logoutAll.status).toBe(200);
    expect(
      (await call(env, "/api/admin/session", { headers: { cookie: renewedCookie } })).status,
    ).toBe(404);
    const log = await readAuditLog(r2);
    expect(
      log.entries.some(
        (entry) => entry.action === "POST logout-all" && entry.actor === "kc-user-1234",
      ),
    ).toBe(true);
  });

  it("rejects a session cookie whose identity was tampered with", async () => {
    const env = baseEnv();
    const { response } = await signIn(env);
    const cookie = sessionCookie(response);
    const [name, value] = cookie.split("=") as [string, string];
    const [payload, signature] = value.split(".") as [string, string];
    const [expiry] = payload.split("~") as [string];
    const forged = `${expiry}~${b64url(JSON.stringify({ s: "attacker", u: "root" }))}.${signature}`;
    expect(
      (await call(env, "/api/admin/session", { headers: { cookie: `${name}=${forged}` } })).status,
    ).toBe(404);
  });
});

describe("callback validation", () => {
  const failed = (response: Response) => {
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/admin/login?sso=failed");
    expect(
      response.headers.getSetCookie().some((c) => c.startsWith("portfolio_admin_session=")),
    ).toBe(false);
  };

  it("rejects a missing transaction cookie", async () => {
    const env = baseEnv();
    const tx = await begin(env, nextIp());
    failed(await finish(env, tx, { cookie: null }));
  });

  it("rejects a state mismatch", async () => {
    const env = baseEnv();
    const tx = await begin(env, nextIp());
    failed(await finish(env, tx, { state: "attacker-state" }));
  });

  it("rejects a forged or tampered transaction cookie", async () => {
    const env = baseEnv();
    const tx = await begin(env, nextIp());
    const [payload, signature] = tx.txCookie.split("=")[1]!.split(".") as [string, string];
    const forgedPayload = b64url(
      JSON.stringify({ s: "x", n: "y", v: "z", r: "http://evil", e: 9999999999 }),
    );
    failed(await finish(env, tx, { cookie: `portfolio_sso_tx=${forgedPayload}.${signature}` }));
    failed(await finish(env, tx, { cookie: `portfolio_sso_tx=${payload}.${"A".repeat(43)}` }));
  });

  it("rejects a provider error response and a missing code", async () => {
    const env = baseEnv();
    const tx = await begin(env, nextIp());
    failed(await finish(env, tx, { query: `error=access_denied&state=${tx.state}` }));
    failed(await finish(env, tx, { query: `state=${tx.state}` }));
  });

  it("rejects a code the IdP refuses (PKCE verifier or code mismatch)", async () => {
    const env = baseEnv();
    const tx = await begin(env, nextIp());
    failed(await finish(env, tx, { code: "bad-code" }));
  });

  it("rejects tokens signed by an unknown key, with alg none, or with HS256", async () => {
    for (const signWith of ["other", "none", "hs256"] as const) {
      const env = baseEnv();
      const tx = await begin(env, nextIp());
      idp.signWith = signWith;
      failed(await finish(env, tx));
    }
  });

  it.each([
    ["wrong issuer", { iss: "http://127.0.0.1:8280/realms/other" }],
    ["wrong audience", { aud: "someone-else" }],
    ["wrong authorized party", { azp: "someone-else" }],
    ["multiple audiences without azp", { aud: [CLIENT_ID, "other"], azp: undefined }],
    ["expired token", { exp: Math.floor(Date.now() / 1000) - 3600 }],
    ["wrong nonce", { nonce: "not-the-nonce" }],
    ["missing subject", { sub: undefined }],
    ["no MFA evidence", { amr: ["pwd"] }],
    ["no amr claim at all", { amr: undefined }],
    ["missing required role", { realm_access: { roles: ["offline_access"] } }],
    ["no role claim", { realm_access: undefined }],
  ])("rejects a token with %s", async (_label, claims) => {
    const env = baseEnv();
    const tx = await begin(env, nextIp());
    idp.claims = () => claims;
    failed(await finish(env, tx));
  });

  it("accepts a token whose audience list contains the client and a matching azp", async () => {
    const env = baseEnv();
    const tx = await begin(env, nextIp());
    idp.claims = () => ({ aud: [CLIENT_ID, "account"], azp: CLIENT_ID });
    expect((await finish(env, tx)).headers.get("location")).toBe("/admin/resumes");
  });

  it("is throttled after repeated failures from the same client", async () => {
    const env = baseEnv();
    const ip = nextIp();
    let last: Response | undefined;
    for (let attempt = 0; attempt < 8; attempt++) {
      const tx = await begin(env, ip).catch(() => null);
      if (!tx) break;
      last = await finish(env, tx, { state: "wrong" }, ip);
      if (last.status === 429) break;
    }
    // Starting is a separate counter; the callback with a valid transaction is what is throttled.
    const tx = await begin(env, ip);
    const next = await finish(env, tx, {}, ip);
    expect(next.status).toBe(429);
    expect(Number(next.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("unauthenticated callback noise cannot lock out sign-in", () => {
  it("lets a legitimate sign-in succeed after many transaction-less callbacks from the same client", async () => {
    const env = baseEnv();
    const ip = nextIp();
    for (let i = 0; i < 10; i++) {
      const noise = await call(env, "/api/admin/sso/callback?error=x", {}, ip);
      expect(noise.status).toBe(302);
      expect(noise.headers.get("location")).toBe("/admin/login?sso=failed");
    }
    const tx = await begin(env, ip);
    const response = await finish(env, tx, {}, ip);
    expect(response.headers.get("location")).toBe("/admin/resumes");
  });

  it("does not let noise from other clients lock a shared or unknown address bucket", async () => {
    const env = baseEnv();
    // No cf-connecting-ip at all: the platform could not supply an address.
    const anonymous = (path: string, init: RequestInit = {}) =>
      server.fetch(new Request(ORIGIN + path, init), env, {});
    for (let i = 0; i < 20; i++) await anonymous("/api/admin/sso/callback?error=x");
    const start = await anonymous("/api/admin/sso/start");
    expect(start.status).toBe(302);
    const location = new URL(start.headers.get("location")!);
    idp.pending = {
      nonce: location.searchParams.get("nonce")!,
      challenge: location.searchParams.get("code_challenge")!,
      redirectUri: location.searchParams.get("redirect_uri")!,
    };
    const tx = start.headers.get("set-cookie")!.split(";")[0]!;
    const done = await anonymous(
      `/api/admin/sso/callback?code=good-code&state=${location.searchParams.get("state")}`,
      { headers: { cookie: tx } },
    );
    expect(done.headers.get("location")).toBe("/admin/resumes");
  });

  it("applies a coarse ceiling to pure noise without affecting a client holding a valid transaction", async () => {
    const env = baseEnv();
    const ip = nextIp();
    const tx = await begin(env, ip);
    let blocked = 0;
    for (let i = 0; i < 70; i++) {
      const noise = await call(env, "/api/admin/sso/callback?error=x", {}, ip);
      if (noise.status === 429) blocked++;
    }
    expect(blocked).toBeGreaterThan(0);
    // The valid transaction still completes: the noise ceiling is separate from the sign-in limiter.
    expect((await finish(env, tx, {}, ip)).headers.get("location")).toBe("/admin/resumes");
  });

  it("counts failures after a valid transaction and starts have a separate counter", async () => {
    const env = baseEnv();
    const ip = nextIp();
    for (let i = 0; i < 5; i++) {
      const tx = await begin(env, ip);
      await finish(env, tx, { state: "wrong" }, ip);
    }
    const tx = await begin(env, ip);
    expect((await finish(env, tx, {}, ip)).status).toBe(429);
  });
});

describe("configurable MFA and role policy", () => {
  it("accepts a configured amr value and a configured acr", async () => {
    const env = baseEnv({ PORTFOLIO_OIDC_MFA_AMR: "hwk", PORTFOLIO_OIDC_MFA_ACR: "urn:mfa:gold" });
    let tx = await begin(env, nextIp());
    idp.claims = () => ({ amr: ["hwk"] });
    expect((await finish(env, tx)).headers.get("location")).toBe("/admin/resumes");

    tx = await begin(env, nextIp());
    idp.claims = () => ({ amr: undefined, acr: "urn:mfa:gold" });
    expect((await finish(env, tx)).headers.get("location")).toBe("/admin/resumes");

    tx = await begin(env, nextIp());
    idp.claims = () => ({ amr: ["otp"] }); // default values no longer accepted
    expect((await finish(env, tx)).headers.get("location")).toBe("/admin/login?sso=failed");
  });

  it("supports a custom role claim path and required role (groups with a leading slash)", async () => {
    const env = baseEnv({
      PORTFOLIO_OIDC_ROLE_CLAIM: "groups",
      PORTFOLIO_OIDC_REQUIRED_ROLE: "site-owners",
    });
    let tx = await begin(env, nextIp());
    idp.claims = () => ({ groups: ["/site-owners"], realm_access: undefined });
    expect((await finish(env, tx)).headers.get("location")).toBe("/admin/resumes");

    tx = await begin(env, nextIp());
    idp.claims = () => ({ groups: ["/others"] });
    expect((await finish(env, tx)).headers.get("location")).toBe("/admin/login?sso=failed");
  });
});

describe("password login option", () => {
  const login = (env: object) =>
    call(
      env,
      "/api/admin/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "test-admin-password" }),
      },
      nextIp(),
    );

  it("still works unchanged by default, even with SSO configured", async () => {
    expect((await login(baseEnv())).status).toBe(200);
  });

  it("is disabled by PORTFOLIO_ADMIN_PASSWORD_LOGIN=false once SSO is live", async () => {
    const env = baseEnv({ PORTFOLIO_ADMIN_PASSWORD_LOGIN: "false" });
    expect((await login(env)).status).toBe(403);
    expect(await (await call(env, "/api/admin/login/options")).json()).toEqual({
      sso: true,
      password: false,
    });
    expect((await signIn(env)).response.headers.get("location")).toBe("/admin/resumes");
  });

  it("ignores the flag when SSO is not configured, so the admin cannot be locked out", async () => {
    const env = {
      ...baseEnv({ PORTFOLIO_ADMIN_PASSWORD_LOGIN: "false" }),
      PORTFOLIO_OIDC_CLIENT_SECRET: "",
    };
    expect((await login(env)).status).toBe(200);
  });

  it("does not require an admin password in SSO-only mode (session secret still required)", async () => {
    const env = baseEnv({ PORTFOLIO_ADMIN_PASSWORD: "", PORTFOLIO_ADMIN_PASSWORD_LOGIN: "false" });
    const { response } = await signIn(env);
    const cookie = sessionCookie(response);
    expect((await call(env, "/api/admin/session", { headers: { cookie } })).status).toBe(200);
  });
});

describe("fresh authentication (max_age)", () => {
  it("requires a fresh login by default: max_age=0 and prompt=login", async () => {
    const { location } = await begin(baseEnv(), nextIp());
    expect(location.searchParams.get("max_age")).toBe("0");
    expect(location.searchParams.get("prompt")).toBe("login");
  });

  it("supports a configurable window without forcing a prompt", async () => {
    const env = baseEnv({ PORTFOLIO_OIDC_MAX_AGE: "300" });
    const { location } = await begin(env, nextIp());
    expect(location.searchParams.get("max_age")).toBe("300");
    expect(location.searchParams.has("prompt")).toBe(false);
    const tx = await begin(env, nextIp());
    idp.claims = () => ({ auth_time: Math.floor(Date.now() / 1000) - 100 });
    expect((await finish(env, tx)).headers.get("location")).toBe("/admin/resumes");
    const stale = await begin(env, nextIp());
    idp.claims = () => ({ auth_time: Math.floor(Date.now() / 1000) - 3600 });
    expect((await finish(env, stale)).headers.get("location")).toBe("/admin/login?sso=failed");
  });

  it.each([
    ["missing auth_time", { auth_time: undefined }],
    [
      "authentication older than max_age=0 allows",
      { auth_time: Math.floor(Date.now() / 1000) - 3600 },
    ],
  ])("rejects a token with %s", async (_label, claims) => {
    const env = baseEnv();
    const tx = await begin(env, nextIp());
    idp.claims = () => claims;
    expect((await finish(env, tx)).headers.get("location")).toBe("/admin/login?sso=failed");
  });
});

describe("absolute SSO session lifetime and SSO-only enforcement", () => {
  const expiryOf = (cookie: string) => Number(cookie.split("=")[1]!.split(".")[0]!.split("~")[0]);

  afterEach(() => vi.useRealTimers());

  it("never extends a session past eight hours from the original sign-in", async () => {
    const env = baseEnv();
    const start = Date.now();
    const { response } = await signIn(env);
    let cookie = sessionCookie(response);
    const issuedExpiry = expiryOf(cookie);
    vi.useFakeTimers({ now: start + 7 * 3600_000, toFake: ["Date"] });
    let renewed = await call(env, "/api/admin/session/renew", {
      method: "POST",
      headers: { cookie },
    });
    expect(renewed.status).toBe(200);
    cookie = sessionCookie(renewed);
    // A normal renewal would reach start+15h; the absolute cap keeps it at the original expiry.
    expect(expiryOf(cookie)).toBe(issuedExpiry);
    vi.setSystemTime(start + 7.9 * 3600_000);
    renewed = await call(env, "/api/admin/session/renew", { method: "POST", headers: { cookie } });
    expect(renewed.status).toBe(200);
    expect(expiryOf(sessionCookie(renewed))).toBe(issuedExpiry);
    // Past the absolute maximum nothing works, including renewal.
    vi.setSystemTime(start + 8 * 3600_000 + 5_000);
    expect((await call(env, "/api/admin/session", { headers: { cookie } })).status).toBe(404);
    expect(
      (await call(env, "/api/admin/session/renew", { method: "POST", headers: { cookie } })).status,
    ).toBe(404);
  });

  it("keeps password sessions on the normal sliding renewal", async () => {
    const env = baseEnv();
    const login = await call(
      env,
      "/api/admin/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "test-admin-password" }),
      },
      nextIp(),
    );
    const cookie = sessionCookie(login);
    const first = expiryOf(cookie);
    vi.useFakeTimers({ now: Date.now() + 3600_000, toFake: ["Date"] });
    const renewed = await call(env, "/api/admin/session/renew", {
      method: "POST",
      headers: { cookie },
    });
    expect(expiryOf(sessionCookie(renewed))).toBeGreaterThan(first);
  });

  it("rejects password/legacy cookies once the password form is disabled and SSO is live", async () => {
    const env = baseEnv();
    const login = await call(
      env,
      "/api/admin/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "test-admin-password" }),
      },
      nextIp(),
    );
    const passwordCookie = sessionCookie(login);
    expect(
      (await call(env, "/api/admin/session", { headers: { cookie: passwordCookie } })).status,
    ).toBe(200);

    const ssoOnlyEnv = baseEnv({ PORTFOLIO_ADMIN_PASSWORD_LOGIN: "false" });
    expect(
      (await call(ssoOnlyEnv, "/api/admin/session", { headers: { cookie: passwordCookie } }))
        .status,
    ).toBe(404);
    expect(
      (
        await call(ssoOnlyEnv, "/api/admin/session/renew", {
          method: "POST",
          headers: { cookie: passwordCookie },
        })
      ).status,
    ).toBe(404);

    const { response } = await signIn(ssoOnlyEnv);
    expect(
      (
        await call(ssoOnlyEnv, "/api/admin/session", {
          headers: { cookie: sessionCookie(response) },
        })
      ).status,
    ).toBe(200);
  });

  it("does not lock out the password admin when the flag is set but SSO is not configured", async () => {
    const env = {
      ...baseEnv({ PORTFOLIO_ADMIN_PASSWORD_LOGIN: "false" }),
      PORTFOLIO_OIDC_CLIENT_SECRET: "",
    };
    const login = await call(
      env,
      "/api/admin/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "test-admin-password" }),
      },
      nextIp(),
    );
    expect(
      (await call(env, "/api/admin/session", { headers: { cookie: sessionCookie(login) } })).status,
    ).toBe(200);
  });
});

describe("audit attribution and label hygiene", () => {
  it("keys entries by subject and strips bidi/format/control characters from the display label", async () => {
    const env = baseEnv();
    const tx = await begin(env, nextIp());
    // Right-to-left override, zero-width space, isolate, C1 control and a newline inside the name.
    const c = (code: number) => String.fromCharCode(code);
    idp.claims = () => ({
      preferred_username: [
        "al",
        c(0x202e),
        "ce",
        c(0x200b),
        c(0x2066),
        c(0x85),
        "x",
        c(10),
        c(0x2069),
      ].join(""),
    });
    const response = await finish(env, tx);
    expect(response.headers.get("location")).toBe("/admin/resumes");
    const cookie = sessionCookie(response);
    await call(env, "/api/admin/session/renew", { method: "POST", headers: { cookie } });
    const entry = (await readAuditLog(r2)).entries.find((e) => e.action === "POST session/renew")!;
    expect(entry.actor).toBe("kc-user-1234");
    expect(entry.actorLabel).toBe("alcex");
    const codes = Array.from(JSON.stringify(entry)).map((ch) => ch.codePointAt(0)!);
    expect(
      codes.some(
        (code) => (code >= 0x80 && code <= 0x9f) || [0x202e, 0x200b, 0x2066, 0x2069].includes(code),
      ),
    ).toBe(false);
  });

  it("two users with the same username stay distinguishable by subject", async () => {
    const env = baseEnv();
    for (const sub of ["kc-user-aaaa", "kc-user-bbbb"]) {
      const tx = await begin(env, nextIp());
      idp.claims = () => ({ sub, preferred_username: "alice" });
      const cookie = sessionCookie(await finish(env, tx));
      await call(env, "/api/admin/session/renew", { method: "POST", headers: { cookie } });
    }
    const actors = (await readAuditLog(r2)).entries
      .filter((e) => e.action === "POST session/renew")
      .map((e) => e.actor);
    expect(actors).toEqual(["kc-user-aaaa", "kc-user-bbbb"]);
  });

  it("does not lose audit entries when admin actions are recorded concurrently", async () => {
    r2.interleave = true; // every storage operation yields so writers interleave
    const env = baseEnv();
    const login = await call(
      env,
      "/api/admin/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "test-admin-password" }),
      },
      nextIp(),
    );
    const cookie = sessionCookie(login);
    await Promise.all(
      Array.from({ length: 8 }, () =>
        call(env, "/api/admin/session/renew", { method: "POST", headers: { cookie } }),
      ),
    );
    const renewals = (await readAuditLog(r2)).entries.filter(
      (e) => e.action === "POST session/renew",
    );
    expect(renewals).toHaveLength(8);
  });
});

describe("password-login flag parsing (fails closed)", () => {
  const options = async (env: object) =>
    (await (await call(env, "/api/admin/login/options")).json()) as {
      sso: boolean;
      password: boolean;
    };

  it.each(["false", "FALSE", "0", "off", "No", " false "])(
    "%j disables the password form with SSO live",
    async (value) => {
      expect((await options(baseEnv({ PORTFOLIO_ADMIN_PASSWORD_LOGIN: value }))).password).toBe(
        false,
      );
    },
  );

  it.each(["true", "TRUE", "1", "on", "yes", ""])("%j keeps the password form", async (value) => {
    expect((await options(baseEnv({ PORTFOLIO_ADMIN_PASSWORD_LOGIN: value }))).password).toBe(true);
  });

  it("treats an unrecognized value as SSO-only when SSO is usable, with a single warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const env = baseEnv({ PORTFOLIO_ADMIN_PASSWORD_LOGIN: "flase" });
    expect((await options(env)).password).toBe(false);
    expect((await options(env)).password).toBe(false);
    const login = await call(
      env,
      "/api/admin/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "test-admin-password" }),
      },
      nextIp(),
    );
    expect(login.status).toBe(403);
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("unrecognized"))).toHaveLength(1);
  });

  it("keeps password login and warns once when SSO-only is requested but SSO is not usable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const incomplete = {
      ...baseEnv({ PORTFOLIO_ADMIN_PASSWORD_LOGIN: "false" }),
      PORTFOLIO_OIDC_CLIENT_SECRET: "",
    };
    expect((await options(incomplete)).password).toBe(true);
    expect((await options(incomplete)).password).toBe(true);
    const weakSecret = baseEnv({
      PORTFOLIO_ADMIN_PASSWORD_LOGIN: "false",
      PORTFOLIO_ADMIN_SESSION_SECRET: "too-short",
    });
    expect((await options(weakSecret)).password).toBe(true);
    const badIssuer = baseEnv({
      PORTFOLIO_ADMIN_PASSWORD_LOGIN: "false",
      PORTFOLIO_OIDC_ISSUER: "http://idp.example.test/realms/asaa",
    });
    expect((await options(badIssuer)).password).toBe(true);
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("SSO is not usable"))).toHaveLength(
      1,
    );
  });
});
