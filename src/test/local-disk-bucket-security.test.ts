// @vitest-environment node
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createLocalDiskBucket } from "@/lib/local-disk-bucket";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const directory of temporaryRoots.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("local disk bucket storage-root boundary", () => {
  it("rejects a configured storage root that is itself a symlink", async () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), "portfolio-disk-security-"));
    temporaryRoots.push(parent);
    const actualRoot = path.join(parent, "actual");
    const linkedRoot = path.join(parent, "linked");
    mkdirSync(actualRoot);
    symlinkSync(actualRoot, linkedRoot, "dir");

    const bucket = createLocalDiskBucket(linkedRoot);
    await expect(bucket.get("private/file.txt")).rejects.toThrow(/symbolic link/i);
    await expect(bucket.put("private/file.txt", "data")).rejects.toThrow(/symbolic link/i);
    await expect(bucket.delete("private/file.txt")).rejects.toThrow(/symbolic link/i);
    await expect(bucket.list("")).rejects.toThrow(/symbolic link/i);
  });

  it("rejects a storage root located beneath a symlinked parent directory", async () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), "portfolio-disk-parent-"));
    temporaryRoots.push(parent);
    const actualParent = path.join(parent, "actual-parent");
    const linkedParent = path.join(parent, "linked-parent");
    const storageRoot = path.join(linkedParent, "storage");
    mkdirSync(path.join(actualParent, "storage"), { recursive: true });
    symlinkSync(actualParent, linkedParent, "dir");

    const bucket = createLocalDiskBucket(storageRoot);
    await expect(bucket.get("private/file.txt")).rejects.toThrow(/symbolic link/i);
    await expect(bucket.put("private/file.txt", "data")).rejects.toThrow(/symbolic link/i);
    await expect(bucket.list("")).rejects.toThrow(/symbolic link/i);
  });
});
