/**
 * Development-only object storage on the local disk, with the same small API the
 * admin uses from the Cloudflare R2 binding (get / put / delete).
 *
 * Uploads made in `vite dev` survive restarts. Files live under
 * PORTFOLIO_LOCAL_STORAGE_DIR (default `.local-storage/`, git-ignored), using the
 * same keys as R2, e.g. `.local-storage/private-admin/images/files/<id>`.
 * Node's fs is imported lazily so production (Workers + R2) never loads it.
 */

export interface LocalStoredObject {
  json<T>(): Promise<T>;
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string | undefined };
}

export interface LocalDiskBucket {
  readonly root: string;
  get(key: string): Promise<LocalStoredObject | null>;
  put(
    key: string,
    value: ArrayBuffer | string | Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

// Keys are generated server-side; still refuse anything that could leave the root.
const SAFE_KEY = /^(?!.*(?:^|\/)\.\.?(?:\/|$))[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/;
const META_SUFFIX = ".meta.json";

export function isSafeStorageKey(key: string): boolean {
  return SAFE_KEY.test(key) && !key.endsWith(META_SUFFIX) && !key.includes("//");
}

export function createLocalDiskBucket(root: string): LocalDiskBucket {
  const load = async () => {
    const [fs, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
    const base = path.resolve(root);
    const resolve = (key: string) => {
      if (!isSafeStorageKey(key)) throw new Error("Unsafe storage key.");
      const target = path.resolve(base, key);
      if (!target.startsWith(base + path.sep)) throw new Error("Unsafe storage key.");
      return target;
    };
    return { fs, path, resolve };
  };

  return {
    root,
    async get(key) {
      const { fs, resolve } = await load();
      const file = resolve(key);
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(await fs.readFile(file));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
      const meta = await fs
        .readFile(file + META_SUFFIX, "utf8")
        .then((text) => JSON.parse(text) as { contentType?: string })
        .catch(() => ({}) as { contentType?: string });
      return {
        httpMetadata: { contentType: meta.contentType },
        async json<T>() {
          return JSON.parse(new TextDecoder().decode(bytes)) as T;
        },
        async arrayBuffer() {
          return bytes.slice().buffer;
        },
      };
    },
    async put(key, value, options) {
      const { fs, path, resolve } = await load();
      const file = resolve(key);
      const bytes =
        typeof value === "string"
          ? new TextEncoder().encode(value)
          : value instanceof Uint8Array
            ? value
            : new Uint8Array(value);
      await fs.mkdir(path.dirname(file), { recursive: true });
      // Write-then-rename so a crash never leaves a half-written index or file.
      const temporary = `${file}.${process.pid}.tmp`;
      await fs.writeFile(temporary, bytes);
      await fs.rename(temporary, file);
      const contentType = options?.httpMetadata?.contentType;
      if (contentType) await fs.writeFile(file + META_SUFFIX, JSON.stringify({ contentType }));
      else await fs.rm(file + META_SUFFIX, { force: true });
    },
    async delete(key) {
      const { fs, resolve } = await load();
      const file = resolve(key);
      await fs.rm(file, { force: true });
      await fs.rm(file + META_SUFFIX, { force: true });
    },
  };
}
