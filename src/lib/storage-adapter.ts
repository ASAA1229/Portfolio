/**
 * Storage adapter contract (PORT-US-041).
 *
 * One small interface for every place the portfolio keeps private/admin data, so
 * the application is not coupled to a single provider:
 *   - R2 (Cloudflare object storage) in deployed environments,
 *   - the local disk bucket in `vite dev` (src/lib/local-disk-bucket.ts),
 *   - in-memory storage for tests and previews.
 * The source of truth for each data class is documented in docs/STORAGE.md.
 */

export interface StoredObject {
  json<T>(): Promise<T>;
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string | undefined };
  size?: number;
}

export interface StorageAdapter {
  readonly kind: "r2" | "local-disk" | "memory";
  get(key: string): Promise<StoredObject | null>;
  put(
    key: string,
    value: ArrayBuffer | string | Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  /** All keys that start with `prefix`, sorted. */
  list(prefix: string): Promise<string[]>;
}

/** Minimal shape of a Cloudflare R2 bucket binding used here. */
export interface R2BucketLike {
  get(key: string): Promise<StoredObject | null>;
  put(
    key: string,
    value: ArrayBuffer | string | Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<unknown>;
  list?(options: { prefix?: string; cursor?: string; limit?: number }): Promise<{
    objects: { key: string }[];
    truncated?: boolean;
    cursor?: string;
  }>;
}

export function r2Adapter(bucket: R2BucketLike): StorageAdapter {
  return {
    kind: "r2",
    get: (key) => bucket.get(key),
    async put(key, value, options) {
      await bucket.put(key, value, options);
    },
    async delete(key) {
      await bucket.delete(key);
    },
    async list(prefix) {
      if (!bucket.list) throw new Error("This R2 binding does not support listing.");
      const keys: string[] = [];
      let cursor: string | undefined;
      // Bounded paging: the admin data set is small; stop at 10k keys.
      for (let page = 0; page < 10; page += 1) {
        const result = await bucket.list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) });
        keys.push(...result.objects.map((object) => object.key));
        if (!result.truncated || !result.cursor) break;
        cursor = result.cursor;
      }
      return keys.sort();
    },
  };
}

export function memoryAdapter(): StorageAdapter {
  const objects = new Map<string, { bytes: Uint8Array; contentType?: string | undefined }>();
  return {
    kind: "memory",
    async get(key) {
      const stored = objects.get(key);
      if (!stored) return null;
      const bytes = stored.bytes.slice();
      return {
        httpMetadata: { contentType: stored.contentType },
        size: bytes.byteLength,
        json: async <T>() => JSON.parse(new TextDecoder().decode(bytes)) as T,
        arrayBuffer: async () => bytes.slice().buffer,
      };
    },
    async put(key, value, options) {
      const bytes =
        typeof value === "string"
          ? new TextEncoder().encode(value)
          : value instanceof Uint8Array
            ? value.slice()
            : new Uint8Array(value.slice(0));
      objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType });
    },
    async delete(key) {
      objects.delete(key);
    },
    async list(prefix) {
      return [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
    },
  };
}

/** Wrap the local disk bucket (already implements get/put/delete/list). */
export function localDiskAdapter(bucket: Omit<StorageAdapter, "kind">): StorageAdapter {
  return {
    kind: "local-disk",
    get: (key) => bucket.get(key),
    put: (key, value, options) => bucket.put(key, value, options),
    delete: (key) => bucket.delete(key),
    list: (prefix) => bucket.list(prefix),
  };
}
