/**
 * AI usage accounting and daily budget control (D4.12).
 *
 * Every public AI chat request is counted per UTC day in the private bucket
 * (`private-admin/ai-usage/YYYY-MM-DD.json`). Only counters are stored: no prompts, answers,
 * client identifiers or profile content. The owner can set PORTFOLIO_AI_DAILY_LIMIT to cap the
 * number of AI requests accepted per day across all profiles; once reached, chat answers with a
 * recoverable 429 and the UI keeps using its offline, profile-grounded answers until the next day.
 *
 * Writes are batched in memory and flushed with an etag compare-and-set, so a busy chat does not
 * cost one storage write per message. A flush that loses a race retries; a flush that cannot
 * complete keeps the pending counts for the next attempt and never blocks or fails a chat request.
 */
import type { ObjectBucket } from "@/lib/storage-adapter";

export const AI_USAGE_PREFIX = "private-admin/ai-usage/";
export const AI_USAGE_PROFILES = ["abhishek", "ammu", "bava", "sai"] as const;
export type AiUsageProfile = (typeof AI_USAGE_PROFILES)[number];

export const AI_USAGE_OUTCOMES = [
  "ok",
  "rate_limited",
  "budget_exhausted",
  "not_configured",
  "invalid",
  "upstream_error",
] as const;
export type AiUsageOutcome = (typeof AI_USAGE_OUTCOMES)[number];

export interface AiUsageDay {
  day: string;
  total: number;
  byOutcome: Record<AiUsageOutcome, number>;
  byProfile: Record<AiUsageProfile, number>;
  updatedAt: string;
}

export interface AiUsageEvent {
  profile: AiUsageProfile;
  outcome: AiUsageOutcome;
}

/** UTC day key, e.g. 2026-11-22. */
export function usageDayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function emptyDay(day: string): AiUsageDay {
  return {
    day,
    total: 0,
    byOutcome: Object.fromEntries(AI_USAGE_OUTCOMES.map((o) => [o, 0])) as Record<
      AiUsageOutcome,
      number
    >,
    byProfile: Object.fromEntries(AI_USAGE_PROFILES.map((p) => [p, 0])) as Record<
      AiUsageProfile,
      number
    >,
    updatedAt: new Date(0).toISOString(),
  };
}

function nonNegativeInt(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/** Parse a stored document defensively; corrupt or foreign data collapses to an empty day. */
export function parseUsageDay(raw: unknown, day: string): AiUsageDay {
  const out = emptyDay(day);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const record = raw as Record<string, unknown>;
  const byOutcome = (record["byOutcome"] ?? {}) as Record<string, unknown>;
  const byProfile = (record["byProfile"] ?? {}) as Record<string, unknown>;
  for (const outcome of AI_USAGE_OUTCOMES)
    out.byOutcome[outcome] = nonNegativeInt(byOutcome[outcome]);
  for (const profile of AI_USAGE_PROFILES)
    out.byProfile[profile] = nonNegativeInt(byProfile[profile]);
  out.total = nonNegativeInt(record["total"]);
  if (typeof record["updatedAt"] === "string") out.updatedAt = record["updatedAt"];
  return out;
}

async function readDay(
  bucket: ObjectBucket,
  day: string,
): Promise<{ doc: AiUsageDay; etag: string | undefined }> {
  const object = await bucket.get(`${AI_USAGE_PREFIX}${day}.json`);
  if (!object) return { doc: emptyDay(day), etag: undefined };
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(await object.arrayBuffer()));
    return { doc: parseUsageDay(parsed, day), etag: object.etag };
  } catch {
    return { doc: emptyDay(day), etag: object.etag };
  }
}

/** Usage for the most recent `days` UTC days, newest first (days without data are omitted). */
export async function readAiUsage(
  bucket: ObjectBucket,
  days: number,
  now: number = Date.now(),
): Promise<AiUsageDay[]> {
  const out: AiUsageDay[] = [];
  const count = Math.min(Math.max(Math.floor(days), 1), 31);
  for (let offset = 0; offset < count; offset += 1) {
    const day = usageDayKey(now - offset * 86_400_000);
    const { doc, etag } = await readDay(bucket, day);
    if (etag !== undefined || doc.total > 0) out.push(doc);
  }
  return out;
}

