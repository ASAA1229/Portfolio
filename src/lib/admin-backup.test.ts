// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  BACKUP_FORMAT,
  IMAGE_INDEX_KEY,
  RESUME_INDEX_KEY,
  createBackup,
  migrateStorage,
  restoreBackup,
  sha256Hex,
  validateBackup,
  type BackupStorage,
} from "@/lib/admin-backup";

const RESUME_ID = "resume-123456";
const RESUME_KEY = `private-admin/resumes/files/${RESUME_ID}`;

function storageWithResumeIndex(): BackupStorage {
  return {
    get: vi.fn(async (key: string) => {
      if (key !== RESUME_INDEX_KEY) return null;
      return {
        json: async () => [{ id: RESUME_ID }],
        arrayBuffer: async () => new TextEncoder().encode("[]").buffer,
      };
    }),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
}

function incompleteBackup() {
  return {
    format: BACKUP_FORMAT,
    version: 2,
    exportedAt: new Date(0).toISOString(),
    notice: "test",
    entries: { [RESUME_INDEX_KEY]: [{ id: RESUME_ID }] },
    files: {},
  };
}

describe("admin backup binary integrity", () => {
  it("rejects a v2 backup when a resume index references a missing original", async () => {
    const result = await validateBackup(incompleteBackup());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toContain(RESUME_KEY);
      expect(result.errors.join(" ")).toContain("Restore was not started");
    }
  });

  it("rejects a v2 backup when an image index references missing private/public files", async () => {
    const result = await validateBackup({
      format: BACKUP_FORMAT,
      version: 2,
      exportedAt: new Date(0).toISOString(),
      notice: "test",
      entries: {
        [IMAGE_INDEX_KEY]: [{ id: "image-123456", status: "approved" }],
      },
      files: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toContain("private-admin/images/files/image-123456");
      expect(result.errors.join(" ")).toContain("public/profile-images/image-123456");
    }
  });

  it("accepts a complete v2 backup only after every referenced binary digest matches", async () => {
    const bytes = new TextEncoder().encode("synthetic resume bytes");
    const binary = String.fromCharCode(...bytes);
    const result = await validateBackup({
      ...incompleteBackup(),
      files: {
        [RESUME_KEY]: {
          size: bytes.byteLength,
          sha256: await sha256Hex(bytes),
          base64: btoa(binary),
          contentType: "application/pdf",
        },
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.missingFiles).toEqual([]);
      expect(result.files).toHaveLength(1);
    }
  });

  it("does not write any storage keys when restore receives an incomplete validated payload", async () => {
    const storage = storageWithResumeIndex();
    const result = await restoreBackup(storage, {
      entries: [[RESUME_INDEX_KEY, [{ id: RESUME_ID }]]],
      files: [],
      missingFiles: [RESUME_KEY],
    });
    expect(result).toMatchObject({ ok: false, rolledBack: true });
    expect(storage.put).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("refuses to export an incomplete backup instead of silently omitting a referenced file", async () => {
    await expect(createBackup(storageWithResumeIndex())).rejects.toThrow(RESUME_KEY);
  });

  it("does not start storage migration when a source original is missing", async () => {
    const source = storageWithResumeIndex();
    const target = storageWithResumeIndex();
    const result = await migrateStorage(source, target);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(RESUME_KEY);
    expect(target.put).not.toHaveBeenCalled();
    expect(target.delete).not.toHaveBeenCalled();
  });
});
