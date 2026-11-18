/**
 * Server-side admin audit history and admin session epoch (PORT-US-035 / P-E04).
 *
 * The audit log is append-only from the application's point of view: entries are
 * only ever added; when the active log reaches its bound it is sealed into an
 * archive object and a new log is started. Entries hold ids, actions, actors and
 * timestamps only — never request bodies, private notes or file contents.
 */

export const AUDIT_LOG_KEY = "private-admin/audit/log.json";
export const AUDIT_ARCHIVE_PREFIX = "private-admin/audit/archive/";
export const SESSION_EPOCH_KEY = "private-admin/session-epoch.json";
const MAX_ACTIVE_ENTRIES = 1000;
const AUDIT_WRITE_ATTEMPTS = 8;

export interface AdminAuditEntry {
  id: string;
  at: string;
  /**
   * Who acted, as a stable key: the SSO subject, "password-admin" for the legacy password login,
   * "local-dev" for the development bypass, "anonymous" for unauthenticated attempts. Older entries
   * may say "owner".
   */
  actor: string;
  /** Display label only (the SSO username, sanitized). Never used for matching or authorization. */
  actorLabel?: string;
  action: string;
  /** Resource ids parsed from the route, e.g. resume/image ids or profile ids. */
  targets: string[];
  status: number;
  outcome: "success" | "rejected" | "failed";
}

interface AuditLog {
  version: 1;
  startedAt: string;
  entries: AdminAuditEntry[];
}

interface JsonStorage {
  get(key: string): Promise<{ json<T>(): Promise<T>; etag?: string | undefined } | null>;
  put(
    key: string,
    value: string,
    options?: {
      httpMetadata?: { contentType?: string };
      onlyIf?: { etagMatches?: string; etagDoesNotMatch?: string };
    },
  ): Promise<unknown>;
}

/**
 * Characters that must never reach an audit label: C0/C1 controls, soft hyphen, zero-width and
 * bidirectional formatting characters (including the isolates and embeddings that can visually
 * reorder text), line/paragraph separators, BOM and interlinear annotation marks.
 */
const UNSAFE_RANGES: [number, number][] = [
  [0x0000, 0x001f],
  [0x007f, 0x009f],
  [0x00ad, 0x00ad],
  [0x061c, 0x061c],
  [0x180e, 0x180e],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x206f],
  [0xfeff, 0xfeff],
  [0xfff9, 0xfffb],
];

export function sanitizeActorLabel(value: string, max = 128): string {
  return Array.from(value)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return !UNSAFE_RANGES.some(([from, to]) => code >= from && code <= to);
    })
    .join("")
    .trim()
    .slice(0, max);
}

const JSON_TYPE = { httpMetadata: { contentType: "application/json; charset=utf-8" } };

function isAuditLog(value: unknown): value is AuditLog {
  const log = value as AuditLog;
  return (
    !!log &&
    typeof log === "object" &&
    log.version === 1 &&
    typeof log.startedAt === "string" &&
    Array.isArray(log.entries)
  );
}

/** Turn a request into an audit action label without leaking query strings or bodies. */
export function describeAdminAction(
  method: string,
  path: string,
): { action: string; targets: string[] } {
  const segments = path.split("/").filter(Boolean);
  const targets = segments.filter(
    (segment) => /^[a-f0-9-]{8,64}$/i.test(segment) || /^(abhishek|ammu|bava|sai)$/.test(segment),
  );
  const generic = segments
    .map((segment) => (targets.includes(segment) ? ":id" : segment))
    .join("/")
    .replace(/^api\/admin\/?/, "");
  return { action: `${method.toUpperCase()} ${generic || "admin"}`, targets };
}

export async function readAuditLog(storage: JsonStorage): Promise<AuditLog> {
  const object = await storage.get(AUDIT_LOG_KEY);
  const value = object ? await object.json<unknown>() : null;
  if (value === null) return { version: 1, startedAt: new Date().toISOString(), entries: [] };
  if (!isAuditLog(value)) throw new Error("Admin audit log failed validation.");
  return value;
}

export async function appendAdminAudit(
  storage: JsonStorage,
  entry: Omit<AdminAuditEntry, "id" | "at">,
  now = new Date(),
): Promise<AdminAuditEntry> {
  const full: AdminAuditEntry = {
    id: crypto.randomUUID(),
    at: now.toISOString(),
    ...entry,
    actor: sanitizeActorLabel(entry.actor) || "unknown",
    ...(entry.actorLabel ? { actorLabel: sanitizeActorLabel(entry.actorLabel) } : {}),
    action: entry.action.slice(0, 120),
    targets: entry.targets.slice(0, 8).map((target) => target.slice(0, 64)),
  };
  // Read-modify-write with an etag precondition (where the provider enforces it) and jittered retries,
  // so two concurrent admin actions cannot silently overwrite each other's audit entry.
  for (let attempt = 0; attempt < AUDIT_WRITE_ATTEMPTS; attempt++) {
    const object = await storage.get(AUDIT_LOG_KEY);
    const value = object ? await object.json<unknown>() : null;
    if (value !== null && !isAuditLog(value)) throw new Error("Admin audit log failed validation.");
    const log: AuditLog = value ?? { version: 1, startedAt: now.toISOString(), entries: [] };
    if (log.entries.length >= MAX_ACTIVE_ENTRIES) {
      // Seal the full log into an archive object (same key for the same log, so a retry is harmless);
      // never rewrite existing entries.
      await storage.put(
        `${AUDIT_ARCHIVE_PREFIX}${log.startedAt.replace(/[:.]/g, "-")}.json`,
        JSON.stringify(log),
        JSON_TYPE,
      );
      log.startedAt = now.toISOString();
      log.entries = [];
    }
    log.entries.push(full);
    const etag = object?.etag;
    const result = await storage.put(AUDIT_LOG_KEY, JSON.stringify(log), {
      ...JSON_TYPE,
      onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" },
    });
    if (result !== null) return full;
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 15 * 2 ** attempt));
  }
  throw new Error("Admin audit log was modified concurrently; entry not recorded.");
}

export async function readSessionEpoch(storage: JsonStorage | undefined): Promise<string> {
  if (!storage) return "0";
  // Missing epoch is the initial state. Storage errors or malformed persisted
  // values must fail closed; silently falling back to epoch 0 could revive
  // sessions that were explicitly invalidated by logout-everywhere.
  const object = await storage.get(SESSION_EPOCH_KEY);
  if (!object) return "0";
  const value = await object.json<{ epoch?: unknown }>();
  const epoch = value?.epoch;
  if (
    typeof epoch !== "string" ||
    !/^(?:0|[1-9]\d{0,15})$/.test(epoch) ||
    !Number.isSafeInteger(Number(epoch))
  ) {
    throw new Error("Stored admin session epoch failed validation.");
  }
  return epoch;
}

/** Invalidate every existing admin session by moving to a new signing epoch. */
export async function bumpSessionEpoch(storage: JsonStorage): Promise<string> {
  const current = await readSessionEpoch(storage);
  const currentNumber = Number(current);
  if (!Number.isSafeInteger(currentNumber) || currentNumber >= Number.MAX_SAFE_INTEGER) {
    throw new Error("Admin session epoch reached its safe rotation limit.");
  }
  const next = String(currentNumber + 1);
  await storage.put(
    SESSION_EPOCH_KEY,
    JSON.stringify({ epoch: next, changedAt: new Date().toISOString() }),
    JSON_TYPE,
  );
  return next;
}
