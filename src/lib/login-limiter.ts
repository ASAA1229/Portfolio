/**
 * Pluggable failed-login throttle (PORT-GAP-003).
 *
 * The original limiter was a per-isolate Map, which a distributed attacker (or simply a
 * second Worker isolate) bypasses. Three implementations share one interface:
 *   - MemoryLoginLimiter   per-process; the development/test default and last-resort fallback.
 *   - StorageLoginLimiter  shared through the existing private R2 bucket. State changes use
 *                          conditional writes (etag compare-and-set), so concurrent isolates do
 *                          not lose failed attempts.
 *   - KvLoginLimiter       Workers KV namespace (TTL-expiring keys). KV is eventually
 *                          consistent and has no compare-and-set, so it is best-effort across
 *                          regions; prefer the storage limiter when R2 is bound.
 * Client identifiers are hashed before they are used as storage keys.
 */
import type { ObjectBucket } from "@/lib/storage-adapter";

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** `saturated`: the limiter could not track this client (fail closed) rather than it being over the limit. */
export type LimitDecision =
  { allowed: true } | { allowed: false; retryAfterSeconds: number; saturated?: true };

export interface LoginLimiter {
  /** Is this client currently allowed to attempt a login? */
  check(clientKey: string): Promise<LimitDecision>;
  /** Record one failed attempt. Resolves a decision reflecting the updated count. */
  recordFailure(clientKey: string): Promise<LimitDecision>;
  /** Clear the counter after a successful login. */
  reset(clientKey: string): Promise<void>;
}

export interface LimiterOptions {
  maxAttempts?: number;
  windowMs?: number;
  now?: () => number;
}

type Counter = { count: number; resetAt: number };

function decide(counter: Counter | undefined, now: number, max: number): LimitDecision {
  if (counter && counter.resetAt > now && counter.count >= max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((counter.resetAt - now) / 1000)),
    };
  }
  return { allowed: true };
}

async function digest(clientKey: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(clientKey));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class MemoryLoginLimiter implements LoginLimiter {
  private readonly counters = new Map<string, Counter>();
  private readonly max: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  /** Bound on tracked clients so the map cannot grow without limit. */
  private readonly maxTracked = 4096;

  constructor(options: LimiterOptions = {}) {
    this.max = options.maxAttempts ?? MAX_LOGIN_ATTEMPTS;
    this.windowMs = options.windowMs ?? LOGIN_WINDOW_MS;
    this.now = options.now ?? Date.now;
  }

  private sweep(now: number) {
    for (const [key, counter] of this.counters)
      if (counter.resetAt <= now) this.counters.delete(key);
  }

  async check(clientKey: string): Promise<LimitDecision> {
    const now = this.now();
    this.sweep(now);
    return decide(this.counters.get(clientKey), now, this.max);
  }

  async recordFailure(clientKey: string): Promise<LimitDecision> {
    const now = this.now();
    this.sweep(now);
    const current = this.counters.get(clientKey);
    if (!current && this.counters.size >= this.maxTracked) {
      // Fail closed when the table is saturated by distinct identities.
      return { allowed: false, retryAfterSeconds: 60, saturated: true };
    }
    const next: Counter = current
      ? { count: current.count + 1, resetAt: current.resetAt }
      : { count: 1, resetAt: now + this.windowMs };
    this.counters.set(clientKey, next);
    return decide(next, now, this.max);
  }

  async reset(clientKey: string): Promise<void> {
    this.counters.delete(clientKey);
  }
}

const RATE_PREFIX = "private-admin/ratelimit/";

function isCounter(value: unknown): value is Counter {
  const v = value as Partial<Counter> | null;
  return (
    !!v &&
    typeof v === "object" &&
    Number.isSafeInteger(v.count) &&
    (v.count as number) >= 0 &&
    Number.isFinite(v.resetAt)
  );
}

export class StorageLoginLimiter implements LoginLimiter {
  private readonly max: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(
    private readonly bucket: ObjectBucket,
    options: LimiterOptions = {},
  ) {
    this.max = options.maxAttempts ?? MAX_LOGIN_ATTEMPTS;
    this.windowMs = options.windowMs ?? LOGIN_WINDOW_MS;
    this.now = options.now ?? Date.now;
  }

