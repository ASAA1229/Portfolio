/**
 * Owner backup / restore / migration of portfolio admin data (PORT-US-041, P-E07).
 *
 * Version 2 backups contain both JSON documents (CMS content, personas, resume
 * index + publish histories, approved-resume feed, image index, admin audit log)
 * and the binary files they reference (private resume originals, private image
 * originals and published image copies), each with a SHA-256 digest.
 *
 * Restore validates everything first, then writes binaries before the indexes
 * that reference them, and rolls every touched key back to its previous value if
 * any write fails — so a failed restore never leaves indexes pointing at missing
 * files. Version 1 (metadata-only) backups are still accepted.
 */
import { CONTENT_PROFILE_IDS, contentKey, isContentDocument } from "@/lib/cms-content";
import { PERSONA_PROFILE_IDS, isPersonaDocument, personaKey } from "@/lib/persona";
import { historyKey, isPublishHistory } from "@/lib/resume-publish-history";
import { AUDIT_LOG_KEY } from "@/lib/admin-audit";

export const BACKUP_FORMAT = "portfolio-admin-backup";
export const BACKUP_VERSION = 2;
/** Workers accept request bodies up to 100 MB; keep a margin for JSON/base64 overhead. */
export const MAX_BACKUP_BYTES = 95 * 1024 * 1024;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

export const RESUME_INDEX_KEY = "private-admin/resumes/index.json";
export const IMAGE_INDEX_KEY = "private-admin/images/index.json";
const APPROVED_RESUMES_KEY = "public/approved-resumes.json";

const RESUME_FILE_PREFIX = "private-admin/resumes/files/";
const IMAGE_FILE_PREFIX = "private-admin/images/files/";
const PUBLIC_IMAGE_PREFIX = "public/profile-images/";
const FILE_KEY = new RegExp(
  `^(?:${RESUME_FILE_PREFIX}|${IMAGE_FILE_PREFIX}|${PUBLIC_IMAGE_PREFIX})[A-Za-z0-9-]{8,64}$`,
);

type Validator = (value: unknown) => boolean;

const isPlainObject: Validator = (value) =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** Indexes are arrays of records with unique string ids. */
const isIdIndex: Validator = (value) => {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  for (const record of value) {
    const id = (record as { id?: unknown } | null)?.id;
    if (!isPlainObject(record) || typeof id !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(id)) {
      return false;
    }
    if (ids.has(id)) return false;
    ids.add(id);
  }
  return true;
};

const isAuditLogDocument: Validator = (value) =>
  isPlainObject(value) &&
  (value as { version?: unknown }).version === 1 &&
  Array.isArray((value as { entries?: unknown }).entries);

/** Every JSON document key a backup may contain, with the validator applied on restore. */
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
  validators.set(RESUME_INDEX_KEY, isIdIndex);
  validators.set(IMAGE_INDEX_KEY, isIdIndex);
  validators.set(APPROVED_RESUMES_KEY, (value) => isPlainObject(value) || Array.isArray(value));
  validators.set(AUDIT_LOG_KEY, isAuditLogDocument);
  return validators;
}

export interface BackupFile {
  contentType?: string;
  size: number;
  sha256: string;
  base64: string;
}

export interface AdminBackup {
  format: typeof BACKUP_FORMAT;
  version: 1 | 2;
  exportedAt: string;
  notice: string;
  entries: Record<string, unknown>;
  files?: Record<string, BackupFile>;
}

interface StoredObjectLike {
  json<T>(): Promise<T>;
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string | undefined };
}

