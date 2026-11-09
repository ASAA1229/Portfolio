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

export interface AdminAuditEntry {
  id: string;
  at: string;
  actor: "owner" | "local-dev";
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
  get(key: string): Promise<{ json<T>(): Promise<T> } | null>;
  put(
    key: string,
    value: string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
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
  const log = await readAuditLog(storage);
  const full: AdminAuditEntry = {
    id: crypto.randomUUID(),
    at: now.toISOString(),
    ...entry,
    action: entry.action.slice(0, 120),
    targets: entry.targets.slice(0, 8).map((target) => target.slice(0, 64)),
  };
  if (log.entries.length >= MAX_ACTIVE_ENTRIES) {
    // Seal the full log into an archive object; never rewrite existing entries.
    await storage.put(
      `${AUDIT_ARCHIVE_PREFIX}${log.startedAt.replace(/[:.]/g, "-")}.json`,
      JSON.stringify(log),
      JSON_TYPE,
    );
    log.startedAt = now.toISOString();
    log.entries = [];
  }
  log.entries.push(full);
  await storage.put(AUDIT_LOG_KEY, JSON.stringify(log), JSON_TYPE);
  return full;
}

export async function readSessionEpoch(storage: JsonStorage | undefined): Promise<string> {
  if (!storage) return "0";
  const object = await storage.get(SESSION_EPOCH_KEY).catch(() => null);
  const value = object ? await object.json<{ epoch?: unknown }>().catch(() => null) : null;
  const epoch = value?.epoch;
  return typeof epoch === "string" && /^(?:0|[1-9]\d{0,15})$/.test(epoch) ? epoch : "0";
}

/** Invalidate every existing admin session by moving to a new signing epoch. */
export async function bumpSessionEpoch(storage: JsonStorage): Promise<string> {
  const current = await readSessionEpoch(storage);
  const next = String(Number(current) + 1);
  await storage.put(
    SESSION_EPOCH_KEY,
    JSON.stringify({ epoch: next, changedAt: new Date().toISOString() }),
    JSON_TYPE,
  );
  return next;
}
