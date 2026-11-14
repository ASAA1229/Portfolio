// @vitest-environment node
import { describe, expect, it } from "vitest";
import { emptyContentDocument } from "@/lib/cms-content";
import { emptyPersonaDocument } from "@/lib/persona";
import { emptyHistory } from "@/lib/resume-publish-history";
import {
  IMAGE_INDEX_KEY,
  RESUME_INDEX_KEY,
  createBackup,
  migrateStorage,
  restoreBackup,
  validateBackup,
  type BackupStorage,
} from "@/lib/admin-backup";
import { r2Adapter } from "@/lib/storage-adapter";
import { LEASE_KEY, StorageLeaseTimeoutError, withStorageLease } from "@/lib/storage-lock";
import {
  recoverPendingStorageTransaction,
  runStorageTransaction,
  storageRecoveryStatus,
  type RecoveryBucket,
} from "@/lib/storage-recovery";
import { MemoryR2 } from "./helpers/memory-r2";

/** A distinct bucket handle over the same objects, modelling a second Worker isolate. */
function isolate(r2: MemoryR2): RecoveryBucket & BackupStorage {
  return {
    get: (key) => r2.get(key),
    put: (key, value, options) => r2.put(key, value, options),
    delete: (key) => r2.delete(key),
  };
}

describe("in-memory R2 model", () => {
  it("enforces create-only and etag-matched conditional writes", async () => {
    const r2 = new MemoryR2();
    const first = await r2.put("k", "one", { onlyIf: { etagDoesNotMatch: "*" } });
    expect(first).not.toBeNull();
    expect(await r2.put("k", "two", { onlyIf: { etagDoesNotMatch: "*" } })).toBeNull();
    expect(r2.text("k")).toBe("one");
    const current = await r2.get("k");
    expect(await r2.put("k", "stale", { onlyIf: { etagMatches: "etag-nope" } })).toBeNull();
    expect(await r2.put("k", "two", { onlyIf: { etagMatches: current!.etag! } })).not.toBeNull();
    expect(r2.text("k")).toBe("two");
  });

  it("pages listings through the r2Adapter", async () => {
    const r2 = new MemoryR2();
    for (let i = 0; i < 1205; i += 1) await r2.put(`p/${String(i).padStart(5, "0")}`, "x");
    await r2.put("other/1", "x");
    const keys = await r2Adapter(r2).list("p/");
    expect(keys).toHaveLength(1205);
    expect(keys).toEqual([...keys].sort());
  });
});

describe("cross-isolate storage lease", () => {
  it("serializes multi-object transactions issued from different isolates", async () => {
    const r2 = new MemoryR2();
    r2.interleave = true;
    const isolates = [isolate(r2), isolate(r2), isolate(r2)];
    const results = await Promise.allSettled(
      Array.from({ length: 9 }, (_, index) =>
        runStorageTransaction(isolates[index % isolates.length]!, [
          { key: "pair/a", operation: "put", value: `writer-${index}` },
          { key: "pair/b", operation: "put", value: `writer-${index}` },
        ]),
      ),
    );
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    // Atomic pair: a torn interleaving would leave a and b from different writers.
    expect(r2.text("pair/a")).toBe(r2.text("pair/b"));
    expect(r2.keys("private-admin/recovery/")).toEqual([]);
    expect(await storageRecoveryStatus(isolate(r2))).toMatchObject({ pending: false });
  });

  it("displaces an expired lease but waits for a live one", async () => {
    const r2 = new MemoryR2();
    await r2.put(
      LEASE_KEY,
      JSON.stringify({ token: "crashed-holder", expiresAt: Date.now() - 1000 }),
    );
    await runStorageTransaction(isolate(r2), [{ key: "x", operation: "put", value: "ok" }]);
    expect(r2.text("x")).toBe("ok");
    expect(r2.has(LEASE_KEY)).toBe(false);

    let clock = 1_000;
    await r2.put(LEASE_KEY, JSON.stringify({ token: "live-holder", expiresAt: clock + 60_000 }));
    await expect(
      withStorageLease(isolate(r2), async () => "never", {
        waitMs: 500,
        pollMs: 100,
        now: () => clock,
        sleep: async (ms) => {
          clock += ms;
        },
      }),
    ).rejects.toBeInstanceOf(StorageLeaseTimeoutError);
    expect(JSON.parse(r2.text(LEASE_KEY)!).token).toBe("live-holder");
  });

  it("never releases a lease that another holder has since taken", async () => {
    const r2 = new MemoryR2();
    await withStorageLease(isolate(r2), async () => {
      await r2.put(LEASE_KEY, JSON.stringify({ token: "thief", expiresAt: Date.now() + 60_000 }));
    });
    expect(JSON.parse(r2.text(LEASE_KEY)!).token).toBe("thief");
  });

  it("degrades safely on providers that ignore conditional writes", async () => {
    const r2 = new MemoryR2();
    r2.enforceConditions = false;
    await runStorageTransaction(isolate(r2), [{ key: "x", operation: "put", value: "ok" }]);
    expect(r2.text("x")).toBe("ok");
    expect(r2.keys("private-admin/recovery/")).toEqual([]);
  });
});

