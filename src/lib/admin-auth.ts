const COOKIE_NAME = "portfolio_admin_session";
const SESSION_SECONDS = 60 * 60 * 8;
/** Absolute lifetime of a signed-in (SSO) session: renewal can never extend beyond issue time + this. */
export const ADMIN_SESSION_SECONDS = SESSION_SECONDS;

type SecretEnv = Record<string, unknown>;

function secret(name: string, env?: unknown): string | undefined {
  const runtimeValue = env && typeof env === "object" ? (env as SecretEnv)[name] : undefined;
  const value =
    typeof runtimeValue === "string"
      ? runtimeValue
      : typeof process !== "undefined"
        ? process.env[name]
        : undefined;
  return value?.trim() || undefined;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmac(value: string, key: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value)),
  );
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

function hasStrongAdminPassword(env?: unknown): boolean {
  const value = secret("PORTFOLIO_ADMIN_PASSWORD", env);
  return Boolean(value && Array.from(value).length >= 12);
}

function hasStrongSessionSecret(env?: unknown): boolean {
  const value = secret("PORTFOLIO_ADMIN_SESSION_SECRET", env);
  return Boolean(value && new TextEncoder().encode(value).byteLength >= 32);
}

export function adminAuthConfigured(env?: unknown): boolean {
  return hasStrongAdminPassword(env) && hasStrongSessionSecret(env);
}

export async function verifyAdminPassword(password: string, env?: unknown): Promise<boolean> {
  const expected = secret("PORTFOLIO_ADMIN_PASSWORD", env);
  if (!expected || !hasStrongAdminPassword(env) || !hasStrongSessionSecret(env)) return false;
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(password)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected)),
  ]);
  return constantTimeEqual(new Uint8Array(actualHash), new Uint8Array(expectedHash));
}

/**
 * Session epoch: "log out everywhere" increments a stored epoch, which changes the
 * signing key and invalidates every previously issued admin cookie at once.
 * Epoch "0" keeps the original key so existing sessions stay valid until then.
 */
function sessionKey(secretValue: string, epoch: string): string {
  return epoch === "0" ? secretValue : `${secretValue}|epoch:${epoch}`;
}

export function isValidSessionEpoch(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^(?:0|[1-9]\d{0,15})$/.test(value) &&
    Number.isSafeInteger(Number(value))
  );
}

/** Signed-in identity carried by an SSO session (opaque subject plus a display name). */
export interface AdminIdentity {
  sub: string;
  username: string;
}

function encodeIdentity(identity: AdminIdentity, issuedAt: number): string {
  return bytesToBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        s: identity.sub.slice(0, 128),
        u: identity.username.slice(0, 128),
        i: issuedAt,
      }),
    ),
  );
}

function decodeIdentity(
  value: string,
): { identity: AdminIdentity; issuedAt: number | null } | null {
  const bytes = base64UrlToBytes(value);
  if (!bytes) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as {
      s?: unknown;
      u?: unknown;
      i?: unknown;
    };
    if (typeof parsed.s !== "string" || typeof parsed.u !== "string" || !parsed.s) return null;
    return {
      identity: { sub: parsed.s, username: parsed.u },
      issuedAt: typeof parsed.i === "number" && Number.isSafeInteger(parsed.i) ? parsed.i : null,
    };
  } catch {
    return null;
  }
}

/**
 * Session cookie: `<expiry>[~<identity>].<hmac>`. Password sessions carry only the expiry; SSO
 * sessions also carry the (signed) identity so audit entries can be attributed. The HMAC covers the
 * whole payload, so the identity cannot be altered without the signing secret.
 */
export async function createAdminCookie(
  env?: unknown,
  epoch = "0",
  identity?: AdminIdentity,
  /** Original sign-in time (seconds) when renewing an SSO session; defaults to now. */
  issuedAt?: number,
): Promise<string | null> {
  const secretValue = secret("PORTFOLIO_ADMIN_SESSION_SECRET", env);
  if (!secretValue || !hasStrongSessionSecret(env) || !isValidSessionEpoch(epoch)) return null;
  const key = sessionKey(secretValue, epoch);
  const now = Math.floor(Date.now() / 1000);
  // SSO sessions have an absolute lifetime measured from the original sign-in: renewal never
  // extends past it, and a renewal after it returns null.
  const issued = identity ? (issuedAt ?? now) : now;
  const expires = identity
    ? Math.min(now + SESSION_SECONDS, issued + SESSION_SECONDS)
    : now + SESSION_SECONDS;
  if (expires <= now) return null;
  const payload = identity ? `${expires}~${encodeIdentity(identity, issued)}` : String(expires);
  return `${payload}.${bytesToBase64Url(await hmac(payload, key))}`;
}

