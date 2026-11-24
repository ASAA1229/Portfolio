/**
 * Producer for ASAA ecosystem events (contracts/asaa-ecosystem/v1/event-envelope.schema.json).
 *
 * DISABLED BY DEFAULT: nothing is built, stored or sent unless ASAA_EVENTS_URL and ASAA_ORG_ID are set
 * together with either ASAA_EVENTS_TOKEN or the client-credentials set (ASAA_EVENTS_TOKEN_URL,
 * ASAA_EVENTS_CLIENT_SECRET, ASAA_EVENTS_CLIENT_ID default portfolio-events). The events carry action metadata only (event type, outcome, HTTP status,
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

export interface EventsClientCredentials {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
}

export interface EventsConfig {
  url: string;
  /** Static bearer token: used only when no client-credentials set is configured. */
  token: string | null;
  /** OAuth client-credentials (service account). Wins over the static token. */
  credentials?: EventsClientCredentials;
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
  const token = setting(env, "ASAA_EVENTS_TOKEN") ?? null;
  const orgId = setting(env, "ASAA_ORG_ID");
  if (!url || !orgId || orgId.length > 128) return null;
  if (!isSecureOrLoopbackUrl(url)) return null;
  const tokenUrl = setting(env, "ASAA_EVENTS_TOKEN_URL");
  const clientSecret = setting(env, "ASAA_EVENTS_CLIENT_SECRET");
  const clientId = setting(env, "ASAA_EVENTS_CLIENT_ID") ?? "portfolio-events";
  const base = { url: url.replace(/\/+$/, ""), orgId };
  if (tokenUrl || clientSecret) {
    // A half-configured client-credentials set disables delivery; it never silently uses the static token.
    if (!tokenUrl || !clientSecret || clientId.length > 128 || !isSecureOrLoopbackUrl(tokenUrl))
      return null;
    return { ...base, token, credentials: { tokenUrl, clientId, clientSecret } };
  }
  if (!token) return null;
  return { ...base, token };
}

const TOKEN_REFRESH_SKEW_MS = 30_000;
const TOKEN_TIMEOUT_MS = 5_000;
const tokenCache = new Map<string, { accessToken: string; refreshAt: number }>();

/** Test hook: forget cached service-account tokens. */
export function resetEventsTokenCache(): void {
  tokenCache.clear();
}

/**
 * Bearer token for delivery: a cached client-credentials token (refreshed shortly before expiry),
 * or the static token. Returns null when none can be obtained; the secret is never logged or thrown.
 */
async function bearerToken(
  config: EventsConfig,
  fetchFn: typeof fetch,
  now: number,
): Promise<string | null> {
  const creds = config.credentials;
  if (!creds) return config.token;
  const key = `${creds.tokenUrl}|${creds.clientId}`;
  const hit = tokenCache.get(key);
  if (hit && now < hit.refreshAt && now >= hit.refreshAt - 86_400_000) return hit.accessToken;
  try {
    const response = await fetchFn(creds.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }).toString(),
      redirect: "error",
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }
    const body = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof body.access_token !== "string" || !body.access_token) return null;
    const expiresIn =
      typeof body.expires_in === "number" && Number.isFinite(body.expires_in) && body.expires_in > 0
        ? body.expires_in
        : 60;
    const refreshAt = now + Math.max(expiresIn * 1000 - TOKEN_REFRESH_SKEW_MS, 1000);
    tokenCache.set(key, { accessToken: body.access_token, refreshAt });
    return body.access_token;
  } catch {
    return null;
  }
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
  /** Security events are evicted only after every routine event has been. Absent = routine. */
  priority?: "security" | "login-failed" | "routine";
}
interface Outbox {
  version: 1;
  dropped: number;
  entries: OutboxEntry[];
  /** Events that could not be queued because the outbox stayed contended, and when it last happened. */
  lost?: number;
  lostAt?: number;
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

const CAS_ATTEMPTS = 8;
/** Events lost to outbox contention in this process that are not yet recorded in the outbox itself. */
let pendingLost = 0;

class OutboxContentionError extends Error {
  constructor() {
    super("Event outbox was modified concurrently.");
    this.name = "OutboxContentionError";
  }
}

/**
 * Read-modify-write with an etag precondition where the provider supports it. Retries use jittered,
 * growing delays so concurrent writers spread out instead of colliding in lockstep. Contention losses
 * recorded in this process are folded into the outbox on the next successful write.
 */
async function mutateOutbox(bucket: OutboxBucket, change: (outbox: Outbox) => void): Promise<void> {
  for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt++) {
    const { outbox, etag } = await readOutbox(bucket);
    change(outbox);
    const folded = pendingLost;
    if (folded > 0) {
      outbox.lost = (outbox.lost ?? 0) + folded;
      outbox.lostAt = Date.now();
    }
    const result = await bucket.put(OUTBOX_KEY, JSON.stringify(outbox), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" },
    });
    if (result !== null) {
      pendingLost = Math.max(0, pendingLost - folded);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 10 * 2 ** attempt));
  }
  throw new OutboxContentionError();
}