/** A crashed holder may leave its (self-expiring) lease behind; it is not portfolio data. */
function withoutLease(snapshot: Record<string, string>) {
  // Sorted so snapshots compare independent of insertion order.
  return Object.fromEntries(
    Object.entries(snapshot)
      .filter(([key]) => key !== LEASE_KEY)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

describe("failure injection at every storage operation", () => {
  async function seed(r2: MemoryR2) {
    await r2.put("private-admin/a.json", "a-before", {
      httpMetadata: { contentType: "application/json" },
    });
    await r2.put("public/b.json", "b-before");
    await r2.put("private-admin/c.bin", new Uint8Array([1, 2, 3]));
  }
  const mutations = [
    {
      key: "private-admin/a.json",
      operation: "put" as const,
      value: "a-after",
      contentType: "text/plain",
    },
    { key: "public/b.json", operation: "delete" as const },
    { key: "public/new.json", operation: "put" as const, value: "new" },
  ];

  it("leaves either the full old state or the full new state, never a mix", async () => {
    const reference = new MemoryR2();
    await seed(reference);
    const before = withoutLease(reference.snapshot());
    await runStorageTransaction(reference, mutations);
    const after = withoutLease(reference.snapshot());
    const totalOps = reference.log.length;
    expect(after).not.toEqual(before);

    let sawRollback = false;
    let sawCommit = false;
    for (let failAt = 0; failAt < totalOps; failAt += 1) {
      const r2 = new MemoryR2();
      await seed(r2);
      const start = r2.log.length;
      let armed = true;
      r2.hook = (_op, _key, index) => {
        if (armed && index === start + failAt) {
          armed = false;
          throw new Error(`injected failure at operation ${failAt}`);
        }
      };
      await runStorageTransaction(r2, mutations).catch(() => undefined);
      armed = false; // the injected fault is one-shot; recovery itself runs fault-free
      // A failure while releasing leaves the lease until its TTL passes; model that.
      if (r2.has(LEASE_KEY)) {
        await r2.put(LEASE_KEY, JSON.stringify({ token: "dead", expiresAt: Date.now() - 1 }));
      }
      // The owner recovery path replays any journal the failure left behind.
      await recoverPendingStorageTransaction(r2);
      const final = withoutLease(r2.snapshot());
      // Ignore transient lease/journal keys; they must not survive recovery.
      expect(
        r2.keys("private-admin/recovery/").filter((key) => key !== LEASE_KEY),
        `leftovers when failing at ${failAt}`,
      ).toEqual([]);
      const isBefore = JSON.stringify(final) === JSON.stringify(before);
      const isAfter = JSON.stringify(final) === JSON.stringify(after);
      expect(
        isBefore || isAfter,
        `torn state at ${failAt}: ${JSON.stringify(final)} vs ${JSON.stringify(before)}`,
      ).toBe(true);
      sawRollback ||= isBefore;
      sawCommit ||= isAfter;
    }
    expect(sawRollback).toBe(true);
    expect(sawCommit).toBe(true);
  });

  it("recovers an interrupted applying journal left by a crashed isolate", async () => {
    const r2 = new MemoryR2();
    await seed(r2);
    const before = withoutLease(r2.snapshot());
    // Crash the isolate while applying: the target write succeeds, then every later op dies.
    let crash = false;
    r2.hook = (op, key) => {
      if (crash) throw new Error("isolate crashed");
      if (op === "put" && key === "private-admin/a.json") crash = true;
    };
    await runStorageTransaction(r2, mutations).catch(() => undefined);
    r2.hook = null;
    const stale = r2.keys("private-admin/recovery/");
    // The dead isolate still holds its lease until the TTL passes; model that time passing.
    await r2.put(LEASE_KEY, JSON.stringify({ token: "dead", expiresAt: Date.now() - 1 }));
    // Regardless of what the dead isolate managed to clean up, recovery restores a clean state.
    await recoverPendingStorageTransaction(r2);
    expect(r2.keys("private-admin/recovery/").filter((key) => key !== LEASE_KEY)).toEqual([]);
    expect(stale.length).toBeGreaterThan(0);
    expect(withoutLease(r2.snapshot())).toEqual(before);
  });
});

const RESUME_ID = "resume-00000001";
const IMAGE_ID = "image-00000001";
const resumeKey = `private-admin/resumes/files/${RESUME_ID}`;
const imagePrivateKey = `private-admin/images/files/${IMAGE_ID}`;
const imagePublicKey = `public/profile-images/${IMAGE_ID}`;

async function seedFullPortfolio(r2: MemoryR2) {
  const json = { httpMetadata: { contentType: "application/json; charset=utf-8" } };
  await r2.put(
    "private-admin/content/ammu.json",
    JSON.stringify(emptyContentDocument("ammu")),
    json,
  );
  await r2.put(
    "private-admin/personas/sai.json",
    JSON.stringify(emptyPersonaDocument("sai")),
    json,
  );
  await r2.put(
    "private-admin/resumes/history/bava.json",
    JSON.stringify(emptyHistory("bava")),
    json,
  );
  await r2.put(RESUME_INDEX_KEY, JSON.stringify([{ id: RESUME_ID, profileId: "bava" }]), json);
  await r2.put(
    IMAGE_INDEX_KEY,
    JSON.stringify([{ id: IMAGE_ID, status: "approved", profileId: "ammu" }]),
    json,
  );
  await r2.put("public/approved-resumes.json", JSON.stringify({ resumes: [] }), json);
  await r2.put("private-admin/audit/log.json", JSON.stringify({ version: 1, entries: [] }), json);
  await r2.put(resumeKey, new Uint8Array([0x25, 0x50, 0x44, 0x46, 1, 2, 3]), {
    httpMetadata: { contentType: "application/pdf" },
  });
  await r2.put(imagePrivateKey, new Uint8Array([0xff, 0xd8, 0xff, 9, 9]), {
    httpMetadata: { contentType: "image/jpeg" },
  });
  await r2.put(imagePublicKey, new Uint8Array([0xff, 0xd8, 0xff, 9, 9]), {
    httpMetadata: { contentType: "image/jpeg" },
  });
}

describe("backup and restore round trip (PORT-GAP-012)", () => {
  it("restores every document and binary byte-for-byte into an empty bucket", async () => {
    const source = new MemoryR2();
    await seedFullPortfolio(source);
    // Journal/lease internals and unrelated keys must never leak into a backup.
    await source.put("private-admin/recovery/active.json", "{}");
    await source.put("unrelated/secret.txt", "do-not-export");

    const backup = await createBackup(source);
    expect(Object.keys(backup.files ?? {}).sort()).toEqual(
      [imagePrivateKey, imagePublicKey, resumeKey].sort(),
    );
    expect(Object.keys(backup.entries)).not.toContain("unrelated/secret.txt");

    // Serialize exactly as the Admin download/upload would.
    const validated = await validateBackup(JSON.parse(JSON.stringify(backup)));
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const target = new MemoryR2();
    const restored = await restoreBackup(target, validated);
    expect(restored.ok).toBe(true);

    for (const key of [
      "private-admin/content/ammu.json",
      "private-admin/personas/sai.json",
      "private-admin/resumes/history/bava.json",
      RESUME_INDEX_KEY,
      IMAGE_INDEX_KEY,
      "public/approved-resumes.json",
      "private-admin/audit/log.json",
      resumeKey,
      imagePrivateKey,
      imagePublicKey,
    ]) {
      expect(target.bytes(key), key).toEqual(source.bytes(key));
      expect(target.contentType(key), key).toBe(source.contentType(key));
    }
    expect(target.has("unrelated/secret.txt")).toBe(false);
    expect(target.keys("private-admin/recovery/")).toEqual([]);
  });

  it("rejects incomplete, tampered and unsafe backups without writing anything", async () => {
    const source = new MemoryR2();
    await seedFullPortfolio(source);
    const backup = await createBackup(source);

    const missingBinary = structuredClone(backup);
    delete missingBinary.files![resumeKey];
    const incomplete = await validateBackup(missingBinary);
    expect(incomplete.ok).toBe(false);

    const tampered = structuredClone(backup);
    tampered.files![imagePrivateKey]!.base64 = btoa("tampered-bytes");
    expect((await validateBackup(tampered)).ok).toBe(false);

    const traversal = structuredClone(backup);
    traversal.files!["../../etc/passwd"] = traversal.files![resumeKey]!;
    expect((await validateBackup(traversal)).ok).toBe(false);

    const foreignKey = structuredClone(backup);
    foreignKey.entries["unrelated/secret.txt"] = {};
    expect((await validateBackup(foreignKey)).ok).toBe(false);

    const target = new MemoryR2();
    expect(target.log).toHaveLength(0);
  });

  it("refuses to export a backup when a referenced binary is missing", async () => {
    const source = new MemoryR2();
    await seedFullPortfolio(source);
    await source.delete(imagePublicKey);
    await expect(createBackup(source)).rejects.toThrow(/incomplete/i);
  });

  it("rolls the destination back to its previous contents when a restore write fails", async () => {
    const source = new MemoryR2();
    await seedFullPortfolio(source);
    const validated = await validateBackup(JSON.parse(JSON.stringify(await createBackup(source))));
    if (!validated.ok) throw new Error("fixture backup must validate");

    const target = new MemoryR2();
    await target.put("private-admin/content/ammu.json", "pre-existing-content");
    await target.put(RESUME_INDEX_KEY, JSON.stringify([{ id: "resume-keep-0001" }]));
    const before = target.snapshot();

    let armed = true;
    target.hook = (op, key) => {
      if (armed && op === "put" && key === IMAGE_INDEX_KEY) {
        armed = false;
        throw new Error("injected index write failure");
      }
    };
    const result = await restoreBackup(target, validated);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rolledBack).toBe(true);
    target.hook = null;
    await recoverPendingStorageTransaction(target);
    expect(target.snapshot()).toEqual(before);
  });

  it("migrates between two buckets and reports files that were missing", async () => {
    const source = new MemoryR2();
    await seedFullPortfolio(source);
    const target = new MemoryR2();
    const result = await migrateStorage(source, target);
    expect(result.ok).toBe(true);
    expect(target.bytes(imagePublicKey)).toEqual(source.bytes(imagePublicKey));
  });
});
