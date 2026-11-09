/**
 * Publish history and rollback planning for admin-managed resumes (PORT-US-013).
 *
 * History is append-only (PORT-US-036): every publication appends an immutable
 * snapshot of the public fields, and a rollback appends a "rollback" entry that
 * carries the restored snapshot. Nothing is trimmed or rewritten except the oldest
 * entries beyond the retention cap. The currently effective version is derived by
 * replaying the log. Private review notes are never part of a snapshot.
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
  /** "publish" (default for legacy entries) or "rollback". */
  kind?: "publish" | "rollback";
  /** For rollback entries: publishedAt of the snapshot that was restored. */
  restoredPublishedAt?: string;
}

export interface PublishHistory {
  version: 1;
  profileId: ProfileId;
  entries: PublishedResumeSnapshot[];
}

/** Retention cap: the oldest entries beyond this are dropped (never newer ones). */
export const MAX_HISTORY_ENTRIES = 50;
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

type KnownField =
  | "resumeId"
  | "profileId"
  | "publishedAt"
  | "displayName"
  | "headline"
  | "summary"
  | "skills"
  | "kind"
  | "restoredPublishedAt"
  | "contact"
  | "structuredSections"
  | "version"
  | "entries";
type LooseRecord = Record<string, unknown> & Partial<Record<KnownField, unknown>>;

function isRecord(value: unknown): value is LooseRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const CONTACT_FIELDS = new Set(["email", "phone", "linkedin", "github"]);
const STRUCTURED_FIELDS = new Set([
  "title",
  "organization",
  "role",
  "location",
  "startDate",
  "endDate",
  "description",
  "technologies",
  "url",
  "credentialId",
  "grade",
]);
const STRUCTURED_SECTIONS = ["experience", "education", "projects", "certifications"] as const;

function isValidContact(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value) || Object.keys(value).some((key) => !CONTACT_FIELDS.has(key))) return false;
  return Object.values(value).every((field) => typeof field === "string" && field.length <= 320);
}

function isValidStructuredEntry(value: unknown): boolean {
  if (typeof value === "string") return value.length <= 2000;
  if (!isRecord(value) || Object.keys(value).some((key) => !STRUCTURED_FIELDS.has(key)))
    return false;
  for (const [key, field] of Object.entries(value)) {
    if (key === "technologies") {
      if (
        !Array.isArray(field) ||
        field.length > 30 ||
        !field.every((item) => typeof item === "string" && item.length <= 80)
      )
        return false;
    } else if (typeof field !== "string" || field.length > (key === "description" ? 2000 : 320)) {
      return false;
    }
  }
  return true;
}

function isValidStructuredSections(value: unknown): boolean {
  if (value === undefined) return true;
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !(STRUCTURED_SECTIONS as readonly string[]).includes(key))
  ) {
    return false;
  }
  return Object.entries(value).every(
    ([section, entries]) =>
      (STRUCTURED_SECTIONS as readonly string[]).includes(section) &&
      Array.isArray(entries) &&
      entries.length <= 40 &&
      entries.every(isValidStructuredEntry),
  );
}

function isValidHistoryEntry(
  entry: unknown,
  profileId: ProfileId,
): entry is PublishedResumeSnapshot {
  if (!isRecord(entry)) return false;
  if (
    typeof entry.resumeId !== "string" ||
    !entry.resumeId.trim() ||
    entry.resumeId.length > 160 ||
    entry.profileId !== profileId ||
    typeof entry.publishedAt !== "string" ||
    !Number.isFinite(Date.parse(entry.publishedAt)) ||
    typeof entry.displayName !== "string" ||
    entry.displayName.length > 120 ||
    typeof entry.headline !== "string" ||
    entry.headline.length > 240 ||
    typeof entry.summary !== "string" ||
    entry.summary.length > 6000 ||
    !Array.isArray(entry.skills) ||
    entry.skills.length > 20 ||
    !entry.skills.every(
      (skill) => typeof skill === "string" && skill.trim().length > 0 && skill.length <= 80,
    ) ||
    (entry.kind !== undefined && entry.kind !== "publish" && entry.kind !== "rollback") ||
    (entry.kind === "rollback" &&
      (typeof entry.restoredPublishedAt !== "string" ||
        !Number.isFinite(Date.parse(entry.restoredPublishedAt)))) ||
    (entry.restoredPublishedAt !== undefined && typeof entry.restoredPublishedAt !== "string") ||
    !isValidContact(entry.contact) ||
    !isValidStructuredSections(entry.structuredSections)
  )
    return false;
  return true;
}