/** The owner's daily request cap. Unset, blank, zero or invalid means "no cap". */
export function parseDailyLimit(raw: string | undefined): number | null {
  if (!raw || !/^\d{1,9}$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  return value > 0 ? value : null;
}

export type BudgetDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export function secondsUntilNextUtcDay(now: number): number {
  const next = Date.parse(`${usageDayKey(now)}T00:00:00.000Z`) + 86_400_000;
  return Math.max(1, Math.ceil((next - now) / 1000));
}

/**
 * Accumulates usage in memory and flushes it to the bucket in batches. One tracker per bucket
 * (see `usageTrackerFor`); `limit` decisions combine the stored total with not-yet-flushed counts.
 */
export class AiUsageTracker {
  private pending: AiUsageEvent[] = [];
  private flushing: Promise<void> | null = null;
  private lastFlush = 0;
  private cachedTotal: { day: string; total: number; at: number } | null = null;
  /** Billable requests seen by this isolate today: the bounded fallback when storage is unreadable. */
  private local: { day: string; count: number } = { day: "", count: 0 };

  constructor(
    private readonly bucket: ObjectBucket,
    private readonly options: { flushIntervalMs?: number; maxPending?: number } = {},
  ) {}

  private get flushIntervalMs(): number {
    return this.options.flushIntervalMs ?? 15_000;
  }

  private get maxPending(): number {
    return this.options.maxPending ?? 25;
  }

  /**
   * Is another AI request within today's cap? A storage failure never blocks chat outright: the cap then
   * applies approximately, to the requests this isolate has served today.
   */
  async checkBudget(limit: number | null, now: number = Date.now()): Promise<BudgetDecision> {
    if (limit === null) return { allowed: true };
    const day = usageDayKey(now);
    const pendingToday = this.pending.filter(
      (e) => e.outcome === "ok" || e.outcome === "upstream_error",
    ).length;
    try {
      if (!this.cachedTotal || this.cachedTotal.day !== day || now - this.cachedTotal.at > 10_000) {
        const { doc } = await readDay(this.bucket, day);
        this.cachedTotal = { day, total: this.billable(doc), at: now };
      }
    } catch (error) {
      console.error("AI usage budget unavailable; applying the per-isolate count.", error);
      const seen = this.local.day === day ? this.local.count : 0;
      return seen >= limit
        ? { allowed: false, retryAfterSeconds: secondsUntilNextUtcDay(now) }
        : { allowed: true };
    }
    if (this.cachedTotal.total + pendingToday >= limit) {
      return { allowed: false, retryAfterSeconds: secondsUntilNextUtcDay(now) };
    }
    return { allowed: true };
  }

  /** Requests that reached (or tried to reach) the AI provider count against the budget. */
  private billable(doc: AiUsageDay): number {
    return doc.byOutcome.ok + doc.byOutcome.upstream_error;
  }

  /** Queue one event; returns the flush promise when this call triggered one. */
  record(event: AiUsageEvent, now: number = Date.now()): Promise<void> | null {
    this.pending.push(event);
    if (event.outcome === "ok" || event.outcome === "upstream_error") {
      const day = usageDayKey(now);
      this.local = { day, count: (this.local.day === day ? this.local.count : 0) + 1 };
    }
    if (this.flushing) return null;
    if (this.pending.length >= this.maxPending || now - this.lastFlush >= this.flushIntervalMs) {
      return this.flush(now);
    }
    return null;
  }

  /** Write pending counts. Resolves even on failure; pending counts are kept for the next flush. */
  flush(now: number = Date.now()): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = this.doFlush(now).finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async doFlush(now: number): Promise<void> {
    this.lastFlush = now;
    const batch = this.pending;
    if (batch.length === 0) return;
    this.pending = [];
    const day = usageDayKey(now);
    try {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const { doc, etag } = await readDay(this.bucket, day);
        for (const event of batch) {
          doc.total += 1;
          doc.byOutcome[event.outcome] += 1;
          doc.byProfile[event.profile] += 1;
        }
        doc.updatedAt = new Date(now).toISOString();
        const written = await this.bucket.put(
          `${AI_USAGE_PREFIX}${day}.json`,
          JSON.stringify(doc),
          {
            httpMetadata: { contentType: "application/json; charset=utf-8" },
            onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" },
          },
        );
        if (written !== null) {
          this.cachedTotal = { day, total: this.billable(doc), at: now };
          return;
        }
        // Lost a race with another isolate: the loop re-reads and re-applies the batch.
      }
      throw new Error("AI usage counter stayed contended.");
    } catch (error) {
      this.pending = batch.concat(this.pending).slice(-500);
      console.error("AI usage accounting could not be saved; will retry.", error);
    }
  }

  /** Pending events not yet flushed (for the admin view so counts are not under-reported). */
  pendingCount(): number {
    return this.pending.length;
  }
}

const trackers = new WeakMap<object, AiUsageTracker>();

/** One tracker per bucket object so batching spans requests within an isolate. */
export function usageTrackerFor(bucket: ObjectBucket): AiUsageTracker {
  let tracker = trackers.get(bucket as object);
  if (!tracker) {
    tracker = new AiUsageTracker(bucket);
    trackers.set(bucket as object, tracker);
  }
  return tracker;
}

/** Map an /api/chat response status to a usage outcome. */
export function outcomeForChatStatus(status: number, configured: boolean): AiUsageOutcome {
  if (!configured && status === 503) return "not_configured";
  if (status >= 200 && status < 300) return "ok";
  if (status === 429) return "rate_limited";
  if (status >= 400 && status < 500) return "invalid";
  return "upstream_error";
}