export async function isAdminRequest(
  request: Request,
  env?: unknown,
  epoch = "0",
): Promise<boolean> {
  return (await readAdminSession(request, env, epoch)) !== null;
}

/**
 * Verified session for the request, or null. `identity` is null for password sessions; SSO sessions
 * also report `issuedAt` (the original sign-in time), which bounds their absolute lifetime.
 */
export async function readAdminSession(
  request: Request,
  env?: unknown,
  epoch = "0",
): Promise<{ identity: AdminIdentity | null; issuedAt: number | null } | null> {
  const secretValue = secret("PORTFOLIO_ADMIN_SESSION_SECRET", env);
  if (!secretValue || !hasStrongSessionSecret(env) || !isValidSessionEpoch(epoch)) return null;
  const key = sessionKey(secretValue, epoch);
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!cookie) return null;

  // A SHA-256 HMAC has a fixed 32-byte signature (43 unpadded base64url
  // characters). Reject non-canonical or oversized cookie values before
  // decoding or performing cryptographic work.
  const match = cookie.match(/^([1-9]\d{9,15}(?:~[A-Za-z0-9_-]{1,600})?)\.([A-Za-z0-9_-]{43})$/);
  if (!match) return null;
  const [, payload, encodedSignature] = match;
  if (!payload || !encodedSignature) return null;
  const signature = base64UrlToBytes(encodedSignature);
  const [expiryText, encodedIdentity] = payload.split("~");
  const expiry = Number(expiryText);
  if (
    !signature ||
    signature.length !== 32 ||
    bytesToBase64Url(signature) !== encodedSignature ||
    !Number.isSafeInteger(expiry) ||
    expiry <= Math.floor(Date.now() / 1000)
  )
    return null;
  if (!constantTimeEqual(signature, await hmac(payload, key))) return null;
  if (encodedIdentity === undefined) return { identity: null, issuedAt: null };
  const decoded = decodeIdentity(encodedIdentity);
  if (!decoded) return null;
  // Cookies minted before issue times were recorded: the session started one lifetime before expiry.
  const issuedAt = decoded.issuedAt ?? expiry - SESSION_SECONDS;
  if (issuedAt + SESSION_SECONDS <= Math.floor(Date.now() / 1000)) return null;
  return { identity: decoded.identity, issuedAt };
}

/**
 * Sign/verify a short-lived value (e.g. the SSO transaction cookie) with the session secret under a
 * separate key domain, so it can never be replayed as an admin session.
 */
export async function signAdminValue(value: string, env?: unknown): Promise<string | null> {
  const secretValue = secret("PORTFOLIO_ADMIN_SESSION_SECRET", env);
  if (!secretValue || !hasStrongSessionSecret(env)) return null;
  const encoded = bytesToBase64Url(new TextEncoder().encode(value));
  return `${encoded}.${bytesToBase64Url(await hmac(encoded, `${secretValue}|sso-tx`))}`;
}

export async function verifyAdminValue(signed: string, env?: unknown): Promise<string | null> {
  const secretValue = secret("PORTFOLIO_ADMIN_SESSION_SECRET", env);
  if (!secretValue || !hasStrongSessionSecret(env)) return null;
  const match = signed.match(/^([A-Za-z0-9_-]{1,4096})\.([A-Za-z0-9_-]{43})$/);
  if (!match || !match[1] || !match[2]) return null;
  const signature = base64UrlToBytes(match[2]);
  if (!signature || signature.length !== 32) return null;
  if (!constantTimeEqual(signature, await hmac(match[1], `${secretValue}|sso-tx`))) return null;
  const bytes = base64UrlToBytes(match[1]);
  return bytes ? new TextDecoder().decode(bytes) : null;
}

export function adminCookieHeader(value: string, secure: boolean): string {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure ? "; Secure" : ""}`;
}

export function clearAdminCookieHeader(secure: boolean): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
}
