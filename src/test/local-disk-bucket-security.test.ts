// @vitest-environment node
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createLocalDiskBucket } from "@/lib/local-disk-bucket";

const temporaryRoots: string[] = [];

function temporaryDirectory() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "portfolio-disk-security-"));
  temporaryRoots.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryRoots.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("local disk bucket symlink boundaries", () => {
  it("rejects a configured storage root that is itself a symlink", async () => {
    const parent = temporaryDirectory();
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

  it("rejects a symlink in a key path before reading, writing, or deleting", async () => {
    const parent = temporaryDirectory();
    const root = path.join(parent, "root");
    const outside = path.join(parent, "outside");
    mkdirSync(root);
    mkdirSync(outside);
    writeFileSync(path.join(outside, "secret.txt"), "outside data");
    symlinkSync(outside, path.join(root, "linked"), "dir");

    const bucket = createLocalDiskBucket(root);
    await expect(bucket.get("linked/secret.txt")).rejects.toThrow(/symbolic link/i);
    await expect(bucket.put("linked/new.txt", "data")).rejects.toThrow(/symbolic link/i);
    await expect(bucket.delete("linked/secret.txt")).rejects.toThrow(/symbolic link/i);
    expect(await bucket.list("linked/")).toEqual([]);
  });
});
