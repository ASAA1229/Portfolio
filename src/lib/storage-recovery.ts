/**
 * Durable write-ahead recovery for multi-object storage changes.
 *
 * A pending journal survives request/process failure and is replayed before the
 * next transaction or by the owner recovery endpoint. The in-process queue only
 * serializes one isolate; it is not a distributed R2 lock.
 */
export interface RecoveryBucket {
  get(key: string): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
    httpMetadata?: { contentType?: string };
  } | null>;
  put(
    key: string,
    value: ArrayBuffer | string | Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}

export type StorageMutation =
  | {
      key: string;
      operation: "put";
      value: ArrayBuffer | string | Uint8Array;
      contentType?: string;
    }
  | { key: string; operation: "delete" };

type Snapshot = {
  key: string;
  existed: boolean;
  snapshotKey?: string;
  contentType?: string;
};

type Journal = {
  version: 1;
  id: string;
  state: "preparing" | "applying" | "recovered" | "committed";
  createdAt: string;
  snapshots: Snapshot[];
};

const JOURNAL = "private-admin/recovery/active.json";
const ROOT = "private-admin/recovery/";
const queues = new WeakMap<object, Promise<void>>();

export class StorageTransactionError extends Error {
  constructor(
    readonly restored: boolean,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : "Storage transaction failed.");
    this.name = "StorageTransactionError";
  }
}

function isJournal(value: unknown): value is Journal {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const journal = value as Record<string, unknown>;

  if (
    journal.version !== 1 ||
    typeof journal.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(journal.id) ||
    !["preparing", "applying", "recovered", "committed"].includes(String(journal.state)) ||
    typeof journal.createdAt !== "string" ||
    !Number.isFinite(Date.parse(journal.createdAt)) ||
    !Array.isArray(journal.snapshots)
  ) {
    return false;
  }

  return journal.snapshots.every((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const snapshot = entry as Record<string, unknown>;

    if (
      typeof snapshot.key !== "string" ||
      !snapshot.key ||
      snapshot.key.startsWith(ROOT) ||
      typeof snapshot.existed !== "boolean"
    ) {
      return false;
    }
    if (snapshot.contentType !== undefined && typeof snapshot.contentType !== "string") {
      return false;
    }

    return snapshot.existed
      ? snapshot.snapshotKey === `${ROOT}${journal.id}/snapshot-${index}`
      : snapshot.snapshotKey === undefined;
  });
}

async function readJournal(bucket: RecoveryBucket): Promise<Journal | null> {
  const object = await bucket.get(JOURNAL);
  if (!object) return null;

  const value: unknown = JSON.parse(new TextDecoder().decode(await object.arrayBuffer()));
  if (!isJournal(value)) throw new Error("Storage recovery journal failed integrity validation.");
  return value;
}

async function writeJournal(bucket: RecoveryBucket, journal: Journal): Promise<void> {
  await bucket.put(JOURNAL, JSON.stringify(journal), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function cleanup(bucket: RecoveryBucket, journal: Journal): Promise<void> {
  for (const snapshot of journal.snapshots) {
    if (snapshot.snapshotKey) await bucket.delete(snapshot.snapshotKey);
  }
  await bucket.delete(JOURNAL);
}

async function recoverUnsafe(bucket: RecoveryBucket): Promise<{
  recovered: boolean;
  state: Journal["state"] | null;
}> {
  const journal = await readJournal(bucket);
  if (!journal) return { recovered: false, state: null };

  if (journal.state === "preparing") {
    // Target writes cannot begin until state=applying is durable.
    await cleanup(bucket, journal);
    return { recovered: true, state: "preparing" };
  }

  if (journal.state === "applying") {
    for (const snapshot of [...journal.snapshots].reverse()) {
      if (snapshot.existed) {
        const saved = await bucket.get(snapshot.snapshotKey!);
        if (!saved) throw new Error(`Recovery snapshot missing for ${snapshot.key}.`);
        await bucket.put(snapshot.key, await saved.arrayBuffer(), {
          ...(snapshot.contentType
            ? { httpMetadata: { contentType: snapshot.contentType } }
            : {}),
        });
      } else {
        await bucket.delete(snapshot.key);
      }
    }

    journal.state = "recovered";
    await writeJournal(bucket, journal);
  }

  // Committed and recovered journals are cleanup-only and safe to replay.
  const state = journal.state;
  await cleanup(bucket, journal);
  return { recovered: true, state };
}

async function locked<T>(bucket: RecoveryBucket, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(bucket as object) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });

  queues.set(bucket as object, previous.then(() => next));
  await previous.catch(() => undefined);

  try {
    return await work();
  } finally {
    release();
  }
}

