// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { emptyContentDocument } from "@/lib/cms-content";
import { emptyPersonaDocument } from "@/lib/persona";
import { emptyHistory } from "@/lib/resume-publish-history";
import {
  IMAGE_INDEX_KEY,
  RESUME_INDEX_KEY,
  createBackup,
  restoreBackup,
  validateBackup,
  type BackupStorage,
} from "@/lib/admin-backup";
import { StorageLoginLimiter } from "@/lib/login-limiter";
import { LEASE_KEY, withStorageLease } from "@/lib/storage-lock";
import {
  recoverPendingStorageTransaction,
  runStorageTransaction,
  type RecoveryBucket,
} from "@/lib/storage-recovery";
import server from "@/server";

/**
 * Runs the storage, concurrency and Admin flows against a real R2 implementation: Miniflare's
 * workerd-backed R2 bucket (the engine behind `wrangler dev --local`), in memory, with no network
 * and no Cloudflare credentials. This checks the application against actual conditional-write,
 * etag and listing behaviour instead of a hand-written model. It is still a local emulator:
 * hosted R2 latency, replication and quotas are not exercised.
 */
type Bucket = RecoveryBucket &
  BackupStorage & { list(o: { prefix?: string }): Promise<{ objects: { key: string }[] }> };

const BUCKETS = Array.from({ length: 80 }, (_, i) => `R2_${i}`);
let mf: Miniflare;
let next = 0;

async function fresh(): Promise<Bucket> {
  const binding = BUCKETS[next++];
  if (!binding) throw new Error("test bucket pool exhausted");
  return (await mf.getR2Bucket(binding)) as unknown as Bucket;
}

/** A distinct handle over the same bucket (a second isolate) with optional per-operation hooks. */
function handle(
  bucket: Bucket,
  hook?: (op: "get" | "put" | "delete", key: string, index: number) => Promise<void> | void,
): Bucket {
  let index = 0;
  const run = async (op: "get" | "put" | "delete", key: string) => {
    const current = index;
    index += 1;
    await hook?.(op, key, current);
  };
  return {
    get: async (key) => (await run("get", key), bucket.get(key)),
    put: async (key, value, options) => (await run("put", key), bucket.put(key, value, options)),
    delete: async (key) => (await run("delete", key), bucket.delete(key)),
    list: (options) => bucket.list(options),
  } as Bucket;
}

async function text(bucket: Bucket, key: string): Promise<string | null> {
  const object = await bucket.get(key);
  return object ? new TextDecoder().decode(await object.arrayBuffer()) : null;
}

async function keys(bucket: Bucket, prefix = ""): Promise<string[]> {
  return (await bucket.list({ prefix })).objects.map((o) => o.key).sort();
}

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-01-01",
    r2Buckets: BUCKETS,
    r2Persist: false,
  });
  await mf.ready;
}, 120_000);

afterAll(async () => {
  await mf?.dispose();
});

describe("real R2 (Miniflare) conditional writes", () => {
  it("honours create-only and etag-matched puts exactly as the application assumes", async () => {
    const bucket = await fresh();
    expect(await bucket.put("k", "one", { onlyIf: { etagDoesNotMatch: "*" } })).not.toBeNull();
    expect(await bucket.put("k", "two", { onlyIf: { etagDoesNotMatch: "*" } })).toBeNull();
    const current = await bucket.get("k");
    expect(current?.etag).toBeTruthy();
    expect(await bucket.put("k", "stale", { onlyIf: { etagMatches: "not-the-etag" } })).toBeNull();
    expect(
      await bucket.put("k", "three", { onlyIf: { etagMatches: current!.etag! } }),
    ).not.toBeNull();
    expect(await text(bucket, "k")).toBe("three");
  });
});

