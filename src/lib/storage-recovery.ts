/**
 * Durable write-ahead recovery for multi-object storage changes.
 * A pending journal survives request/process failure and is replayed before the
 * next transaction or by the owner recovery endpoint. The in-process queue only
 * serializes one isolate; it is not a distributed R2 lock.
 */
export interface RecoveryBucket {
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>;
  put(key: string, value: ArrayBuffer | string | Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}
export type StorageMutation =
  | { key: string; operation: "put"; value: ArrayBuffer | string | Uint8Array; contentType?: string }
  | { key: string; operation: "delete" };
type Snapshot = { key: string; existed: boolean; snapshotKey?: string; contentType?: string };
type Journal = { version: 1; id: string; state: "preparing" | "applying" | "recovered" | "committed"; createdAt: string; snapshots: Snapshot[] };
const JOURNAL = "private-admin/recovery/active.json";
const ROOT = "private-admin/recovery/";
const queues = new WeakMap<object, Promise<void>>();

export class StorageTransactionError extends Error {
  constructor(readonly restored: boolean, cause: unknown) {
    super(cause instanceof Error ? cause.message : "Storage transaction failed.");
    this.name = "StorageTransactionError";
  }
}
function isJournal(value: unknown): value is Journal {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const j = value as Record<string, unknown>;
  if (j.version !== 1 || typeof j.id !== "string" || !/^[0-9a-f-]{36}$/i.test(j.id) ||
      !["preparing", "applying", "recovered", "committed"].includes(String(j.state)) ||
      typeof j.createdAt !== "string" || !Number.isFinite(Date.parse(j.createdAt)) || !Array.isArray(j.snapshots)) return false;
  return j.snapshots.every((entry, i) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const s = entry as Record<string, unknown>;
    if (typeof s.key !== "string" || !s.key || s.key.startsWith(ROOT) || typeof s.existed !== "boolean") return false;
    if (s.contentType !== undefined && typeof s.contentType !== "string") return false;
    return s.existed ? s.snapshotKey === `${ROOT}${j.id}/snapshot-${i}` : s.snapshotKey === undefined;
  });
}
async function readJournal(bucket: RecoveryBucket): Promise<Journal | null> {
  const object = await bucket.get(JOURNAL);
  if (!object) return null;
  const value: unknown = JSON.parse(new TextDecoder().decode(await object.arrayBuffer()));
  if (!isJournal(value)) throw new Error("Storage recovery journal failed integrity validation.");
  return value;
}
async function writeJournal(bucket: RecoveryBucket, journal: Journal) {
  await bucket.put(JOURNAL, JSON.stringify(journal), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
}
async function cleanup(bucket: RecoveryBucket, journal: Journal) {
  for (const snapshot of journal.snapshots) if (snapshot.snapshotKey) await bucket.delete(snapshot.snapshotKey);
  await bucket.delete(JOURNAL);
}
async function recoverUnsafe(bucket: RecoveryBucket) {
  const journal = await readJournal(bucket);
  if (!journal) return { recovered: false, state: null as Journal["state"] | null };
  if (journal.state === "preparing") {
    await cleanup(bucket, journal);
    return { recovered: true, state: "preparing" as const };
  }
  if (journal.state === "applying") {
    for (const s of [...journal.snapshots].reverse()) {
      if (s.existed) {
        const saved = await bucket.get(s.snapshotKey!);
        if (!saved) throw new Error(`Recovery snapshot missing for ${s.key}.`);
        await bucket.put(s.key, await saved.arrayBuffer(), { ...(s.contentType ? { httpMetadata: { contentType: s.contentType } } : {}) });
      } else await bucket.delete(s.key);
    }
    journal.state = "recovered";
    await writeJournal(bucket, journal);
  }
  const state = journal.state;
  await cleanup(bucket, journal);
  return { recovered: true, state };
}
async function locked<T>(bucket: RecoveryBucket, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(bucket as object) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>(resolve => { release = resolve; });
  queues.set(bucket as object, previous.then(() => next));
  await previous.catch(() => undefined);
  try { return await work(); } finally { release(); }
}
export async function storageRecoveryStatus(bucket: RecoveryBucket) {
  const j = await readJournal(bucket);
  return { pending: !!j, state: j?.state ?? null, createdAt: j?.createdAt ?? null, affectedObjects: j?.snapshots.length ?? 0 };
}
export async function recoverPendingStorageTransaction(bucket: RecoveryBucket) {
  return locked(bucket, () => recoverUnsafe(bucket));
}
export async function runStorageTransaction(bucket: RecoveryBucket, mutations: StorageMutation[]): Promise<void> {
  if (!mutations.length) return;
  const keys = mutations.map(m => m.key);
  if (keys.some(k => !k || k.startsWith(ROOT)) || new Set(keys).size !== keys.length)
    throw new Error("Storage transaction contains invalid or duplicate keys.");
  await locked(bucket, async () => {
    await recoverUnsafe(bucket);
    const journal: Journal = { version: 1, id: crypto.randomUUID(), state: "preparing", createdAt: new Date().toISOString(), snapshots: [] };
    for (let i = 0; i < mutations.length; i++) {
      const key = mutations[i]!.key;
      const existing = await bucket.get(key);
      if (existing) {
        const snapshotKey = `${ROOT}${journal.id}/snapshot-${i}`;
        journal.snapshots.push({ key, existed: true, snapshotKey, ...(existing.httpMetadata?.contentType ? { contentType: existing.httpMetadata.contentType } : {}) });
        await writeJournal(bucket, journal);
        await bucket.put(snapshotKey, await existing.arrayBuffer(), { ...(existing.httpMetadata?.contentType ? { httpMetadata: { contentType: existing.httpMetadata.contentType } } : {}) });
      } else {
        journal.snapshots.push({ key, existed: false });
        await writeJournal(bucket, journal);
      }
    }
    journal.state = "applying";
    await writeJournal(bucket, journal);
    try {
      for (const mutation of mutations) {
        if (mutation.operation === "delete") await bucket.delete(mutation.key);
        else await bucket.put(mutation.key, mutation.value, { ...(mutation.contentType ? { httpMetadata: { contentType: mutation.contentType } } : {}) });
      }
      journal.state = "committed";
      await writeJournal(bucket, journal);
    } catch (error) {
      let restored = false;
      try { await recoverUnsafe(bucket); restored = true; }
      catch (recoveryError) { console.error("Durable storage recovery remains pending.", recoveryError); }
      throw new StorageTransactionError(restored, error);
    }
    // A committed journal is cleanup-only; cleanup failure is safe to retry later.
    try { await cleanup(bucket, journal); }
    catch (error) { console.error("Committed storage transaction needs snapshot cleanup.", error); }
  });
}
