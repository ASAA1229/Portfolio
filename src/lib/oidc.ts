/**
 * Optional OpenID Connect single sign-on for the Admin (Authorization Code + PKCE S256, confidential
 * client). Everything here is server-side: discovery, token exchange and ID-token verification
 * (RS256 via Web Crypto against the issuer's JWKS). No secret is ever logged or returned.
 *
 * SSO is enabled only when PORTFOLIO_OIDC_ISSUER, PORTFOLIO_OIDC_CLIENT_ID and
 * PORTFOLIO_OIDC_CLIENT_SECRET are all set. Optional policy settings:
 *   PORTFOLIO_OIDC_REQUIRED_ROLE   role/group the user must hold (default "portfolio-admin")
 *   PORTFOLIO_OIDC_ROLE_CLAIM      dotted claim path holding roles/groups (default "realm_access.roles")
 *   PORTFOLIO_OIDC_MFA_AMR         comma list; amr must contain one (default "otp,mfa")
 *   PORTFOLIO_OIDC_MFA_ACR         optional comma list; an acr in this list is also accepted as MFA
 *   PORTFOLIO_OIDC_MAX_AGE         seconds; the IdP must have authenticated the user this recently (default 0 =
 *                                  fresh login with MFA every time; sent as max_age, plus prompt=login for 0)
 *   PORTFOLIO_OIDC_REDIRECT_URI    optional explicit callback URL (default <origin>/api/admin/sso/callback)
 *   PORTFOLIO_ADMIN_PASSWORD_LOGIN "false" disables the password form once SSO is live
 */

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  requiredRole: string;
  roleClaim: string;
  mfaAmr: string[];
  mfaAcr: string[];
  /** Maximum age of the IdP authentication in seconds; 0 forces a fresh sign-in. */
  maxAge: number;
  redirectUri: string | null;
}

type Env = Record<string, unknown> | undefined;

function setting(env: unknown, name: string): string | undefined {
  const bound = env && typeof env === "object" ? (env as Record<string, unknown>)[name] : undefined;
  const value =
    typeof bound === "string"
      ? bound
      : typeof process !== "undefined"
        ? process.env[name]
        : undefined;
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** https anywhere; plain http only for loopback development. No credentials, query or fragment. */
export function isSecureOrLoopbackUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.username || url.password || url.search || url.hash) return false;
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  return url.protocol === "https:" || (url.protocol === "http:" && loopback);
}

const list = (value: string | undefined, fallback: string[]) =>
  value
    ? value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    : fallback;

function parseMaxAge(value: string | undefined): number {
  if (value === undefined || !/^\d{1,5}$/.test(value)) return 0;
  return Math.min(Number(value), 86_400);
}

export function resolveOidcConfig(env: Env | unknown): OidcConfig | null {
  const issuerRaw = setting(env, "PORTFOLIO_OIDC_ISSUER");
  const clientId = setting(env, "PORTFOLIO_OIDC_CLIENT_ID");
  const clientSecret = setting(env, "PORTFOLIO_OIDC_CLIENT_SECRET");
  if (!issuerRaw || !clientId || !clientSecret) return null;
  if (!isSecureOrLoopbackUrl(issuerRaw)) return null;
  const redirectRaw = setting(env, "PORTFOLIO_OIDC_REDIRECT_URI");
  if (redirectRaw) {
    try {
      const redirect = new URL(redirectRaw);
      const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(redirect.hostname);
      if (redirect.protocol !== "https:" && !(redirect.protocol === "http:" && loopback))
        return null;
    } catch {
      return null;
    }
  }
  return {
    issuer: issuerRaw.replace(/\/+$/, ""),
    clientId,
    clientSecret,
    requiredRole: setting(env, "PORTFOLIO_OIDC_REQUIRED_ROLE") ?? "portfolio-admin",
    roleClaim: setting(env, "PORTFOLIO_OIDC_ROLE_CLAIM") ?? "realm_access.roles",
    mfaAmr: list(setting(env, "PORTFOLIO_OIDC_MFA_AMR"), ["otp", "mfa"]),
    mfaAcr: list(setting(env, "PORTFOLIO_OIDC_MFA_ACR"), []),
    maxAge: parseMaxAge(setting(env, "PORTFOLIO_OIDC_MAX_AGE")),
    redirectUri: redirectRaw ?? null,
  };
}

/** SSO is live and the owner turned the password form off: only SSO sessions are valid. */
export function ssoOnly(env: unknown): boolean {
  return resolveOidcConfig(env) !== null && !passwordLoginAllowed(env);
}