describe("real R2: lease, transactions and limiter", () => {
  it("serializes multi-object transactions from several isolates", async () => {
    const bucket = await fresh();
    const slow = async () => {
      await new Promise((resolve) => setTimeout(resolve, 2));
    };
    const isolates = [handle(bucket, slow), handle(bucket, slow), handle(bucket, slow)];
    const results = await Promise.allSettled(
      Array.from({ length: 9 }, (_, i) =>
        runStorageTransaction(isolates[i % 3]!, [
          { key: "pair/a", operation: "put", value: `w${i}` },
          { key: "pair/b", operation: "put", value: `w${i}` },
        ]),
      ),
    );
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await text(bucket, "pair/a")).toBe(await text(bucket, "pair/b"));
    expect(await keys(bucket, "private-admin/recovery/")).toEqual([]);
  }, 60_000);

  it("never mixes old and new state when any single storage operation fails", async () => {
    const mutations = [
      { key: "private-admin/a.json", operation: "put" as const, value: "a-after" },
      { key: "public/b.json", operation: "delete" as const },
      { key: "public/new.json", operation: "put" as const, value: "new" },
    ];
    const seed = async (b: Bucket) => {
      await b.put("private-admin/a.json", "a-before");
      await b.put("public/b.json", "b-before");
    };
    const snapshot = async (b: Bucket) =>
      JSON.stringify(
        await Promise.all(
          ["private-admin/a.json", "public/b.json", "public/new.json"].map((k) => text(b, k)),
        ),
      );
    const reference = await fresh();
    await seed(reference);
    const before = await snapshot(reference);
    let total = 0;
    await runStorageTransaction(
      handle(reference, () => {
        total += 1;
      }),
      mutations,
    );
    const after = await snapshot(reference);
    expect(after).not.toBe(before);

    // Each failure point uses its own bucket, so the sweep runs concurrently instead of serially.
    const sweep = async (failAt: number) => {
      const bucket = await fresh();
      await seed(bucket);
      let armed = true;
      const failing = handle(bucket, (_op, _key, index) => {
        if (armed && index === failAt) {
          armed = false;
          throw new Error(`injected failure at ${failAt}`);
        }
      });
      await runStorageTransaction(failing, mutations).catch(() => undefined);
      armed = false;
      // A failed release leaves the self-expiring lease; model its TTL passing, then recover.
      if (await text(bucket, LEASE_KEY)) {
        await bucket.put(LEASE_KEY, JSON.stringify({ token: "dead", expiresAt: Date.now() - 1 }));
      }
      await recoverPendingStorageTransaction(handle(bucket));
      const final = await snapshot(bucket);
      expect([before, after], `torn state failing at ${failAt}`).toContain(final);
    };
    await Promise.all(Array.from({ length: total }, (_, failAt) => sweep(failAt)));
  }, 120_000);

  it("expires a dead holder's lease and refuses to steal a live one", async () => {
    const bucket = await fresh();
    await bucket.put(LEASE_KEY, JSON.stringify({ token: "gone", expiresAt: Date.now() - 1000 }));
    expect(await withStorageLease(bucket, async () => "ran")).toBe("ran");
    await bucket.put(LEASE_KEY, JSON.stringify({ token: "live", expiresAt: Date.now() + 60_000 }));
    let clock = 0;
    await expect(
      withStorageLease(bucket, async () => "never", {
        waitMs: 300,
        pollMs: 100,
        now: () => clock,
        sleep: async (ms) => {
          clock += ms;
        },
      }),
    ).rejects.toThrow(/in progress/);
  });

  it("counts every concurrent failed login through real etag compare-and-set", async () => {
    const bucket = await fresh();
    const limiters = [1, 2, 3].map(
      () => new StorageLoginLimiter(handle(bucket), { maxAttempts: 1000 }),
    );
    await Promise.all(
      Array.from({ length: 9 }, (_, i) => limiters[i % 3]!.recordFailure("198.51.100.5")),
    );
    const [key] = await keys(bucket, "private-admin/ratelimit/");
    expect(JSON.parse((await text(bucket, key!))!).count).toBe(9);
  }, 60_000);
});

