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
  size?: number;
  text(): Promise<string>;
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
  /** Keys under a prefix (metadata sidecars excluded), sorted. */
  list(prefix: string): Promise<string[]>;
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
    // Lexical containment alone does not stop a key from traversing a symlink
    // located inside the storage root. Check the configured root and each
    // descendant, but do not compare ordinary ancestors (e.g. C:\\Users) with
    // the storage root: those ancestors must necessarily be outside it.
    const assertNoSymlink = async (target: string) => {
      const canonicalBase = await fs.realpath(base).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return base;
        throw error;
      });
      const relativeTarget = path.relative(base, target);
      if (
        relativeTarget === ".." ||
        relativeTarget.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeTarget)
      ) {
        throw new Error("Unsafe storage key.");
      }

      let current = base;
      const pathsToCheck = [base];
      for (const segment of relativeTarget.split(path.sep).filter(Boolean)) {
        current = path.join(current, segment);
        pathsToCheck.push(current);
      }
      for (const candidate of pathsToCheck) {
        try {
          const stat = await fs.lstat(candidate);
          if (stat.isSymbolicLink()) {
            throw new Error("Storage path must not traverse symbolic links.");
          }
          const canonicalCurrent = await fs.realpath(candidate);
          const relativeCanonical = path.relative(canonicalBase, canonicalCurrent);
          if (
            relativeCanonical === ".." ||
            relativeCanonical.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relativeCanonical)
          ) {
            throw new Error("Storage path resolves outside the configured root.");
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
          throw error;
        }
      }
    };
    return { fs, path, resolve, assertNoSymlink };
  };

  return {
    root,
    async get(key) {
      const { fs, resolve, assertNoSymlink } = await load();
      const file = resolve(key);
      await assertNoSymlink(file);
      await assertNoSymlink(file + META_SUFFIX);
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
        size: bytes.byteLength,
        async text() { return new TextDecoder().decode(bytes); },
        async json<T>() {
          return JSON.parse(new TextDecoder().decode(bytes)) as T;
        },
        async arrayBuffer() {
          return bytes.slice().buffer;
        },
      };
    },
    async put(key, value, options) {
      const { fs, path, resolve, assertNoSymlink } = await load();
      const file = resolve(key);
      await assertNoSymlink(file);
      await assertNoSymlink(file + META_SUFFIX);
      const bytes =
        typeof value === "string"
          ? new TextEncoder().encode(value)
          : value instanceof Uint8Array
            ? value
            : new Uint8Array(value);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await assertNoSymlink(file);
      await assertNoSymlink(file + META_SUFFIX);
      // Write-then-rename so a crash never leaves a half-written index or file.
      const temporary = `${file}.${process.pid}.tmp`;
      await fs.writeFile(temporary, bytes);
      await fs.rename(temporary, file);
      const contentType = options?.httpMetadata?.contentType;
      if (contentType) await fs.writeFile(file + META_SUFFIX, JSON.stringify({ contentType }));
      else await fs.rm(file + META_SUFFIX, { force: true });
    },
    async list(prefix) {
      const { fs, path, assertNoSymlink } = await load();
      const base = path.resolve(root);
      await assertNoSymlink(base);
      const keys: string[] = [];
      const walk = async (dir: string) => {
        let entries: import("node:fs").Dirent[];
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) await walk(full);
          else if (
            entry.isFile() &&
            !entry.name.endsWith(META_SUFFIX) &&
            !entry.name.endsWith(".tmp")
          ) {
            const key = path.relative(base, full).split(path.sep).join("/");
            if (key.startsWith(prefix) && isSafeStorageKey(key)) keys.push(key);
          }
        }
      };
      await walk(base);
      return keys.sort();
    },
    async delete(key) {
      const { fs, resolve, assertNoSymlink } = await load();
      const file = resolve(key);
      await assertNoSymlink(file);
      await assertNoSymlink(file + META_SUFFIX);
      await fs.rm(file, { force: true });
      await fs.rm(file + META_SUFFIX, { force: true });
    },
  };
}