/** The password form stays available unless SSO is live AND the owner explicitly turned it off. */
export function passwordLoginAllowed(env: unknown): boolean {
  if (!resolveOidcConfig(env)) return true;
  return setting(env, "PORTFOLIO_ADMIN_PASSWORD_LOGIN")?.toLowerCase() !== "false";
}

// ---------------------------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------------------------

export function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

export function randomToken(bytes = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  return base64Url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
  );
}

// ---------------------------------------------------------------------------------------------
// Discovery and JWKS (cached per isolate)
// ---------------------------------------------------------------------------------------------

export interface OidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

const CACHE_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_JSON_BYTES = 256 * 1024;
const discoveryCache = new Map<string, { at: number; value: OidcDiscovery }>();
const jwksCache = new Map<string, { at: number; keys: JsonWebKey[] }>();

/** Test hook: forget cached discovery documents and key sets. */
export function resetOidcCaches(): void {
  discoveryCache.clear();
  jwksCache.clear();
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > MAX_JSON_BYTES) throw new Error("Response too large");
  return JSON.parse(text);
}

export async function discover(config: OidcConfig): Promise<OidcDiscovery> {
  const cached = discoveryCache.get(config.issuer);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const doc = (await fetchJson(`${config.issuer}/.well-known/openid-configuration`)) as Record<
    string,
    unknown
  >;
  const value: OidcDiscovery = {
    issuer: String(doc["issuer"] ?? ""),
    authorization_endpoint: String(doc["authorization_endpoint"] ?? ""),
    token_endpoint: String(doc["token_endpoint"] ?? ""),
    jwks_uri: String(doc["jwks_uri"] ?? ""),
  };
  // The advertised issuer must match the configured one exactly (mix-up defence), and every
  // endpoint must itself be https (or loopback).
  if (value.issuer.replace(/\/+$/, "") !== config.issuer) throw new Error("Issuer mismatch");
  for (const endpoint of [value.authorization_endpoint, value.token_endpoint, value.jwks_uri]) {
    if (!isSecureOrLoopbackUrlAllowingQuery(endpoint)) throw new Error("Insecure endpoint");
  }
  discoveryCache.set(config.issuer, { at: Date.now(), value });
  return value;
}

function isSecureOrLoopbackUrlAllowingQuery(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.hash) return false;
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    return url.protocol === "https:" || (url.protocol === "http:" && loopback);
  } catch {
    return false;
  }
}

async function loadKeys(discovery: OidcDiscovery, force: boolean): Promise<JsonWebKey[]> {
  const cached = jwksCache.get(discovery.jwks_uri);
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.keys;
  const doc = (await fetchJson(discovery.jwks_uri)) as { keys?: unknown };
  const keys = Array.isArray(doc.keys) ? (doc.keys as JsonWebKey[]) : [];
  jwksCache.set(discovery.jwks_uri, { at: Date.now(), keys });
  return keys;
}

// ---------------------------------------------------------------------------------------------
// Authorization request and token exchange
// ---------------------------------------------------------------------------------------------

export function authorizationUrl(
  discovery: OidcDiscovery,
  config: OidcConfig,
  input: { redirectUri: string; state: string; nonce: string; challenge: string },
): string {
  const url = new URL(discovery.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", "openid profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  // Admin sign-in requires fresh authentication (and therefore fresh MFA) within maxAge seconds.
  url.searchParams.set("max_age", String(config.maxAge));
  if (config.maxAge === 0) url.searchParams.set("prompt", "login");
  return url.toString();
}

export async function exchangeCode(
  discovery: OidcDiscovery,
  config: OidcConfig,
  input: { code: string; verifier: string; redirectUri: string },
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.verifier,
  });
  // client_secret_basic (RFC 6749 section 2.3.1): credentials are form-urlencoded, then base64.
  const basic = btoa(
    `${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`,
  );
  const token = (await fetchJson(discovery.token_endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      authorization: `Basic ${basic}`,
    },
    body,
  })) as { id_token?: unknown };
  if (typeof token.id_token !== "string" || !token.id_token) throw new Error("No ID token");
  return token.id_token;
}

// ---------------------------------------------------------------------------------------------
// ID token verification
// ---------------------------------------------------------------------------------------------

export class OidcVerificationError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "OidcVerificationError";
  }
}

export interface VerifiedIdentity {
  sub: string;
  username: string;
}

function parseJson(bytes: Uint8Array | null): Record<string, unknown> {
  if (!bytes) throw new OidcVerificationError("malformed_token");
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new OidcVerificationError("malformed_token");
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof OidcVerificationError) throw error;
    throw new OidcVerificationError("malformed_token");
  }
}

