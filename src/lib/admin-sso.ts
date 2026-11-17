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
 */
import {
  adminCookieHeader,
  createAdminCookie,
  signAdminValue,
  verifyAdminValue,
  type AdminIdentity,
} from "./admin-auth";
import type { LoginLimiter } from "./login-limiter";
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

export type SsoOutcome =
  { kind: "login"; identity: AdminIdentity } | { kind: "login-failed"; reason: string };

export interface SsoContext {
  path: string;
  env: unknown;
  /** Shared limiter (same store as the password login); SSO failures use their own key prefix. */
  limiter: () => LoginLimiter;
  readEpoch: () => Promise<string | null>;
  notFound: () => Response;
  json: (body: unknown, status: number, headers?: HeadersInit) => Response;
}

function clientKey(request: Request): string {
  return `sso:${(request.headers.get("cf-connecting-ip") ?? "unknown").slice(0, 128)}`;
}

function txCookie(value: string, secure: boolean, maxAge: number): string {
  return `${TX_COOKIE}=${value}; Path=${SSO_PATH}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
    secure ? "; Secure" : ""
  }`;
}

function readTxCookie(request: Request): string | undefined {
  return (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${TX_COOKIE}=`))
    ?.slice(TX_COOKIE.length + 1);
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
  const limiter = context.limiter();
  const key = clientKey(request);

  if (path === `${SSO_PATH}/start`) {
    // Sign-in must be started from this site (the login page), never from another origin.
    if (request.headers.get("sec-fetch-site") === "cross-site")
      return { response: context.notFound() };
    try {
      const decision = await limiter.check(key);
      if (!decision.allowed) {
        return {
          response: context.json({ error: "Too many attempts. Try again later." }, 429, {
            "retry-after": String(decision.retryAfterSeconds),
          }),
        };
      }
    } catch {
      return {
        response: context.json({ error: "Login is temporarily unavailable." }, 503, {
          "retry-after": "30",
        }),
      };
    }
    const state = randomToken();
    const nonce = randomToken();
    const verifier = randomToken(48);
    const signed = await signAdminValue(
      JSON.stringify({
        s: state,
        n: nonce,
        v: verifier,
        r: redirectUri,
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
      console.error("SSO provider discovery failed.", {
        reason: error instanceof Error ? error.message : "unknown",
      });
      return { response: context.json({ error: "The SSO provider is unavailable." }, 502) };
    }
  }

  // ---- callback ----
  const fail = async (reason: string): Promise<{ response: Response; outcome: SsoOutcome }> => {
    try {
      await limiter.recordFailure(key);
    } catch (error) {
      console.error("SSO throttle could not record a failed attempt.", error);
    }
    console.error("Admin SSO sign-in rejected.", { reason });
    return {
      response: redirect("/admin/login?sso=failed", [txCookie("", secure, 0)]),
      outcome: { kind: "login-failed", reason },
    };
  };

  try {
    const decision = await limiter.check(key);
    if (!decision.allowed) {
      return {
        response: context.json({ error: "Too many attempts. Try again later." }, 429, {
          "retry-after": String(decision.retryAfterSeconds),
        }),
      };
    }
  } catch {
    return {
      response: context.json({ error: "Login is temporarily unavailable." }, 503, {
        "retry-after": "30",
      }),
    };
  }

  const rawTx = readTxCookie(request);
  const txText = rawTx ? await verifyAdminValue(rawTx, env) : null;
  let tx: { s?: unknown; n?: unknown; v?: unknown; r?: unknown; e?: unknown } | null;
  try {
    tx = txText ? (JSON.parse(txText) as Record<string, unknown>) : null;
  } catch {
    tx = null;
  }
  if (
    !tx ||
    typeof tx.s !== "string" ||
    typeof tx.n !== "string" ||
    typeof tx.v !== "string" ||
    typeof tx.r !== "string" ||
    typeof tx.e !== "number" ||
    tx.e < Math.floor(Date.now() / 1000)
  )
    return fail("missing_or_expired_transaction");

  const params = url.searchParams;
  if (params.has("error")) return fail("provider_error");
  const state = params.get("state");
  const code = params.get("code");
  if (!state || !constantTimeEqual(state, tx.s)) return fail("state_mismatch");
  if (!code || code.length > 2048) return fail("missing_code");

  let identity: AdminIdentity;
  try {
    const discovery = await discover(config);
    const idToken = await exchangeCode(discovery, config, {
      code,
      verifier: tx.v,
      redirectUri: tx.r,
    });
    identity = await verifyIdToken(idToken, discovery, config, { nonce: tx.n });
  } catch (error) {
    return fail(
      error instanceof OidcVerificationError
        ? error.reason
        : `exchange_failed:${error instanceof Error ? error.message.slice(0, 40) : "unknown"}`,
    );
  }

  let epoch: string | null;
  try {
    epoch = await context.readEpoch();
  } catch {
    epoch = null;
  }
  if (epoch === null) {
    return {
      response: context.json({ error: "Admin session storage is unavailable." }, 503),
    };
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