/**
 * Security-relevant events (anything above info severity, and content/persona changes) outrank routine
 * noise such as ordinary logins when the outbox is full.
 */
export function eventPriority(envelope: EventEnvelope): "security" | "login-failed" | "routine" {
  // Failed sign-ins are the one security-ish event anyone can provoke, so they get their own small
  // lane (LOGIN_FAILED_MAX) that can never push out other security events.
  if (envelope.type === "portfolio.admin.login-failed") return "login-failed";
  return envelope.severity !== "info" || /^portfolio\.admin\.(persona|content)-/.test(envelope.type)
    ? "security"
    : "routine";
}

export const LOGIN_FAILED_MAX = 20;

export async function enqueueEvent(bucket: OutboxBucket, envelope: EventEnvelope): Promise<void> {
  try {
    await mutateOutbox(bucket, (outbox) => {
      if (outbox.entries.some((entry) => entry.envelope.id === envelope.id)) return;
      const priority = eventPriority(envelope);
      if (priority === "login-failed") {
        // The lane is capped on its own: the oldest login-failed entry makes room, nothing else does.
        const lane = outbox.entries.filter((entry) => entry.priority === "login-failed");
        if (lane.length >= LOGIN_FAILED_MAX) {
          const oldest = outbox.entries.findIndex((entry) => entry.priority === "login-failed");
          outbox.entries.splice(oldest, 1);
          outbox.dropped += 1;
        }
      }
      outbox.entries.push({ envelope, attempts: 0, nextAt: 0, priority });
      while (outbox.entries.length > OUTBOX_MAX) {
        // Eviction order: routine, then login-failed, and only then the oldest security event.
        const victim = (kind: string) =>
          outbox.entries.findIndex((e) => (e.priority ?? "routine") === kind);
        const routine = victim("routine");
        const failed = victim("login-failed");
        outbox.entries.splice(routine >= 0 ? routine : failed >= 0 ? failed : 0, 1);
        outbox.dropped += 1;
      }
    });
  } catch (error) {
    if (!(error instanceof OutboxContentionError)) throw error;
    // Lost to contention: count it so it shows in checks.asaaEvents instead of vanishing silently.
    pendingLost += 1;
    console.error("ASAA event lost: the outbox stayed contended.");
  }
}

// ---------------------------------------------------------------------------------------------
// Emission limits for unauthenticated traffic (per process)
// ---------------------------------------------------------------------------------------------

const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const FAILURE_REPORT_AT = [1, 5];
const MAX_TRACKED_CLIENTS = 1000;
const failureCounts = new Map<string, { count: number; resetAt: number }>();

/**
 * Failed sign-ins are aggregated per client per window instead of one event per attempt: the first
 * failure and the one that reaches the lockout threshold are reported (with the running count), the
 * rest are only counted. Memory is bounded, and the client address never leaves this process.
 */
export function aggregateLoginFailure(
  clientKey: string,
  now = Date.now(),
): { report: boolean; attempts: number } {
  for (const [key, entry] of failureCounts) if (entry.resetAt <= now) failureCounts.delete(key);
  let entry = failureCounts.get(clientKey);
  if (!entry) {
    if (failureCounts.size >= MAX_TRACKED_CLIENTS) {
      const oldest = failureCounts.keys().next().value;
      if (oldest !== undefined) failureCounts.delete(oldest);
    }
    entry = { count: 0, resetAt: now + FAILURE_WINDOW_MS };
    failureCounts.set(clientKey, entry);
  }
  entry.count += 1;
  return { report: FAILURE_REPORT_AT.includes(entry.count), attempts: entry.count };
}

const EMISSION_WINDOW_MS = 60_000;
const EMISSION_MAX_PER_WINDOW = 120;
let emissionWindow = { start: 0, count: 0 };

/**
 * Global per-process cap on events accepted for the outbox (120 per minute). Anything above it is
 * dropped before it costs a storage write, so no traffic pattern can turn into unbounded writes.
 */
export function emissionAllowed(now = Date.now()): boolean {
  if (now - emissionWindow.start >= EMISSION_WINDOW_MS || now < emissionWindow.start)
    emissionWindow = { start: now, count: 0 };
  emissionWindow.count += 1;
  return emissionWindow.count <= EMISSION_MAX_PER_WINDOW;
}

const PROBE_FLUSH_MIN_MS = 30_000;
let lastProbeFlush = 0;

/** The manifest probe may trigger a delivery retry at most once per 30 s per process. */
export function probeFlushDue(now = Date.now()): boolean {
  if (now - lastProbeFlush < PROBE_FLUSH_MIN_MS) return false;
  lastProbeFlush = now;
  return true;
}

