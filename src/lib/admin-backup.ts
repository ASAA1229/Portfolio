/**
 * Owner backup / restore of portfolio admin metadata (PORT-US-041).
 *
 * A backup is a JSON document containing the CMS content documents, AI personas,
 * resume indexes, resume publish histories, the public approved-resume feed and
 * the image index. Binary originals (resume files, images) are not included; they
 * stay in private storage and are referenced by id. Restore only accepts known
 * keys and validates every document before anything is written.
 */
import { CONTENT_PROFILE_IDS, contentKey, isContentDocument } from "@/lib/cms-content";
import { PERSONA_PROFILE_IDS, isPersonaDocument, personaKey } from "@/lib/persona";
import { historyKey, isPublishHistory } from "@/lib/resume-publish-history";

export const BACKUP_FORMAT = "portfolio-admin-backup";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;

const RESUME_INDEX_KEY = "private-admin/resumes/index.json";
const IMAGE_INDEX_KEY = "private-admin/images/index.json";
const APPROVED_RESUMES_KEY = "public/approved-resumes.json";

type Validator = (value: unknown) => boolean;

const isPlainObject: Validator = (value) =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** Every key a backup may contain, with the validator applied on restore. */
export function backupKeyValidators(): Map<string, Validator> {
  const validators = new Map<string, Validator>();
  for (const profileId of CONTENT_PROFILE_IDS) {
    validators.set(contentKey(profileId), (value) => isContentDocument(value, profileId));
  }
  for (const profileId of PERSONA_PROFILE_IDS) {
    validators.set(personaKey(profileId), (value) => isPersonaDocument(value, profileId));
  }
  for (const profileId of ["abhishek", "ammu", "bava", "sai"] as const) {
    validators.set(historyKey(profileId), (value) => isPublishHistory(value, profileId));
  }
  validators.set(RESUME_INDEX_KEY, isPlainObject);
  validators.set(IMAGE_INDEX_KEY, isPlainObject);
  validators.set(APPROVED_RESUMES_KEY, isPlainObject);
  return validators;
}

export interface AdminBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  notice: string;
  entries: Record<string, unknown>;
}

interface JsonReader {
  get(key: string): Promise<{ json<T>(): Promise<T> } | null>;
}

export async function createBackup(storage: JsonReader, now = new Date()): Promise<AdminBackup> {
  const entries: Record<string, unknown> = {};
  for (const key of backupKeyValidators().keys()) {
    const object = await storage.get(key);
    if (object) entries[key] = await object.json<unknown>();
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    notice:
      "Private portfolio admin metadata. Contains unpublished drafts and review data; store securely. Binary resume and image originals are not included.",
    entries,
  };
}

/** Validate an uploaded backup completely before any write happens. */
export function validateBackup(
  value: unknown,
): { ok: true; entries: [string, unknown][] } | { ok: false; errors: string[] } {
  if (!isPlainObject(value)) return { ok: false, errors: ["Backup must be a JSON object."] };
  const backup = value as Partial<AdminBackup>;
  const errors: string[] = [];
  if (backup.format !== BACKUP_FORMAT) errors.push("This is not a portfolio admin backup.");
  if (backup.version !== BACKUP_VERSION) errors.push("Unsupported backup version.");
  if (!isPlainObject(backup.entries)) errors.push("Backup entries are missing.");
  if (errors.length) return { ok: false, errors };
  const validators = backupKeyValidators();
  const entries = Object.entries(backup.entries as Record<string, unknown>);
  for (const [key, entry] of entries) {
    const validate = validators.get(key);
    if (!validate) errors.push(`Unknown storage key in backup: ${key}`);
    else if (!validate(entry)) errors.push(`Invalid document for ${key}.`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, entries };
}