export function isPublishHistory(value: unknown, profileId: ProfileId): value is PublishHistory {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    value.profileId === profileId &&
    Array.isArray(value.entries) &&
    value.entries.length <= MAX_HISTORY_ENTRIES &&
    value.entries.every((entry) => isValidHistoryEntry(entry, profileId))
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

/** Append an entry (publication or rollback); only the oldest entries beyond the cap are dropped. */
export function appendHistory(
  history: PublishHistory,
  snapshot: PublishedResumeSnapshot,
): PublishHistory {
  if (snapshot.profileId !== history.profileId) throw new Error("Snapshot profile mismatch.");
  const entry: PublishedResumeSnapshot = { ...snapshot, kind: snapshot.kind ?? "publish" };
  return {
    ...history,
    entries: [...history.entries, entry].slice(-MAX_HISTORY_ENTRIES),
  };
}

/**
 * Replay the append-only log into the stack of effective versions (oldest first).
 * A rollback entry pops back to the restored version; if that version was dropped
 * by retention, the rollback entry's own snapshot becomes the base.
 */
export function effectiveStack(history: PublishHistory): PublishedResumeSnapshot[] {
  const stack: PublishedResumeSnapshot[] = [];
  for (const entry of history.entries) {
    if (entry.kind === "rollback") {
      const index = stack
        .map((item) => item.publishedAt)
        .lastIndexOf(entry.restoredPublishedAt ?? "");
      if (index >= 0) stack.splice(index + 1);
      else
        stack.splice(0, stack.length, {
          ...entry,
          kind: "publish",
          publishedAt: entry.restoredPublishedAt ?? entry.publishedAt,
        });
    } else {
      stack.push(entry);
    }
  }
  return stack;
}

export type RollbackPlan =
  | { ok: true; target: PublishedResumeSnapshot; next: PublishHistory }
  | { ok: false; reason: string };

/**
 * Decide what a rollback restores and the history entry it appends.
 * - Something is published: restore the effective version before the current one.
 * - Nothing is published (after an unpublish): restore the latest effective version.
 */
export function planRollback(
  history: PublishHistory,
  currentlyPublishedResumeId: string | undefined,
  now: string = new Date().toISOString(),
): RollbackPlan {
  const stack = effectiveStack(history);
  if (stack.length === 0)
    return { ok: false, reason: "There is no publish history for this profile yet." };
  const top = stack[stack.length - 1]!;
  let target: PublishedResumeSnapshot;
  if (!currentlyPublishedResumeId || top.resumeId !== currentlyPublishedResumeId) {
    target = top;
  } else {
    if (stack.length < 2)
      return { ok: false, reason: "There is no earlier published version to roll back to." };
    target = stack[stack.length - 2]!;
  }
  const next = appendHistory(history, {
    ...target,
    kind: "rollback",
    publishedAt: now,
    restoredPublishedAt: target.publishedAt,
  });
  return { ok: true, target, next };
}

/** publishedAt of the version a rollback would restore, for the admin list. */
export function rollbackTargetPublishedAt(
  history: PublishHistory,
  currentResumeId: string | null,
): string | null {
  const plan = planRollback(history, currentResumeId ?? undefined);
  return plan.ok ? plan.target.publishedAt : null;
}

/** Retention when a resume is deleted: its history entries keep only non-content metadata. */
export function redactDeletedResume(history: PublishHistory, resumeId: string): PublishHistory {
  return {
    ...history,
    entries: history.entries.map((entry) =>
      entry.resumeId === resumeId
        ? {
            resumeId: entry.resumeId,
            profileId: entry.profileId,
            publishedAt: entry.publishedAt,
            displayName: "[deleted resume]",
            headline: "",
            summary: "",
            skills: [],
            ...(entry.kind ? { kind: entry.kind } : {}),
            ...(entry.restoredPublishedAt
              ? { restoredPublishedAt: entry.restoredPublishedAt }
              : {}),
          }
        : entry,
    ),
  };
}
