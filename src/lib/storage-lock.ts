/**
 * Cross-isolate storage lease built on conditional writes (PORT-GAP-002).
 *
 * The in-process queue in storage-recovery.ts only serializes one isolate. Cloudflare
 * may run several isolates against one R2 bucket, so multi-object transactions also take a
 * short lease object using R2's `onlyIf` preconditions:
 *   - acquire:  put(LEASE, { onlyIf: { etagDoesNotMatch: "*" } })   (create-only)
 *   - steal:    put(LEASE, { onlyIf: { etagMatches: <stale etag> } }) (only an expired lease)
 *   - release:  delete when the stored token is still ours.
 * R2 resolves `null` when a precondition fails. Providers that cannot enforce `onlyIf`
 * (local disk, memory) resolve normally, so the lease degrades to a no-op there and the
 * per-process queue remains the only protection; that limitation is deliberate and tested.
 */
import type { ObjectBucket } from "@/lib/storage-adapter";

export const LEASE_KEY = "private-admin/recovery/lease.json";

export interface LeaseOptions {
  /** Lease lifetime; a crashed holder is displaced after this long. */
  ttlMs?: number;
  /** How long to wait for another holder before giving up. */
  waitMs?: number;
  pollMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class StorageLeaseTimeoutError extends Error {
  constructor() {
    super("Another storage operation is in progress. Try again shortly.");
    this.name = "StorageLeaseTimeoutError";
  }
}

type Lease = { token: string; expiresAt: number };

function parseLease(text: string): Lease | null {
  try {
    const value = JSON.parse(text) as Partial<Lease>;
    if (typeof value.token === "string" && Number.isFinite(value.expiresAt)) {
      return { token: value.token, expiresAt: value.expiresAt as number };
    }
  } catch {
    // A corrupt lease is treated as expired so it can be displaced.
  }
  return null;
}

export async function withStorageLease<T>(
  bucket: ObjectBucket,
  work: () => Promise<T>,
  options: LeaseOptions = {},
): Promise<T> {
  const ttlMs = options.ttlMs ?? 120_000;
  const waitMs = options.waitMs ?? 15_000;
  const pollMs = options.pollMs ?? 100;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const token = crypto.randomUUID();
  const body = () => JSON.stringify({ token, expiresAt: now() + ttlMs } satisfies Lease);
  const json = { contentType: "application/json; charset=utf-8" };

  const deadline = now() + waitMs;
  for (;;) {
    const created = await bucket.put(LEASE_KEY, body(), {
      httpMetadata: json,
      onlyIf: { etagDoesNotMatch: "*" },
    });
    if (created !== null) break;

    const current = await bucket.get(LEASE_KEY);
    if (!current) continue; // released between our attempt and the read: retry immediately
    const lease = parseLease(new TextDecoder().decode(await current.arrayBuffer()));
    if ((!lease || lease.expiresAt <= now()) && current.etag) {
      const stolen = await bucket.put(LEASE_KEY, body(), {
        httpMetadata: json,
        onlyIf: { etagMatches: current.etag },
      });
      if (stolen !== null) break;
      continue;
    }
    if (now() >= deadline) throw new StorageLeaseTimeoutError();
    await sleep(pollMs);
  }

  try {
    return await work();
  } finally {
    try {
      const held = await bucket.get(LEASE_KEY);
      const lease = held ? parseLease(new TextDecoder().decode(await held.arrayBuffer())) : null;
      if (lease?.token === token) await bucket.delete(LEASE_KEY);
    } catch (error) {
      // The lease expires on its own; never mask the transaction's result.
      console.error("Storage lease release failed; it will expire.", error);
    }
  }
}
