/**
 * Admin SSO endpoints (optional OIDC, see ./oidc.ts):
 *   GET /api/admin/login/options   which sign-in methods are available (booleans only)
 *   GET /api/admin/sso/start       begin Authorization Code + PKCE (state, nonce, S256 challenge)
 *   GET /api/admin/sso/callback    validate the transaction, verify the ID token, create the session
 *
 * The in-flight transaction (state, nonce, PKCE verifier, redirect URI, expiry) lives in a short-lived,
 * HMAC-signed, HttpOnly, SameSite=Lax cookie scoped to /api/admin/sso, so no server-side state is
 * needed and a forged or replayed callback is rejected. On success the SAME admin session cookie as
 * the password login is issued (epoch, expiry and logout-everywhere all apply) and also carries the
 * SSO subject and username for audit attribution.
 *
 * Throttling: only failures that happen AFTER the caller proved it holds a transaction we signed count
 * toward the shared per-client limiter. Starts and transaction-less callbacks (pure noise) use
 * separate per-process counters, so unauthenticated traffic can never lock the administrator out.
 */
import {
  adminCookieHeader,
  compactSubject,
  createAdminCookie,
  signAdminValue,
  verifyAdminValue,
  type AdminIdentity,
} from "./admin-auth";
import type { LimiterOptions, LoginLimiter } from "./login-limiter";
import {
  authorizationUrl,
  discover,
  exchangeCode,
  OidcVerificationError,
  passwordLoginAllowed,
  pkceChallenge,
  randomToken,
  resolveOidcConfig,
  verifyIdToken,
} from "./oidc";

const TX_COOKIE = "portfolio_sso_tx";
const TX_SECONDS = 600;
const SSO_PATH = "/api/admin/sso";

const SAFE_FAILURE_REASONS =
  /^(HTTP \d{3}|Response too large|No ID token|Issuer mismatch|Insecure endpoint|Endpoint origin mismatch)$/;

/**
 * A fixed, loggable code for an exchange or discovery failure. Raw error text is never used: a
 * JSON.parse SyntaxError quotes a fragment of the provider response (which can be a token), and a
 * network error can quote request details.
 */
export function safeFailureReason(error: unknown): string {
  if (!(error instanceof Error)) return "unknown";
  if (SAFE_FAILURE_REASONS.test(error.message)) return error.message;
  if (error instanceof SyntaxError) return "invalid_response";
  if (error.name === "TimeoutError" || error.name === "AbortError") return "timeout";
  return "unexpected";
}

export type SsoOutcome =
  | { kind: "login"; identity: AdminIdentity }
  /** `provenTx`: the failure happened after the caller presented a valid signed transaction cookie. */
  | { kind: "login-failed"; reason: string; provenTx: boolean };

export interface SsoContext {
  path: string;
  env: unknown;
  /**
   * A named limiter with its own thresholds. `memoryOnly` limiters are per-process: used for
   * unauthenticated traffic so it can never turn into storage writes.
   */
  limiter: (name: string, options: LimiterOptions, memoryOnly?: boolean) => LoginLimiter;
  readEpoch: () => Promise<string | null>;
  notFound: () => Response;
  json: (body: unknown, status: number, headers?: HeadersInit) => Response;
}

const MINUTES_15 = 15 * 60 * 1000;
/** Failures after a valid signed transaction: shared (KV/R2), strict per client. */
const CALLBACK_FAILURES = { maxAttempts: 5, windowMs: MINUTES_15 };
/** When the platform supplies no client address everyone shares one bucket: a much higher bar. */
const CALLBACK_FAILURES_SHARED = { maxAttempts: 50, windowMs: MINUTES_15 };
/** Starting sign-in is cheap and unauthenticated: per-process counters only. */
const START_LIMIT = { maxAttempts: 30, windowMs: MINUTES_15 };
const START_LIMIT_SHARED = { maxAttempts: 300, windowMs: MINUTES_15 };
/** Callbacks with no valid transaction are pure noise: coarse per-client and global ceilings. */
const NOISE_LIMIT = { maxAttempts: 60, windowMs: MINUTES_15 };
const NOISE_GLOBAL_LIMIT = { maxAttempts: 600, windowMs: MINUTES_15 };

function clientAddress(request: Request): string | undefined {
  const value = request.headers.get("cf-connecting-ip");
  return value ? value.slice(0, 128) : undefined;
}