describe("real R2: backup, restore and Admin API", () => {
  const png = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
  const env = (bucket: Bucket) => ({
    ENVIRONMENT: "development",
    PORTFOLIO_ADMIN_AUTH_BYPASS: "true",
    RESUME_BUCKET: bucket,
  });
  const origin = "http://portfolio.test";
  const call = (bucket: Bucket, path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (init.method && init.method !== "GET") headers.set("origin", origin);
    return server.fetch(new Request(origin + path, { ...init, headers }), env(bucket), {});
  };

  it("round-trips every document and binary into a second real bucket", async () => {
    const source = await fresh();
    const json = { httpMetadata: { contentType: "application/json; charset=utf-8" } };
    const id = "image-00000001";
    await source.put(
      "private-admin/content/ammu.json",
      JSON.stringify(emptyContentDocument("ammu")),
      json,
    );
    await source.put(
      "private-admin/personas/sai.json",
      JSON.stringify(emptyPersonaDocument("sai")),
      json,
    );
    await source.put(
      "private-admin/resumes/history/bava.json",
      JSON.stringify(emptyHistory("bava")),
      json,
    );
    await source.put(RESUME_INDEX_KEY, JSON.stringify([]), json);
    await source.put(
      IMAGE_INDEX_KEY,
      JSON.stringify([{ id, status: "approved", profileId: "ammu" }]),
      json,
    );
    await source.put(`private-admin/images/files/${id}`, png, {
      httpMetadata: { contentType: "image/png" },
    });
    await source.put(`public/profile-images/${id}`, png, {
      httpMetadata: { contentType: "image/png" },
    });

    const validated = await validateBackup(JSON.parse(JSON.stringify(await createBackup(source))));
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const target = await fresh();
    expect((await restoreBackup(target, validated)).ok).toBe(true);
    for (const key of [
      "private-admin/content/ammu.json",
      "private-admin/personas/sai.json",
      IMAGE_INDEX_KEY,
      `private-admin/images/files/${id}`,
      `public/profile-images/${id}`,
    ]) {
      expect(await text(target, key), key).toBe(await text(source, key));
    }
    expect((await target.get(`public/profile-images/${id}`))?.httpMetadata?.contentType).toBe(
      "image/png",
    );
    expect(await keys(target, "private-admin/recovery/")).toEqual([]);
  });

  it("returns 409 to stale concurrent content writers (etag precondition on real R2)", async () => {
    const bucket = await fresh();
    const slowReads = handle(bucket, async (op) => {
      if (op === "get") await new Promise((resolve) => setTimeout(resolve, 40));
    });
    const responses = await Promise.all(
      ["a", "b", "c", "d"].map((tag) =>
        call(slowReads, "/api/admin/content/draft", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            profileId: "sai",
            content: { basics: { headline: `writer ${tag}` } },
          }),
        }),
      ),
    );
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409, 409, 409]);
  });

  it.each(["abhishek", "ammu", "bava", "sai"] as const)(
    "%s image upload, publish, public serve, unpublish and delete work on real R2",
    async (profileId) => {
      const bucket = await fresh();
      const form = new FormData();
      form.set("profileId", profileId);
      form.set("alt", `${profileId} gallery`);
      form.set("slot", "gallery");
      form.set("publishOnUpload", "true");
      form.set(
        "file",
        new File([png.buffer as ArrayBuffer], `${profileId}.png`, { type: "image/png" }),
      );
      const uploaded = await call(bucket, "/api/admin/images", { method: "POST", body: form });
      expect(uploaded.status).toBe(201);
      const { image } = (await uploaded.json()) as { image: { id: string } };
      expect(await keys(bucket, "private-admin/images/files/")).toEqual([
        `private-admin/images/files/${image.id}`,
      ]);
      const feed = (await (await call(bucket, "/api/published-images")).json()) as {
        images: { id: string; profileId: string }[];
      };
      expect(feed.images.map((i) => i.profileId)).toEqual([profileId]);
      const served = await call(bucket, `/api/published-images/${image.id}`);
      expect(served.status).toBe(200);
      expect(new Uint8Array(await served.arrayBuffer())).toEqual(png);

      expect(
        (await call(bucket, `/api/admin/images/${image.id}/unpublish`, { method: "POST" })).status,
      ).toBe(200);
      expect((await call(bucket, `/api/published-images/${image.id}`)).status).toBe(404);
      expect(
        (await call(bucket, `/api/admin/images/${image.id}`, { method: "DELETE" })).status,
      ).toBe(200);
      expect(await keys(bucket, "private-admin/images/files/")).toEqual([]);
      expect(await keys(bucket, "private-admin/recovery/")).toEqual([]);
    },
    60_000,
  );
});
