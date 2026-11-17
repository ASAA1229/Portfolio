/**
 * Producer for ASAA ecosystem events (contracts/asaa-ecosystem/v1/event-envelope.schema.json).
 *
 * DISABLED BY DEFAULT: nothing is built, stored or sent unless ASAA_EVENTS_URL, ASAA_EVENTS_TOKEN and
 * ASAA_ORG_ID are all set. The events carry action metadata only (event type, outcome, HTTP status,
 * resource/profile ids, an opaque actor id): never resume, image or profile content and no personal
 * data. Delivery is POST `${ASAA_EVENTS_URL}/api/v1/integration/events` with a Bearer token and an
 * X-Request-ID; the envelope id is the idempotency key, so a 409 means "already delivered".
 *
 * Delivery model (Workers-safe): every event is first appended to a bounded outbox in the private
 * bucket, then a bounded flush is scheduled with ctx.waitUntil. Whatever fails stays in the outbox and
 * is retried with backoff on the next admin event or the next /.well-known/asaa-service probe (ASAA
 * polls that endpoint, so it doubles as the retry trigger without needing a cron).
 */
import { isSecureOrLoopbackUrl } from "./oidc";

export interface EventsConfig {
  url: string;
  token: string;
  orgId: string;
}

export type EventSeverity = "info" | "warning" | "critical";

export interface EventEnvelope {
  specversion: "asaa.event.v1";
  id: string;
  source: "portfolio";
  type: string;
  time: string;
  orgId: string;
  project: "PORTFOLIO";
  subject?: string;
  correlationId?: string;
  severity: EventSeverity;
  data: Record<string, unknown>;
}

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

export function resolveEventsConfig(env: unknown): EventsConfig | null {
  const url = setting(env, "ASAA_EVENTS_URL");
  const token = setting(env, "ASAA_EVENTS_TOKEN");
  const orgId = setting(env, "ASAA_ORG_ID");
  if (!url || !token || !orgId || orgId.length > 128) return null;
  if (!isSecureOrLoopbackUrl(url)) return null;
  return { url: url.replace(/\/+$/, ""), token, orgId };
}

// ---------------------------------------------------------------------------------------------
// Classification: audit-style (method, path) -> event type
// ---------------------------------------------------------------------------------------------

const UUID_OR_ID = /^[a-f0-9-]{8,64}$/i;
const PROFILE_IDS = /^(abhishek|ammu|bava|sai)$/;

const PAST: Record<string, string> = {
  draft: "draft-saved",
  publish: "published",
  unpublish: "unpublished",
  rollback: "rolled-back",
  review: "reviewed",
  restore: "restored",
  replace: "replaced",
  reconcile: "reconciled",
  cleanup: "cleaned-up",
  extract: "extracted",
  migrate: "migrated",
  recovery: "recovered",
};

const RESOURCE: Record<string, string> = {
  resumes: "resume",
  images: "image",
  content: "content",
  personas: "persona",
  backup: "backup",
  storage: "storage",
  resources: "resource",
};

export interface ClassifiedEvent {
  type: string;
  severity: EventSeverity;
  subject?: string;
  targets: string[];
}

/**
 * Map an admin request to a producer-prefixed event type. Returns null for requests that are not
 * worth reporting (reads, session renewal). `path` is the lower-cased, slash-trimmed pathname.
 */
export function classifyAdminEvent(input: {
  method: string;
  path: string;
  status: number;
}): ClassifiedEvent | null {
  const method = input.method.toUpperCase();
  const segments = input.path.split("/").filter(Boolean);
  if (segments[0] !== "api" || segments[1] !== "admin") return null;
  const rest = segments.slice(2);
  const targets = rest.filter((s) => UUID_OR_ID.test(s) || PROFILE_IDS.test(s)).slice(0, 4);
  const words = rest.filter((s) => !targets.includes(s));
  const failed = input.status >= 400;
  const subject =
    targets[0] && words[0] ? `${RESOURCE[words[0]] ?? words[0]}/${targets[0]}` : undefined;
  const base = (type: string, severity: EventSeverity = "info"): ClassifiedEvent => ({
    type: `portfolio.admin.${type}`,
    severity: failed && severity === "info" ? "warning" : severity,
    ...(subject ? { subject } : {}),
    targets,
  });

  if (words[0] === "login")
    return method === "POST" ? base(failed ? "login-failed" : "login") : null;
  if (words[0] === "sso") return null; // sso outcomes are emitted explicitly by the callback
  if (words[0] === "logout") return method === "POST" ? base("logout") : null;
  if (words[0] === "logout-all") return method === "POST" ? base("logout-all", "warning") : null;
  if (words[0] === "session") return null;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  const resource = RESOURCE[words[0] ?? ""] ?? "admin";
  const last = words[words.length - 1] ?? "";
  if (words[0] === "backup" && last === "restore") return base("backup-restored", "warning");
  if (words[0] === "storage") {
    return base(`storage-${PAST[last] ?? "changed"}`, "warning");
  }
  if (method === "DELETE") return base(`${resource}-deleted`, "warning");
  if (words.length === 1 && method === "POST") {
    return base(
      resource === "resume" || resource === "image"
        ? `${resource}-uploaded`
        : `${resource}-created`,
    );
  }
  const verb = PAST[last];
  if (verb) return base(`${resource}-${verb}`);
  if (method === "PUT" || method === "PATCH" || method === "POST")
    return base(`${resource}-updated`);
  return null;
}