  private async read(
    key: string,
  ): Promise<{ counter: Counter | undefined; etag: string | undefined }> {
    const object = await this.bucket.get(key);
    if (!object) return { counter: undefined, etag: undefined };
    try {
      const parsed: unknown = JSON.parse(new TextDecoder().decode(await object.arrayBuffer()));
      // A corrupt counter must not lock the owner out forever nor be trusted: replace it.
      return { counter: isCounter(parsed) ? parsed : undefined, etag: object.etag };
    } catch {
      return { counter: undefined, etag: object.etag };
    }
  }

  async check(clientKey: string): Promise<LimitDecision> {
    const key = RATE_PREFIX + (await digest(clientKey));
    return decide((await this.read(key)).counter, this.now(), this.max);
  }

  async recordFailure(clientKey: string): Promise<LimitDecision> {
    const key = RATE_PREFIX + (await digest(clientKey));
    // Compare-and-set loop: retry whenever another isolate wrote between our read and write.
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const now = this.now();
      const { counter, etag } = await this.read(key);
      const live = counter && counter.resetAt > now ? counter : undefined;
      const next: Counter = live
        ? { count: live.count + 1, resetAt: live.resetAt }
        : { count: 1, resetAt: now + this.windowMs };
      const written = await this.bucket.put(key, JSON.stringify(next), {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
        onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" },
      });
      if (written !== null) return decide(next, now, this.max);
    }
    // Persistent contention: deny rather than let attempts go uncounted.
    return { allowed: false, retryAfterSeconds: 5, saturated: true };
  }

  async reset(clientKey: string): Promise<void> {
    await this.bucket.delete(RATE_PREFIX + (await digest(clientKey)));
  }
}

/** Minimal Workers KV surface. */
export interface KvNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export class KvLoginLimiter implements LoginLimiter {
  private readonly max: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(
    private readonly kv: KvNamespaceLike,
    options: LimiterOptions = {},
  ) {
    this.max = options.maxAttempts ?? MAX_LOGIN_ATTEMPTS;
    this.windowMs = options.windowMs ?? LOGIN_WINDOW_MS;
    this.now = options.now ?? Date.now;
  }

  private async read(key: string): Promise<Counter | undefined> {
    const raw = await this.kv.get(key);
    if (!raw) return undefined;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isCounter(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  async check(clientKey: string): Promise<LimitDecision> {
    return decide(await this.read(RATE_PREFIX + (await digest(clientKey))), this.now(), this.max);
  }

  async recordFailure(clientKey: string): Promise<LimitDecision> {
    const key = RATE_PREFIX + (await digest(clientKey));
    const now = this.now();
    const current = await this.read(key);
    const live = current && current.resetAt > now ? current : undefined;
    const next: Counter = live
      ? { count: live.count + 1, resetAt: live.resetAt }
      : { count: 1, resetAt: now + this.windowMs };
    // KV requires a TTL of at least 60 seconds.
    const ttl = Math.max(60, Math.ceil((next.resetAt - now) / 1000));
    await this.kv.put(key, JSON.stringify(next), { expirationTtl: ttl });
    return decide(next, now, this.max);
  }

  async reset(clientKey: string): Promise<void> {
    await this.kv.delete(RATE_PREFIX + (await digest(clientKey)));
  }
}

let fallback: MemoryLoginLimiter | undefined;

/**
 * Choose the shared limiter available to this runtime: a bound KV namespace
 * (LOGIN_RATE_LIMIT_KV) is used when present, otherwise the private R2 bucket, otherwise
 * the per-process fallback.
 */
export function resolveLoginLimiter(env: unknown, bucket: ObjectBucket | undefined): LoginLimiter {
  const kv = (env as { LOGIN_RATE_LIMIT_KV?: KvNamespaceLike } | undefined)?.LOGIN_RATE_LIMIT_KV;
  if (kv && typeof kv.get === "function" && typeof kv.put === "function")
    return new KvLoginLimiter(kv);
  if (bucket) return new StorageLoginLimiter(bucket);
  fallback ??= new MemoryLoginLimiter();
  return fallback;
}