/**
 * Over https the transaction cookie uses the `__Host-` prefix, which the browser only accepts when it
 * is Secure, has Path=/ and carries no Domain, so a sibling subdomain cannot plant or overwrite it.
 * (That prefix forbids a narrower path.) Over loopback http the plain name and a narrow path are used.
 */
function txCookieName(secure: boolean): string {
  return secure ? `__Host-${TX_COOKIE}` : TX_COOKIE;
}

function txCookie(value: string, secure: boolean, maxAge: number): string {
  const path = secure ? "/" : SSO_PATH;
  return `${txCookieName(secure)}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
    secure ? "; Secure" : ""
  }`;
}

/** The transaction cookie value; `duplicate` is set when the name appears more than once. */
function readTxCookie(
  request: Request,
  secure: boolean,
): { value: string | undefined; duplicate: boolean } {
  const name = txCookieName(secure);
  const matches = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  return { value: matches[0]?.slice(name.length + 1), duplicate: matches.length > 1 };
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let difference = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++)
    difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return difference === 0;
}

function redirect(location: string, cookies: string[]): Response {
  const headers = new Headers({
    location,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}

export async function handleAdminSso(
  request: Request,
  context: SsoContext,
): Promise<{ response: Response; outcome?: SsoOutcome } | null> {
  const { path, env } = context;
  if (request.method !== "GET") return null;
  if (
    path !== "/api/admin/login/options" &&
    path !== `${SSO_PATH}/start` &&
    path !== `${SSO_PATH}/callback`
  )
    return null;

  const config = resolveOidcConfig(env);
  if (path === "/api/admin/login/options") {
    return {
      response: context.json({ sso: config !== null, password: passwordLoginAllowed(env) }, 200),
    };
  }
  if (!config) return { response: context.notFound() };

  const url = new URL(request.url);
  const secure = url.protocol === "https:";
  const redirectUri = config.redirectUri ?? `${url.origin}${SSO_PATH}/callback`;
  const address = clientAddress(request);

  const tooMany = (retryAfterSeconds: number) => ({
    response: context.json({ error: "Too many attempts. Try again later." }, 429, {
      "retry-after": String(retryAfterSeconds),
    }),
  });
  const unavailable = () => ({
    response: context.json({ error: "Login is temporarily unavailable." }, 503, {
      "retry-after": "30",
    }),
  });

  if (path === `${SSO_PATH}/start`) {
    // Sign-in must be started from this site (the login page), never from another origin.
    if (request.headers.get("sec-fetch-site") === "cross-site")
      return { response: context.notFound() };
    // Starts have their own per-process counter, separate from callback failures.
    const startLimiter = context.limiter(
      address ? "sso-start" : "sso-start-shared",
      address ? START_LIMIT : START_LIMIT_SHARED,
      true,
    );
    const started = await startLimiter.recordFailure(address ? `start:${address}` : "start:shared");
    if (!started.allowed) return tooMany(started.retryAfterSeconds);

    const state = randomToken();
    const nonce = randomToken();
    const verifier = randomToken(48);
    const signed = await signAdminValue(
      JSON.stringify({
        s: state,
        n: nonce,
        v: verifier,
        r: redirectUri,
        t: Math.floor(Date.now() / 1000),
        e: Math.floor(Date.now() / 1000) + TX_SECONDS,
      }),
      env,
    );
    if (!signed) return { response: context.json({ error: "SSO is not configured." }, 503) };
    try {
      const discovery = await discover(config);
      const location = authorizationUrl(discovery, config, {
        redirectUri,
        state,
        nonce,
        challenge: await pkceChallenge(verifier),
      });
      return { response: redirect(location, [txCookie(signed, secure, TX_SECONDS)]) };
    } catch (error) {
      console.error("SSO provider discovery failed.", { reason: safeFailureReason(error) });
      return { response: context.json({ error: "The SSO provider is unavailable." }, 502) };
    }
  }

  // ---- callback ----
  // Only fixed, non-sensitive verification codes (never provider text) are shown on the login page, and
  // only to a caller that presented a valid transaction, so a misconfigured realm is diagnosable.
  const failedRedirect = (reason: string, provenTx: boolean, publicReason?: string) => ({
    response: redirect(
      publicReason ? `/admin/login?sso=failed&reason=${publicReason}` : "/admin/login?sso=failed",
      [txCookie("", secure, 0)],
    ),
    outcome: { kind: "login-failed", reason, provenTx } satisfies SsoOutcome,
  });

  // Prove the caller holds a transaction we signed BEFORE touching any shared counter, so
  // unauthenticated callback noise can never lock the real administrator out.
  const presented = readTxCookie(request, secure);
  // Two cookies with the transaction name are ambiguous (one may have been planted): reject outright.
  const rawTx = presented.duplicate ? undefined : presented.value;
  const txText = rawTx ? await verifyAdminValue(rawTx, env) : null;
  let tx: {
    s?: unknown;
    n?: unknown;
    v?: unknown;
    r?: unknown;
    e?: unknown;
    t?: unknown;
  } | null;
  try {
    tx = txText ? (JSON.parse(txText) as Record<string, unknown>) : null;
  } catch {
    tx = null;
  }
  const validTx =
    tx &&
    typeof tx.s === "string" &&
    typeof tx.n === "string" &&
    typeof tx.v === "string" &&
    typeof tx.r === "string" &&
    typeof tx.e === "number" &&
    tx.e >= Math.floor(Date.now() / 1000)
      ? { s: tx.s, n: tx.n, v: tx.v, r: tx.r, t: typeof tx.t === "number" ? tx.t : undefined }
      : null;

  if (!validTx) {
    // Noise: coarse per-client and global ceilings, per-process only (no storage writes, and no
    // effect on the counters that guard real sign-ins).
    const perClient = await context
      .limiter("sso-noise", NOISE_LIMIT, true)
      .recordFailure(`noise:${address ?? "shared"}`);
    const global = await context
      .limiter("sso-noise-global", NOISE_GLOBAL_LIMIT, true)
      .recordFailure("noise:global");
    if (!perClient.allowed) return tooMany(perClient.retryAfterSeconds);
    if (!global.allowed) return tooMany(global.retryAfterSeconds);
    return failedRedirect(
      presented.duplicate
        ? "duplicate_transaction"
        : txText
          ? "expired_transaction"
          : "missing_transaction",
      false,
    );
  }

  const limiter = context.limiter(
    address ? "sso-callback" : "sso-callback-shared",
    address ? CALLBACK_FAILURES : CALLBACK_FAILURES_SHARED,
  );
  const key = address ? `cb:${address}` : "cb:shared";
  try {
    const decision = await limiter.check(key);
    if (!decision.allowed) return tooMany(decision.retryAfterSeconds);
  } catch {
    return unavailable();
  }
  const fail = async (reason: string, publicReason?: string) => {
    try {
      await limiter.recordFailure(key);
    } catch (error) {
      console.error("SSO throttle could not record a failed attempt.", error);
    }
    console.error("Admin SSO sign-in rejected.", { reason });
    return failedRedirect(reason, true, publicReason);
  };

  const params = url.searchParams;
  if (params.has("error")) return fail("provider_error");
  const state = params.get("state");
  const code = params.get("code");
  if (!state || !constantTimeEqual(state, validTx.s)) return fail("state_mismatch");
  if (!code || code.length > 2048) return fail("missing_code");

  let identity: AdminIdentity;
  try {
    const discovery = await discover(config);
    const idToken = await exchangeCode(discovery, config, {
      code,
      verifier: validTx.v,
      redirectUri: validTx.r,
    });
    const verified = await verifyIdToken(idToken, discovery, config, {
      nonce: validTx.n,
      ...(validTx.t !== undefined ? { startedAt: validTx.t } : {}),
    });
    // Long subjects are replaced by a stable pseudonym so the session cookie and audit key agree.
    identity = { ...verified, sub: await compactSubject(verified.sub) };
  } catch (error) {
    return error instanceof OidcVerificationError
      ? fail(error.reason, error.reason)
      : fail(`exchange_failed:${safeFailureReason(error)}`);
  }

  let epoch: string | null;
  try {
    epoch = await context.readEpoch();
  } catch {
    epoch = null;
  }
  if (epoch === null) {
    return unavailableSession(context);
  }
  const cookie = await createAdminCookie(env, epoch, identity);
  if (!cookie)
    return { response: context.json({ error: "Admin authentication is not configured." }, 503) };
  await limiter.reset(key).catch(() => undefined);
  return {
    response: redirect("/admin/resumes", [
      adminCookieHeader(cookie, secure),
      txCookie("", secure, 0),
    ]),
    outcome: { kind: "login", identity },
  };
}

function unavailableSession(context: SsoContext): { response: Response } {
  return { response: context.json({ error: "Admin session storage is unavailable." }, 503) };
}