export function buildEnvelope(
  config: EventsConfig,
  input: {
    id?: string;
    type: string;
    severity: EventSeverity;
    subject?: string;
    correlationId?: string;
    data: Record<string, unknown>;
    now?: Date;
  },
): EventEnvelope {
  return {
    specversion: "asaa.event.v1",
    id: input.id ?? crypto.randomUUID(),
    source: "portfolio",
    type: input.type,
    time: (input.now ?? new Date()).toISOString(),
    orgId: config.orgId,
    project: "PORTFOLIO",
    ...(input.subject ? { subject: input.subject.slice(0, 200) } : {}),
    ...(input.correlationId && /^[A-Za-z0-9._-]{8,64}$/.test(input.correlationId)
      ? { correlationId: input.correlationId }
      : {}),
    severity: input.severity,
    data: input.data,
  };
}

// ---------------------------------------------------------------------------------------------
// Bounded outbox in the private bucket
// ---------------------------------------------------------------------------------------------

export const OUTBOX_KEY = "private-admin/events/outbox.json";
export const OUTBOX_MAX = 200;
const MAX_ATTEMPTS = 12;
const FLUSH_BATCH = 20;
const DELIVERY_TIMEOUT_MS = 5000;

interface OutboxEntry {
  envelope: EventEnvelope;
  attempts: number;
  nextAt: number;
}
interface Outbox {
  version: 1;
  dropped: number;
  entries: OutboxEntry[];
}

export interface OutboxBucket {
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

function isOutbox(value: unknown): value is Outbox {
  const box = value as Outbox;
  return (
    !!box &&
    typeof box === "object" &&
    box.version === 1 &&
    typeof box.dropped === "number" &&
    Array.isArray(box.entries)
  );
}

async function readOutbox(bucket: OutboxBucket): Promise<{ outbox: Outbox; etag?: string }> {
  const object = await bucket.get(OUTBOX_KEY);
  if (!object) return { outbox: { version: 1, dropped: 0, entries: [] } };
  const value = await object.json<unknown>();
  // A corrupt outbox must not block admin work: start fresh (events are best-effort telemetry).
  if (!isOutbox(value)) return { outbox: { version: 1, dropped: 0, entries: [] } };
  return { outbox: value, ...(object.etag ? { etag: object.etag } : {}) };
}

/** Read-modify-write with an etag precondition where the provider supports it; a few retries. */
async function mutateOutbox(bucket: OutboxBucket, change: (outbox: Outbox) => void): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { outbox, etag } = await readOutbox(bucket);
    change(outbox);
    const result = await bucket.put(OUTBOX_KEY, JSON.stringify(outbox), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" },
    });
    if (result !== null) return;
  }
  throw new Error("Event outbox was modified concurrently.");
}

export async function enqueueEvent(bucket: OutboxBucket, envelope: EventEnvelope): Promise<void> {
  await mutateOutbox(bucket, (outbox) => {
    if (outbox.entries.some((entry) => entry.envelope.id === envelope.id)) return;
    outbox.entries.push({ envelope, attempts: 0, nextAt: 0 });
    while (outbox.entries.length > OUTBOX_MAX) {
      outbox.entries.shift();
      outbox.dropped += 1;
    }
  });
}

