import { describe, expect, it } from "vitest";
import {
  recoverPendingStorageTransaction,
  runStorageTransaction,
  storageRecoveryStatus,
  StorageTransactionError,
  type RecoveryBucket,
} from "@/lib/storage-recovery";

class MemoryBucket implements RecoveryBucket {
  readonly values = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  failTarget: string | null = null;
  failRollback: string | null = null;
  failTargetOnce = true;
  failRollbackOnce = true;

  async get(key: string) {
    const item = this.values.get(key);
    if (!item) return null;
    const bytes = item.bytes.slice();
    return {
      httpMetadata: item.contentType ? { contentType: item.contentType } : undefined,
      arrayBuffer: async () => bytes.slice().buffer,
    };
  }
  async put(key: string, value: ArrayBuffer | string | Uint8Array, options?: { httpMetadata?: { contentType?: string } }) {
    if (key === this.failTarget && this.failTargetOnce) {
      this.failTargetOnce = false;
      throw new Error("injected target failure");
    }
    if (key === this.failRollback && this.failRollbackOnce) {
      this.failRollbackOnce = false;
      throw new Error("injected rollback failure");
    }
    const bytes = typeof value === "string" ? new TextEncoder().encode(value)
      : value instanceof Uint8Array ? value.slice() : new Uint8Array(value.slice(0));
    this.values.set(key, { bytes, ...(options?.httpMetadata?.contentType ? { contentType: options.httpMetadata.contentType } : {}) });
  }
  async delete(key: string) { this.values.delete(key); }
  text(key: string) {
    const item = this.values.get(key);
    return item ? new TextDecoder().decode(item.bytes) : null;
  }
}

describe("durable storage recovery journal", () => {
  it("restores all prior objects after a later write fails", async () => {
    const bucket = new MemoryBucket();
    await bucket.put("private-admin/item.json", "before-private");
    await bucket.put("public/item.json", "before-public");
    bucket.failTarget = "public/item.json";
    await expect(runStorageTransaction(bucket, [
      { key: "private-admin/item.json", operation: "put", value: "after-private" },
      { key: "public/item.json", operation: "put", value: "after-public" },
    ])).rejects.toBeInstanceOf(StorageTransactionError);
    expect(bucket.text("private-admin/item.json")).toBe("before-private");
    expect(bucket.text("public/item.json")).toBe("before-public");
    expect((await storageRecoveryStatus(bucket)).pending).toBe(false);
  });

  it("retains a journal when compensation fails and completes recovery later", async () => {
    const bucket = new MemoryBucket();
    await bucket.put("private-admin/item.json", "before-private");
    await bucket.put("public/item.json", "before-public");
    bucket.failTarget = "public/item.json";
    bucket.failRollback = "private-admin/item.json";
    let failure: unknown;
    try {
      await runStorageTransaction(bucket, [
        { key: "private-admin/item.json", operation: "put", value: "after-private" },
        { key: "public/item.json", operation: "put", value: "after-public" },
      ]);
    } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(StorageTransactionError);
    expect((failure as StorageTransactionError).restored).toBe(false);
    expect((await storageRecoveryStatus(bucket)).pending).toBe(true);

    await expect(recoverPendingStorageTransaction(bucket)).resolves.toMatchObject({ recovered: true });
    expect(bucket.text("private-admin/item.json")).toBe("before-private");
    expect(bucket.text("public/item.json")).toBe("before-public");
    expect((await storageRecoveryStatus(bucket)).pending).toBe(false);
  });

  it("does not mutate target objects when recovery-journal preparation fails", async () => {
    const bucket = new MemoryBucket();
    await bucket.put("private-admin/item.json", "before");
    const originalPut = bucket.put.bind(bucket);
    bucket.put = async (key, value, options) => {
      if (key.startsWith("private-admin/recovery/")) throw new Error("journal storage unavailable");
      return originalPut(key, value, options);
    };
    await expect(runStorageTransaction(bucket, [
      { key: "private-admin/item.json", operation: "put", value: "after" },
    ])).rejects.toThrow();
    expect(bucket.text("private-admin/item.json")).toBe("before");
  });

  it("serializes overlapping transactions using the same bucket instance", async () => {
    const bucket = new MemoryBucket();
    await Promise.all([
      runStorageTransaction(bucket, [{ key: "a", operation: "put", value: "one" }]),
      runStorageTransaction(bucket, [{ key: "b", operation: "put", value: "two" }]),
    ]);
    expect(bucket.text("a")).toBe("one");
    expect(bucket.text("b")).toBe("two");
    expect((await storageRecoveryStatus(bucket)).pending).toBe(false);
  });
});