export interface BackupStorage {
  get(key: string): Promise<StoredObjectLike | null>;
  put(
    key: string,
    value: ArrayBuffer | string | Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Binary keys referenced by the resume and image indexes. */
export function referencedFileKeys(entries: Record<string, unknown>): string[] {
  const keys = new Set<string>();
  const resumes = entries[RESUME_INDEX_KEY];
  if (Array.isArray(resumes)) {
    for (const record of resumes) {
      const id = (record as { id?: unknown }).id;
      if (typeof id === "string") keys.add(`${RESUME_FILE_PREFIX}${id}`);
    }
  }
  const images = entries[IMAGE_INDEX_KEY];
  if (Array.isArray(images)) {
    for (const record of images) {
      const { id, status } = record as { id?: unknown; status?: unknown };
      if (typeof id !== "string") continue;
      keys.add(`${IMAGE_FILE_PREFIX}${id}`);
      if (status === "approved") keys.add(`${PUBLIC_IMAGE_PREFIX}${id}`);
    }
  }
  return [...keys].filter((key) => FILE_KEY.test(key)).sort();
}

export async function createBackup(storage: BackupStorage, now = new Date()): Promise<AdminBackup> {
  const entries: Record<string, unknown> = {};
  for (const key of backupKeyValidators().keys()) {
    const object = await storage.get(key);
    if (object) entries[key] = await object.json<unknown>();
  }
  const files: Record<string, BackupFile> = {};
  for (const key of referencedFileKeys(entries)) {
    const object = await storage.get(key);
    if (!object) {
      throw new Error(
        `Backup is incomplete: referenced storage file is missing (${key}). No backup was exported.`,
      );
    }
    const bytes = new Uint8Array(await object.arrayBuffer());
    files[key] = {
      ...(object.httpMetadata?.contentType ? { contentType: object.httpMetadata.contentType } : {}),
      size: bytes.byteLength,
      sha256: await sha256Hex(bytes),
      base64: toBase64(bytes),
    };
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    notice:
      "Private portfolio admin backup: drafts, review data, resume originals and images. Store securely.",
    entries,
    files,
  };
}

export interface ValidatedBackup {
  entries: [string, unknown][];
  files: [string, { bytes: Uint8Array; contentType?: string }][];
  missingFiles: string[];
}

/** Validate an uploaded backup completely (documents, file keys, sizes, digests) before any write. */
export async function validateBackup(
  value: unknown,
): Promise<({ ok: true } & ValidatedBackup) | { ok: false; errors: string[] }> {
  if (!isPlainObject(value)) return { ok: false, errors: ["Backup must be a JSON object."] };
  const backup = value as Partial<AdminBackup>;
  const errors: string[] = [];
  if (backup.format !== BACKUP_FORMAT) errors.push("This is not a portfolio admin backup.");
  if (backup.version !== 1 && backup.version !== 2) errors.push("Unsupported backup version.");
  if (!isPlainObject(backup.entries)) errors.push("Backup entries are missing.");
  if (backup.files !== undefined && !isPlainObject(backup.files))
    errors.push("Backup files are invalid.");
  if (errors.length) return { ok: false, errors };

  const validators = backupKeyValidators();
  const entryMap = backup.entries as Record<string, unknown>;
  const entries = Object.entries(entryMap);
  for (const [key, entry] of entries) {
    const validate = validators.get(key);
    if (!validate) errors.push(`Unknown storage key in backup: ${key}`);
    else if (!validate(entry)) errors.push(`Invalid document for ${key}.`);
  }

  const files: ValidatedBackup["files"] = [];
  for (const [key, raw] of Object.entries(backup.files ?? {})) {
    const file = raw as Partial<BackupFile>;
    if (!FILE_KEY.test(key)) {
      errors.push(`Unknown file key in backup: ${key}`);
      continue;
    }
    if (typeof file.base64 !== "string" || typeof file.sha256 !== "string") {
      errors.push(`File ${key} is malformed.`);
      continue;
    }
    const bytes = fromBase64(file.base64);
    if (!bytes || bytes.byteLength !== file.size || bytes.byteLength > MAX_FILE_BYTES) {
      errors.push(`File ${key} has an invalid size.`);
      continue;
    }
    if ((await sha256Hex(bytes)) !== file.sha256.toLowerCase()) {
      errors.push(`File ${key} failed its SHA-256 check.`);
      continue;
    }
    files.push([
      key,
      {
        bytes,
        ...(typeof file.contentType === "string"
          ? { contentType: file.contentType.slice(0, 100) }
          : {}),
      },
    ]);
  }
  if (errors.length) return { ok: false, errors };

  // Version 1 backups carry no binaries; references stay pointing at existing storage.
  const provided = new Set(files.map(([key]) => key));
  const missingFiles =
    backup.version === 2 ? referencedFileKeys(entryMap).filter((key) => !provided.has(key)) : [];
  if (missingFiles.length) {
    const preview = missingFiles.slice(0, 5).join(", ");
    const remainder = missingFiles.length > 5 ? ` (+${missingFiles.length - 5} more)` : "";
    errors.push(
      `Backup is incomplete: ${missingFiles.length} referenced file(s) are missing: ${preview}${remainder}. Restore was not started.`,
    );
    return { ok: false, errors };
  }
  return { ok: true, entries, files, missingFiles };
}

/**
 * Apply a validated backup: binaries first, then documents (indexes last). On any
 * failure every touched key is restored to its previous bytes (or deleted if it
 * did not exist) in reverse order.
 */
export async function restoreBackup(
  storage: BackupStorage,
  backup: ValidatedBackup,
): Promise<{ ok: true; restored: string[] } | { ok: false; error: string; rolledBack: boolean }> {
  // Defensive guard for callers that construct ValidatedBackup directly instead
  // of using validateBackup. Never replace an index without all referenced files.
  if (backup.missingFiles.length) {
    const preview = backup.missingFiles.slice(0, 5).join(", ");
    const remainder =
      backup.missingFiles.length > 5 ? ` (+${backup.missingFiles.length - 5} more)` : "";
    return {
      ok: false,
      error: `Backup is incomplete: ${backup.missingFiles.length} referenced file(s) are missing: ${preview}${remainder}.`,
      rolledBack: true,
    };
  }
  const indexKeys = new Set([RESUME_INDEX_KEY, IMAGE_INDEX_KEY, APPROVED_RESUMES_KEY]);
  const documents = [...backup.entries].sort(
    ([a], [b]) => Number(indexKeys.has(a)) - Number(indexKeys.has(b)),
  );
  const writes: { key: string; value: Uint8Array | string; contentType?: string }[] = [
    ...backup.files.map(([key, file]) => ({
      key,
      value: file.bytes,
      ...(file.contentType ? { contentType: file.contentType } : {}),
    })),
    ...documents.map(([key, value]) => ({
      key,
      value: JSON.stringify(value),
      contentType: "application/json; charset=utf-8",
    })),
  ];

  const previous: { key: string; bytes: Uint8Array | null; contentType?: string }[] = [];
  const restored: string[] = [];
  try {
    for (const write of writes) {
      const existing = await storage.get(write.key);
      previous.push({
        key: write.key,
        bytes: existing ? new Uint8Array(await existing.arrayBuffer()) : null,
        ...(existing?.httpMetadata?.contentType
          ? { contentType: existing.httpMetadata.contentType }
          : {}),
      });
      await storage.put(write.key, write.value, {
        ...(write.contentType ? { httpMetadata: { contentType: write.contentType } } : {}),
      });
      restored.push(write.key);
    }
    return { ok: true, restored };
  } catch (error) {
    let rolledBack = true;
    for (const snapshot of [...previous].reverse()) {
      try {
        if (snapshot.bytes) {
          await storage.put(snapshot.key, snapshot.bytes, {
            ...(snapshot.contentType
              ? { httpMetadata: { contentType: snapshot.contentType } }
              : {}),
          });
        } else {
          await storage.delete(snapshot.key);
        }
      } catch {
        rolledBack = false;
      }
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Storage write failed.",
      rolledBack,
    };
  }
}

/** Copy all admin data from one storage adapter to another (owner-initiated migration). */
export async function migrateStorage(
  source: BackupStorage,
  target: BackupStorage,
): Promise<
  | { ok: true; documents: number; files: number; missingFiles: string[] }
  | { ok: false; error: string; rolledBack?: boolean }
> {
  let backup: AdminBackup;
  try {
    backup = await createBackup(source);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not create a complete source backup.",
      rolledBack: true,
    };
  }
  const validated = await validateBackup(backup);
  if (!validated.ok) return { ok: false, error: validated.errors.join(" "), rolledBack: true };
  const result = await restoreBackup(target, validated);
  if (!result.ok) return { ok: false, error: result.error, rolledBack: result.rolledBack };
  return {
    ok: true,
    documents: validated.entries.length,
    files: validated.files.length,
    missingFiles: validated.missingFiles,
  };
}
