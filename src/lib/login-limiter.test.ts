// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  KvLoginLimiter,
  MemoryLoginLimiter,
  StorageLoginLimiter,
  resolveLoginLimiter,
  type KvNamespaceLike,
  type LoginLimiter,
} from "@/lib/login-limiter";
import { MemoryR2 } from "@/test/helpers/memory-r2";

class FakeKv implements KvNamespaceLike {
  readonly data = new Map<string, string>();
  readonly ttls: number[] = [];
  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    this.data.set(key, value);
    if (options?.expirationTtl) this.ttls.push(options.expirationTtl);
  }
  async delete(key: string) {
    this.data.delete(key);
  }
}

function contract(name: string, make: (now: () => number) => LoginLimiter) {
  describe(`${name} limiter contract`, () => {
    it("allows up to the maximum, then blocks with a positive retry-after", async () => {
      let clock = 1_000_000;
      const limiter = make(() => clock);
      expect(await limiter.check("client")).toEqual({ allowed: true });
      for (let i = 0; i < 4; i += 1) {
        expect((await limiter.recordFailure("client")).allowed).toBe(true);
      }
      const fifth = await limiter.recordFailure("client");
      expect(fifth.allowed).toBe(false);
      const blocked = await limiter.check("client");
      expect(blocked.allowed).toBe(false);
      if (!blocked.allowed) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      // Other clients are unaffected.
      expect(await limiter.check("someone-else")).toEqual({ allowed: true });
      clock += 15 * 60 * 1000 + 1;
      expect(await limiter.check("client")).toEqual({ allowed: true });
    });

    it("resets after success and starts a fresh window after expiry", async () => {
      let clock = 5_000;
      const limiter = make(() => clock);
      for (let i = 0; i < 5; i += 1) await limiter.recordFailure("client");
      expect((await limiter.check("client")).allowed).toBe(false);
      await limiter.reset("client");
      expect(await limiter.check("client")).toEqual({ allowed: true });
      for (let i = 0; i < 5; i += 1) await limiter.recordFailure("client");
      clock += 16 * 60 * 1000;
      expect((await limiter.recordFailure("client")).allowed).toBe(true);
    });
  });
}

contract("memory", (now) => new MemoryLoginLimiter({ now }));
contract("storage (R2)", (now) => new StorageLoginLimiter(new MemoryR2(), { now }));
contract("KV", (now) => new KvLoginLimiter(new FakeKv(), { now }));

describe("storage limiter shared-state behaviour", () => {
  it("counts every failure recorded concurrently from different isolates", async () => {
    const r2 = new MemoryR2();
    r2.interleave = true;
    const isolates = [1, 2, 3].map(() => new StorageLoginLimiter(r2, { maxAttempts: 1000 }));
    await Promise.all(
      Array.from({ length: 24 }, (_, i) => isolates[i % 3]!.recordFailure("203.0.113.9")),
    );
    const key = r2.keys("private-admin/ratelimit/")[0]!;
    expect(JSON.parse(r2.text(key)!).count).toBe(24);
  });

  it("blocks a client from a second isolate and never stores the raw identifier", async () => {
    const r2 = new MemoryR2();
    const first = new StorageLoginLimiter(r2);
    for (let i = 0; i < 5; i += 1) await first.recordFailure("198.51.100.77");
    const second = new StorageLoginLimiter(r2);
    expect((await second.check("198.51.100.77")).allowed).toBe(false);
    expect(r2.keys().join("|")).not.toContain("198.51.100.77");
  });

  it("replaces a corrupt counter instead of trusting or permanently locking on it", async () => {
    const r2 = new MemoryR2();
    const limiter = new StorageLoginLimiter(r2);
    await limiter.recordFailure("c");
    const key = r2.keys("private-admin/ratelimit/")[0]!;
    await r2.put(key, "not json");
    expect(await limiter.check("c")).toEqual({ allowed: true });
    expect((await limiter.recordFailure("c")).allowed).toBe(true);
  });

  it("fails closed under persistent write contention", async () => {
    const r2 = new MemoryR2();
    const limiter = new StorageLoginLimiter(r2);
    // Every conditional write loses the race: the attempt is denied, never silently uncounted.
    const rejecting = {
      get: (k: string) => r2.get(k),
      put: async () => null,
      delete: (k: string) => r2.delete(k),
    };
    const decision = await new StorageLoginLimiter(rejecting).recordFailure("c");
    expect(decision).toMatchObject({ allowed: false, saturated: true });
    expect(await limiter.check("c")).toEqual({ allowed: true });
  });
});

describe("memory limiter saturation", () => {
  it("fails closed for new identities once the table is full", async () => {
    const limiter = new MemoryLoginLimiter();
    for (let i = 0; i < 4096; i += 1) await limiter.recordFailure(`client-${i}`);
    const overflow = await limiter.recordFailure("one-more");
    expect(overflow.allowed).toBe(false);
  });
});

describe("limiter selection", () => {
  it("prefers KV, then the R2 bucket, then the per-process fallback", () => {
    const kv = new FakeKv();
    const r2 = new MemoryR2();
    expect(resolveLoginLimiter({ LOGIN_RATE_LIMIT_KV: kv }, r2)).toBeInstanceOf(KvLoginLimiter);
    expect(resolveLoginLimiter({}, r2)).toBeInstanceOf(StorageLoginLimiter);
    expect(resolveLoginLimiter({}, undefined)).toBeInstanceOf(MemoryLoginLimiter);
  });
});