function claimAt(claims: Record<string, unknown>, path: string): unknown {
  let current: unknown = claims;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function asStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function sanitizeUsername(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback.slice(0, 128);
  const cleaned = Array.from(value)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code > 0x1f && code !== 0x7f;
    })
    .join("")
    .trim()
    .slice(0, 128);
  return cleaned || fallback.slice(0, 128);
}

export async function verifyIdToken(
  idToken: string,
  discovery: OidcDiscovery,
  config: OidcConfig,
  expected: {
    nonce: string;
    /** Transaction start (seconds), the lower bound for auth_time when maxAge is 0. */ startedAt?: number;
  },
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<VerifiedIdentity> {
  const parts = idToken.split(".");
  if (parts.length !== 3 || parts.some((part) => !part))
    throw new OidcVerificationError("malformed_token");
  const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];
  const header = parseJson(fromBase64Url(encodedHeader));
  // Only RS256 is accepted: never "none" and never an HMAC keyed with a public value.
  if (header["alg"] !== "RS256") throw new OidcVerificationError("unsupported_algorithm");
  const kid = typeof header["kid"] === "string" ? header["kid"] : undefined;
  const signature = fromBase64Url(encodedSignature);
  if (!signature) throw new OidcVerificationError("malformed_token");

  const pick = (keys: JsonWebKey[]) =>
    keys.find(
      (key) =>
        key.kty === "RSA" &&
        (!key.use || key.use === "sig") &&
        (!key.alg || key.alg === "RS256") &&
        (kid === undefined || (key as { kid?: string }).kid === kid),
    );
  let jwk = pick(await loadKeys(discovery, false));
  // Key rotation: refetch once when the kid is unknown.
  if (!jwk) jwk = pick(await loadKeys(discovery, true));
  if (!jwk) throw new OidcVerificationError("unknown_signing_key");

  if (typeof jwk.n !== "string" || typeof jwk.e !== "string")
    throw new OidcVerificationError("unknown_signing_key");
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature,
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!valid) throw new OidcVerificationError("bad_signature");

  const claims = parseJson(fromBase64Url(encodedPayload));
  const skew = 60;
  if (typeof claims["iss"] !== "string" || claims["iss"].replace(/\/+$/, "") !== config.issuer)
    throw new OidcVerificationError("bad_issuer");
  const audiences = asStrings(claims["aud"]);
  if (!audiences.includes(config.clientId)) throw new OidcVerificationError("bad_audience");
  if (audiences.length > 1 && claims["azp"] !== config.clientId)
    throw new OidcVerificationError("bad_authorized_party");
  if (typeof claims["azp"] === "string" && claims["azp"] !== config.clientId)
    throw new OidcVerificationError("bad_authorized_party");
  const exp = claims["exp"];
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp + skew <= nowSeconds)
    throw new OidcVerificationError("expired");
  const iat = claims["iat"];
  if (typeof iat === "number" && iat - skew > nowSeconds)
    throw new OidcVerificationError("issued_in_future");
  const nbf = claims["nbf"];
  if (typeof nbf === "number" && nbf - skew > nowSeconds)
    throw new OidcVerificationError("not_yet_valid");
  // max_age was requested, so the IdP must report when the user actually authenticated.
  const authTime = claims["auth_time"];
  if (typeof authTime !== "number" || !Number.isFinite(authTime))
    throw new OidcVerificationError("auth_time_missing");
  if (nowSeconds - authTime > config.maxAge + skew)
    throw new OidcVerificationError("stale_authentication");
  if (
    config.maxAge === 0 &&
    expected.startedAt !== undefined &&
    authTime + skew < expected.startedAt
  )
    throw new OidcVerificationError("stale_authentication");
  if (typeof claims["nonce"] !== "string" || claims["nonce"] !== expected.nonce)
    throw new OidcVerificationError("bad_nonce");
  const sub = claims["sub"];
  if (typeof sub !== "string" || !sub || sub.length > 256)
    throw new OidcVerificationError("bad_subject");

  // Multi-factor evidence is mandatory: an accepted amr value, or an accepted acr when configured.
  const amr = asStrings(claims["amr"]).map((value) => value.toLowerCase());
  const acr = typeof claims["acr"] === "string" ? claims["acr"].toLowerCase() : "";
  const mfa =
    amr.some((value) => config.mfaAmr.includes(value)) ||
    (config.mfaAcr.length > 0 && config.mfaAcr.includes(acr));
  if (!mfa) throw new OidcVerificationError("mfa_required");

  const roles = asStrings(claimAt(claims, config.roleClaim)).map((role) => role.replace(/^\//, ""));
  if (!roles.includes(config.requiredRole.replace(/^\//, "")))
    throw new OidcVerificationError("role_required");

  return { sub, username: sanitizeUsername(claims["preferred_username"], sub) };
}
