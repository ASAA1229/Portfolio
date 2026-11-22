/**
 * Per-profile storage and AI usage summaries for the owner-only monitoring view (D4.16 / D4.18).
 *
 * Pure functions over the private indexes (the source of truth for media and documents) and the
 * AI usage day document, so each profile's numbers are computed only from records scoped to that
 * profile. Counters and sizes only: no filenames, alt text, resume content or visitor data.
 */
import { AI_USAGE_PROFILES, type AiUsageDay, type AiUsageProfile } from "@/lib/ai-usage";

export type ProfileStorageSummary = {
  images: { count: number; bytes: number; published: number; cap: number };
  resumes: { count: number; bytes: number; published: number; cap: number };
};

export type ProfileStorageReport = {
  profiles: Record<AiUsageProfile, ProfileStorageSummary>;
  /** Uploaded resumes not yet assigned to any profile. */
  unassignedResumes: { count: number; bytes: number };
};

type IndexedItem = { profileId?: string | undefined; size?: number; status: string };

function emptySummary(imageCap: number, resumeCap: number): ProfileStorageSummary {
  return {
    images: { count: 0, bytes: 0, published: 0, cap: imageCap },
    resumes: { count: 0, bytes: 0, published: 0, cap: resumeCap },
  };
}

function safeSize(item: IndexedItem): number {
  return typeof item.size === "number" && Number.isFinite(item.size) && item.size > 0
    ? item.size
    : 0;
}

export function summarizeProfileStorage(
  images: IndexedItem[],
  resumes: IndexedItem[],
  caps: { imagesPerProfile: number; resumesPerProfile: number },
): ProfileStorageReport {
  const profiles = Object.fromEntries(
    AI_USAGE_PROFILES.map((p) => [p, emptySummary(caps.imagesPerProfile, caps.resumesPerProfile)]),
  ) as Record<AiUsageProfile, ProfileStorageSummary>;
  const unassignedResumes = { count: 0, bytes: 0 };
  const known = (id: string | undefined): id is AiUsageProfile =>
    !!id && (AI_USAGE_PROFILES as readonly string[]).includes(id);

  for (const item of images) {
    if (!known(item.profileId)) continue;
    const bucket = profiles[item.profileId].images;
    bucket.count += 1;
    bucket.bytes += safeSize(item);
    if (item.status === "approved") bucket.published += 1;
  }
  for (const item of resumes) {
    if (!known(item.profileId)) {
      unassignedResumes.count += 1;
      unassignedResumes.bytes += safeSize(item);
      continue;
    }
    const bucket = profiles[item.profileId].resumes;
    bucket.count += 1;
    bucket.bytes += safeSize(item);
    if (item.status === "approved") bucket.published += 1;
  }
  return { profiles, unassignedResumes };
}

export type AiBudgetReport = {
  day: string;
  limit: number | null;
  /** Requests that reached the provider today, across all profiles (the cap is shared). */
  billableToday: number;
  remaining: number | null;
  byProfile: Record<AiUsageProfile, number>;
};

/** Today's budget position plus the per-profile request counters. */
export function summarizeAiBudget(
  today: AiUsageDay | undefined,
  day: string,
  limit: number | null,
): AiBudgetReport {
  const doc = today && today.day === day ? today : undefined;
  const billableToday = doc ? doc.byOutcome.ok + doc.byOutcome.upstream_error : 0;
  return {
    day,
    limit,
    billableToday,
    remaining: limit === null ? null : Math.max(0, limit - billableToday),
    byProfile: Object.fromEntries(
      AI_USAGE_PROFILES.map((p) => [p, doc ? doc.byProfile[p] : 0]),
    ) as Record<AiUsageProfile, number>,
  };
}
