/**
 * Publish history and rollback planning for admin-managed resumes (PORT-US-013).
 *
 * Every publication of a profile's resume appends an immutable snapshot of the
 * public fields to that profile's private history. Rolling back restores the
 * previous snapshot. Private review notes are never part of a snapshot.
 */

export type ProfileId = "abhishek" | "ammu" | "bava" | "sai";

export interface PublishedResumeSnapshot {
  resumeId: string;
  profileId: ProfileId;
  publishedAt: string;
  displayName: string;
  headline: string;
  summary: string;
  skills: string[];
  contact?: { email?: string; phone?: string; linkedin?: string; github?: string } | undefined;
  structuredSections?: unknown;
}

export interface PublishHistory {
  version: 1;
  profileId: ProfileId;
  entries: PublishedResumeSnapshot[];
}

export const MAX_HISTORY_ENTRIES = 10;
export const PUBLIC_PROFILE_IDS: readonly ProfileId[] = ["abhishek", "ammu", "bava", "sai"];

export function historyKey(profileId: ProfileId): string {
  return `private-admin/resumes/history/${profileId}.json`;
}

export function isPublicProfileId(value: unknown): value is ProfileId {
  return typeof value === "string" && (PUBLIC_PROFILE_IDS as readonly string[]).includes(value);
}

export function emptyHistory(profileId: ProfileId): PublishHistory {
  return { version: 1, profileId, entries: [] };
}

export function isPublishHistory(value: unknown, profileId: ProfileId): value is PublishHistory {
  if (!value || typeof value !== "object") return false;
  const history = value as Partial<PublishHistory>;
  return (
    history.version === 1 &&
    history.profileId === profileId &&
    Array.isArray(history.entries) &&
    history.entries.length <= MAX_HISTORY_ENTRIES &&
    history.entries.every(
      (entry) =>
        !!entry &&
        typeof entry.resumeId === "string" &&
        entry.profileId === profileId &&
        typeof entry.publishedAt === "string" &&
        typeof entry.displayName === "string" &&
        typeof entry.headline === "string" &&
        typeof entry.summary === "string" &&
        Array.isArray(entry.skills),
    )
  );
}

/** Public fields only: private review notes and file metadata never enter history. */
export function snapshotOf(
  record: {
    id: string;
    profileId?: string | undefined;
    displayName: string;
    headline: string;
    summary: string;
    skills: string[];
    contact?: PublishedResumeSnapshot["contact"];
    structuredSections?: unknown;
  },
  publishedAt: string,
): PublishedResumeSnapshot {
  if (!isPublicProfileId(record.profileId)) {
    throw new Error("Only resumes assigned to a public profile can be snapshotted.");
  }
  return {
    resumeId: record.id,
    profileId: record.profileId,
    publishedAt,
    displayName: record.displayName,
    headline: record.headline,
    summary: record.summary,
    skills: [...record.skills],
    ...(record.contact ? { contact: { ...record.contact } } : {}),
    ...(record.structuredSections !== undefined
      ? { structuredSections: structuredClone(record.structuredSections) }
      : {}),
  };
}

/** Append a publication, keeping only the newest MAX_HISTORY_ENTRIES. */
export function appendHistory(
  history: PublishHistory,
  snapshot: PublishedResumeSnapshot,
): PublishHistory {
  if (snapshot.profileId !== history.profileId) throw new Error("Snapshot profile mismatch.");
  return {
    ...history,
    entries: [...history.entries, snapshot].slice(-MAX_HISTORY_ENTRIES),
  };
}

export type RollbackPlan =
  | { ok: true; target: PublishedResumeSnapshot; remaining: PublishHistory }
  | { ok: false; reason: string };

/**
 * Decide what a rollback restores.
 * - Something is published: restore the entry before the current publication.
 * - Nothing is published (it was unpublished): restore the latest publication.
 */
export function planRollback(
  history: PublishHistory,
  currentlyPublishedResumeId: string | undefined,
): RollbackPlan {
  const entries = history.entries;
  if (entries.length === 0) return { ok: false, reason: "There is no publish history for this profile yet." };
  if (!currentlyPublishedResumeId) {
    const target = entries[entries.length - 1]!;
    return { ok: true, target, remaining: history };
  }
  const last = entries[entries.length - 1]!;
  const head = last.resumeId === currentlyPublishedResumeId ? entries.length - 1 : entries.length;
  if (head === 0) return { ok: false, reason: "There is no earlier published version to roll back to." };
  const target = entries[head - 1]!;
  return { ok: true, target, remaining: { ...history, entries: entries.slice(0, head) } };
}