export async function storageRecoveryStatus(bucket: RecoveryBucket): Promise<{
  pending: boolean;
  state: Journal["state"] | null;
  createdAt: string | null;
  affectedObjects: number;
}> {
  const journal = await readJournal(bucket);
  return {
    pending: Boolean(journal),
    state: journal?.state ?? null,
    createdAt: journal?.createdAt ?? null,
    affectedObjects: journal?.snapshots.length ?? 0,
  };
}

export async function recoverPendingStorageTransaction(bucket: RecoveryBucket) {
  return locked(bucket, () => recoverUnsafe(bucket));
}

export async function runStorageTransaction(
  bucket: RecoveryBucket,
  mutations: StorageMutation[],
): Promise<void> {
  if (!mutations.length) return;

  const keys = mutations.map((mutation) => mutation.key);
  if (
    keys.some((key) => !key || key.startsWith(ROOT)) ||
    new Set(keys).size !== keys.length
  ) {
    throw new Error("Storage transaction contains invalid or duplicate keys.");
  }

  await locked(bucket, async () => {
    try {
      await recoverUnsafe(bucket);
    } catch (error) {
      throw new StorageTransactionError(false, error);
    }

    const journal: Journal = {
      version: 1,
      id: crypto.randomUUID(),
      state: "preparing",
      createdAt: new Date().toISOString(),
      snapshots: [],
    };

    // Persist intent and immutable snapshots before any target object is changed.
    try {
      for (let index = 0; index < mutations.length; index += 1) {
        const key = mutations[index]!.key;
        const existing = await bucket.get(key);

        if (existing) {
          const snapshotKey = `${ROOT}${journal.id}/snapshot-${index}`;
          journal.snapshots.push({
            key,
            existed: true,
            snapshotKey,
            ...(existing.httpMetadata?.contentType
              ? { contentType: existing.httpMetadata.contentType }
              : {}),
          });
          await writeJournal(bucket, journal);
          await bucket.put(snapshotKey, await existing.arrayBuffer(), {
            ...(existing.httpMetadata?.contentType
              ? { httpMetadata: { contentType: existing.httpMetadata.contentType } }
              : {}),
          });
        } else {
          journal.snapshots.push({ key, existed: false });
          await writeJournal(bucket, journal);
        }
      }

      journal.state = "applying";
      await writeJournal(bucket, journal);
    } catch (error) {
      // Target objects are not mutated until the applying marker is persisted.
      // A failed preparation is therefore safe to report as unchanged.
      try {
        await recoverUnsafe(bucket);
      } catch (recoveryError) {
        console.error("Storage journal preparation cleanup remains pending.", recoveryError);
      }
      throw new StorageTransactionError(true, error);
    }

    try {
      for (const mutation of mutations) {
        if (mutation.operation === "delete") {
          await bucket.delete(mutation.key);
        } else {
          await bucket.put(mutation.key, mutation.value, {
            ...(mutation.contentType
              ? { httpMetadata: { contentType: mutation.contentType } }
              : {}),
          });
        }
      }

      journal.state = "committed";
      await writeJournal(bucket, journal);
    } catch (error) {
      let restored = false;
      try {
        const recovery = await recoverUnsafe(bucket);
        // A provider may persist the committed marker and then reject its response.
        if (recovery.state === "committed") return;
        restored = recovery.recovered;
      } catch (recoveryError) {
        console.error("Durable storage recovery remains pending.", recoveryError);
      }
      throw new StorageTransactionError(restored, error);
    }

    // A committed journal is cleanup-only; retry cleanup later if needed.
    try {
      await cleanup(bucket, journal);
    } catch (error) {
      console.error("Committed storage transaction needs snapshot cleanup.", error);
    }
  });
}