/** Health of event delivery for the service manifest. */
export async function eventsCheck(
  bucket: OutboxBucket | undefined,
  config: EventsConfig | null,
): Promise<"ok" | "degraded" | "down" | "disabled"> {
  if (!config) return "disabled";
  if (!bucket) return "degraded";
  try {
    const { outbox } = await readOutbox(bucket);
    if (outbox.entries.length >= OUTBOX_MAX) return "down";
    return outbox.entries.some((entry) => entry.attempts > 0) ? "degraded" : "ok";
  } catch {
    return "degraded";
  }
}

type Delivery = "delivered" | "drop" | "retry" | "stop";

async function deliver(
  config: EventsConfig,
  envelope: EventEnvelope,
  fetchFn: typeof fetch,
): Promise<Delivery> {
  try {
    const response = await fetchFn(`${config.url}/api/v1/integration/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.token}`,
        "x-request-id": envelope.correlationId ?? crypto.randomUUID(),
      },
      body: JSON.stringify(envelope),
      redirect: "error",
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    await response.body?.cancel().catch(() => undefined);
    const status = response.status;
    if (status >= 200 && status < 300) return "delivered";
    if (status === 409) return "delivered"; // idempotent re-delivery: already accepted
    if (status === 400 || status === 413 || status === 422) return "drop"; // will never be accepted
    if (status === 401 || status === 403 || status >= 500) return "stop"; // endpoint/credential problem
    return "retry";
  } catch {
    return "stop"; // network error or timeout: stop the batch and retry later
  }
}

/**
 * Attempt delivery of due outbox entries (bounded to FLUSH_BATCH per call). Never throws; failures
 * stay queued with exponential backoff and are retried on the next trigger. Returns counts for tests.
 */
export async function flushEvents(
  bucket: OutboxBucket,
  config: EventsConfig,
  options: { fetchFn?: typeof fetch; now?: number } = {},
): Promise<{ delivered: number; dropped: number; pending: number }> {
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? Date.now();
  try {
    const { outbox } = await readOutbox(bucket);
    const due = outbox.entries.filter((entry) => entry.nextAt <= now).slice(0, FLUSH_BATCH);
    const delivered = new Set<string>();
    const dropped = new Set<string>();
    const failed = new Map<string, number>();
    let stopped = false;
    for (const entry of due) {
      const result = await deliver(config, entry.envelope, fetchFn);
      if (result === "delivered") delivered.add(entry.envelope.id);
      else if (result === "drop") dropped.add(entry.envelope.id);
      else {
        failed.set(entry.envelope.id, entry.attempts + 1);
        if (result === "stop") {
          stopped = true;
          break;
        }
      }
    }
    for (const [id, attempts] of failed) {
      if (attempts >= MAX_ATTEMPTS) {
        dropped.add(id);
        failed.delete(id);
      }
    }
    // When the endpoint looks down, hold back the entries that were not attempted too, so every
    // trigger does not hammer it: they share the backoff of the entry that failed.
    const deferred = stopped
      ? new Set(
          due
            .filter(
              (entry) =>
                !delivered.has(entry.envelope.id) &&
                !dropped.has(entry.envelope.id) &&
                !failed.has(entry.envelope.id),
            )
            .map((entry) => entry.envelope.id),
        )
      : new Set<string>();
    const backoff = (attempts: number) => now + Math.min(2 ** attempts * 30_000, 60 * 60_000);
    let pending = 0;
    if (delivered.size || dropped.size || failed.size || deferred.size) {
      await mutateOutbox(bucket, (box) => {
        box.entries = box.entries.filter(
          (entry) => !delivered.has(entry.envelope.id) && !dropped.has(entry.envelope.id),
        );
        for (const entry of box.entries) {
          const attempts = failed.get(entry.envelope.id);
          if (attempts !== undefined) {
            entry.attempts = attempts;
            entry.nextAt = backoff(attempts);
          } else if (deferred.has(entry.envelope.id)) {
            entry.nextAt = backoff(1);
          }
        }
        box.dropped += dropped.size;
        pending = box.entries.length;
      });
    } else {
      pending = (await readOutbox(bucket)).outbox.entries.length;
    }
    if (dropped.size)
      console.error("ASAA events dropped (rejected as invalid or retries exhausted).", {
        count: dropped.size,
      });
    return { delivered: delivered.size, dropped: dropped.size, pending };
  } catch (error) {
    console.error("ASAA event flush failed.", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { delivered: 0, dropped: 0, pending: -1 };
  }
}
