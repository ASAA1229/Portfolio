const COOKIE_NAME = "portfolio_admin_session";
const SESSION_SECONDS = 60 * 60 * 8;

type SecretEnv = Record<string, unknown>;

function secret(name: string, env?: unknown): string | undefined {
  const runtimeValue = env && typeof env === "object" ? (env as SecretEnv)[name] : undefined;
  const value = typeof runtimeValue === "string" ? runtimeValue : typeof process !== "undefined" ? process.env[name] : undefined;
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
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value)));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

export function adminAuthConfigured(env?: unknown): boolean {
  return Boolean(secret("PORTFOLIO_ADMIN_PASSWORD", env) && secret("PORTFOLIO_ADMIN_SESSION_SECRET", env));
}

export async function verifyAdminPassword(password: string, env?: unknown): Promise<boolean> {
  const expected = secret("PORTFOLIO_ADMIN_PASSWORD", env);
  if (!expected || !secret("PORTFOLIO_ADMIN_SESSION_SECRET", env)) return false;
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(password)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected)),
  ]);
  return constantTimeEqual(new Uint8Array(actualHash), new Uint8Array(expectedHash));
}

export async function createAdminCookie(env?: unknown): Promise<string | null> {
  const key = secret("PORTFOLIO_ADMIN_SESSION_SECRET", env);
  if (!key) return null;
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = String(expires);
  return `${payload}.${bytesToBase64Url(await hmac(payload, key))}`;
}

export async function isAdminRequest(request: Request, env?: unknown): Promise<boolean> {
  const key = secret("PORTFOLIO_ADMIN_SESSION_SECRET", env);
  if (!key) return false;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!cookie) return false;
  const separator = cookie.indexOf(".");
  if (separator < 1) return false;
  const payload = cookie.slice(0, separator);
  const signature = base64UrlToBytes(cookie.slice(separator + 1));
  const expiry = Number(payload);
  if (!signature || !Number.isSafeInteger(expiry) || expiry <= Math.floor(Date.now() / 1000)) return false;
  return constantTimeEqual(signature, await hmac(payload, key));
}

export function adminCookieHeader(value: string, secure: boolean): string {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure ? "; Secure" : ""}`;
}

export function clearAdminCookieHeader(secure: boolean): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
}
