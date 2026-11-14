const COOKIE_NAME = "portfolio_admin_session";
const SESSION_SECONDS = 60 * 60 * 8;

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

export async function createAdminCookie(env?: unknown, epoch = "0"): Promise<string | null> {
  const secretValue = secret("PORTFOLIO_ADMIN_SESSION_SECRET", env);
  if (!secretValue || !hasStrongSessionSecret(env) || !isValidSessionEpoch(epoch)) return null;
  const key = sessionKey(secretValue, epoch);
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = String(expires);
  return `${payload}.${bytesToBase64Url(await hmac(payload, key))}`;
}

export async function isAdminRequest(
  request: Request,
  env?: unknown,
  epoch = "0",
): Promise<boolean> {
  const secretValue = secret("PORTFOLIO_ADMIN_SESSION_SECRET", env);
  if (!secretValue || !hasStrongSessionSecret(env) || !isValidSessionEpoch(epoch)) return false;
  const key = sessionKey(secretValue, epoch);
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!cookie) return false;

  // A SHA-256 HMAC has a fixed 32-byte signature (43 unpadded base64url
  // characters). Reject non-canonical or oversized cookie values before
  // decoding or performing cryptographic work.
  const match = cookie.match(/^([1-9]\d{9,15})\.([A-Za-z0-9_-]{43})$/);
  if (!match) return false;
  const [, payload, encodedSignature] = match;
  if (!payload || !encodedSignature) return false;
  const signature = base64UrlToBytes(encodedSignature);
  const expiry = Number(payload);
  if (
    !signature ||
    signature.length !== 32 ||
    bytesToBase64Url(signature) !== encodedSignature ||
    !Number.isSafeInteger(expiry) ||
    expiry <= Math.floor(Date.now() / 1000)
  )
    return false;
  return constantTimeEqual(signature, await hmac(payload, key));
}

export function adminCookieHeader(value: string, secure: boolean): string {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure ? "; Secure" : ""}`;
}

export function clearAdminCookieHeader(secure: boolean): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
}