/** Test hook: forget per-process emission state. */
export function resetEventThrottles(): void {
  failureCounts.clear();
  lastProbeFlush = 0;
  pendingLost = 0;
  emissionWindow = { start: 0, count: 0 };
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
    const recentlyLost =
      pendingLost > 0 || (outbox.lostAt !== undefined && Date.now() - outbox.lostAt < 60 * 60_000);
    if (recentlyLost) return "degraded";
    return outbox.entries.some((entry) => entry.attempts > 0) ? "degraded" : "ok";
  } catch {
    return "degraded";
  }
}

/**
 * Counters-only view of the outbox for /api/admin/monitoring. `deadLettered` is the running count of
 * events that were discarded (rejected as invalid, retries exhausted, or evicted at the cap); the
 * envelopes themselves are not retained or exposed. Never contains URLs, tokens or event payloads.
 */
export async function eventsSummary(
  bucket: OutboxBucket,
  config: EventsConfig | null,
): Promise<{
  enabled: boolean;
  pending: number;
  retrying: number;
  deadLettered: number;
  lost: number;
  capacity: number;
  state: "ok" | "degraded" | "down" | "disabled";
}> {
  const state = await eventsCheck(config ? bucket : undefined, config);
  if (!config) {
    return {
      enabled: false,
      pending: 0,
      retrying: 0,
      deadLettered: 0,
      lost: 0,
      capacity: OUTBOX_MAX,
      state,
    };
  }
  try {
    const { outbox } = await readOutbox(bucket);
    return {
      enabled: true,
      pending: outbox.entries.length,
      retrying: outbox.entries.filter((entry) => entry.attempts > 0).length,
      deadLettered: outbox.dropped,
      lost: (outbox.lost ?? 0) + pendingLost,
      capacity: OUTBOX_MAX,
      state,
    };
  } catch {
    return {
      enabled: true,
      pending: -1,
      retrying: 0,
      deadLettered: 0,
      lost: pendingLost,
      capacity: OUTBOX_MAX,
      state: "degraded",
    };
  }
}

type Delivery =
  | { kind: "delivered" | "drop" | "retry" | "stop" }
  /** 429: the receiver asked us to back off; not counted as a failed attempt. */
  | { kind: "rate-limited"; retryAfterMs: number };

const DEFAULT_RETRY_AFTER_MS = 60_000;
const MAX_RETRY_AFTER_MS = 60 * 60_000;

/** Retry-After as delta-seconds or an HTTP date, bounded to 1 s .. 1 h; 60 s when absent or invalid. */
export function parseRetryAfter(header: string | null, now = Date.now()): number {
  if (!header) return DEFAULT_RETRY_AFTER_MS;
  const value = header.trim();
  let ms: number;
  if (/^\d{1,7}$/.test(value)) ms = Number(value) * 1000;
  else {
    const at = Date.parse(value);
    if (Number.isNaN(at)) return DEFAULT_RETRY_AFTER_MS;
    ms = at - now;
  }
  return Math.min(Math.max(ms, 1000), MAX_RETRY_AFTER_MS);
}

async function deliver(
  config: EventsConfig,
  envelope: EventEnvelope,
  fetchFn: typeof fetch,
  now: number,
): Promise<Delivery> {
  const bearer = await bearerToken(config, fetchFn, now);
  if (!bearer) return { kind: "stop" }; // no credential available: keep queued and retry later
  try {
    const response = await fetchFn(`${config.url}/api/v1/integration/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bearer}`,
        "x-request-id": envelope.correlationId ?? crypto.randomUUID(),
      },
      body: JSON.stringify(envelope),
      redirect: "error",
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    await response.body?.cancel().catch(() => undefined);
    const status = response.status;
    if (status >= 200 && status < 300) return { kind: "delivered" };
    if (status === 409) return { kind: "delivered" }; // idempotent re-delivery: already accepted
    if (status === 429)
      return {
        kind: "rate-limited",
        retryAfterMs: parseRetryAfter(response.headers.get("retry-after"), now),
      };
    if (status === 400 || status === 413 || status === 422) return { kind: "drop" }; // never acceptable
    if (status === 401 || status === 403 || status >= 500) {
      if (config.credentials)
        tokenCache.delete(`${config.credentials.tokenUrl}|${config.credentials.clientId}`);
      return { kind: "stop" }; // endpoint or credential
    }
    return { kind: "retry" };
  } catch {
    return { kind: "stop" }; // network error or timeout: stop the batch and retry later
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
    let rateLimitedMs = 0;
    for (const entry of due) {
      const result = await deliver(config, entry.envelope, fetchFn, now);
      if (result.kind === "delivered") delivered.add(entry.envelope.id);
      else if (result.kind === "drop") dropped.add(entry.envelope.id);
      else if (result.kind === "rate-limited") {
        // Honor Retry-After for this entry and everything behind it; no attempt is consumed.
        stopped = true;
        rateLimitedMs = result.retryAfterMs;
        break;
      } else {
        failed.set(entry.envelope.id, entry.attempts + 1);
        if (result.kind === "stop") {
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
            entry.nextAt = rateLimitedMs > 0 ? now + rateLimitedMs : backoff(1);
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
