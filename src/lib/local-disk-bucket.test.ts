// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, existsSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createLocalDiskBucket, isSafeStorageKey } from "@/lib/local-disk-bucket";

const roots: string[] = [];
const newBucket = () => {
  const root = mkdtempSync(join(tmpdir(), "portfolio-local-storage-"));
  roots.push(root);
  return { root, bucket: createLocalDiskBucket(root) };
};
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("local disk bucket (dev uploads)", () => {
  it("persists objects and content types across bucket instances (dev-server restarts)", async () => {
    const { root, bucket } = newBucket();
    await bucket.put("private-admin/images/files/abc", new Uint8Array([1, 2, 3]), {
      httpMetadata: { contentType: "image/png" },
    });
    await bucket.put("private-admin/images/index.json", JSON.stringify({ images: [1] }));

    const restarted = createLocalDiskBucket(root);
    const image = await restarted.get("private-admin/images/files/abc");
    expect(image?.httpMetadata?.contentType).toBe("image/png");
    expect(new Uint8Array(await image!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(await (await restarted.get("private-admin/images/index.json"))!.json()).toEqual({
      images: [1],
    });
    expect(readFileSync(join(root, "private-admin/images/files/abc"))).toHaveLength(3);
  });

  it("returns null for missing objects and deletes files with their metadata", async () => {
    const { root, bucket } = newBucket();
    expect(await bucket.get("public/profile-images/missing")).toBeNull();
    await bucket.put("public/profile-images/x", "data", {
      httpMetadata: { contentType: "image/webp" },
    });
    await bucket.delete("public/profile-images/x");
    expect(await bucket.get("public/profile-images/x")).toBeNull();
    expect(existsSync(join(root, "public/profile-images/x.meta.json"))).toBe(false);
  });

  it("refuses keys that could escape the storage folder", async () => {
    const { bucket } = newBucket();
    for (const key of ["../outside", "a/../../b", "/abs", "C:/x", "a//b", "x.meta.json", ""]) {
      expect(isSafeStorageKey(key), key).toBe(false);
    }
    await expect(bucket.put("../outside", "x")).rejects.toThrow(/Unsafe storage key/);
    expect(isSafeStorageKey("private-admin/resumes/files/2b1c-uuid")).toBe(true);
  });
});

  it.skipIf(process.platform === "win32")(
    "does not follow a storage-key symlink outside the configured root",
    async () => {
      const { root, bucket } = newBucket();
      const outside = mkdtempSync(join(tmpdir(), "portfolio-outside-"));
      try {
        writeFileSync(join(outside, "secret.txt"), "must remain outside");
        symlinkSync(outside, join(root, "linked"), "dir");
        await expect(bucket.get("linked/secret.txt")).rejects.toThrow();
        await expect(bucket.put("linked/overwritten.txt", "outside write")).rejects.toThrow();
        expect(existsSync(join(outside, "overwritten.txt"))).toBe(false);
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }
    },
  );
