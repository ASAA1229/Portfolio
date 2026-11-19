import type { PutOptions, StoredObject } from "@/lib/storage-adapter";

/**
 * In-memory stand-in for a Cloudflare R2 bucket binding (tests only).
 *
 * Models the documented R2 behaviours the application depends on: per-object etags, conditional
 * puts via `onlyIf` (resolving `null` when the precondition fails), prefix listing with a
 * cursor, and strong read-after-write consistency. It also supports failure injection and
 * forced interleaving so concurrency and compensation can be exercised deterministically.
 * It is a model of the documented API, not evidence about the hosted service.
 */
export type MemoryR2Op = "get" | "put" | "delete" | "list";

export class MemoryR2 {
  private readonly objects = new Map<
    string,
    { bytes: Uint8Array; contentType: string | undefined; etag: string }
  >();
  private version = 0;
  readonly log: { op: MemoryR2Op; key: string }[] = [];
  /** Called before each operation; throw to inject a failure. */
  hook: ((op: MemoryR2Op, key: string, index: number) => void | Promise<void>) | null = null;
  /** When true every operation yields to the event loop so concurrent callers interleave. */
  interleave = false;
  /** Set to false to model a provider that ignores `onlyIf` (local disk, memory). */
  enforceConditions = true;

  private async before(op: MemoryR2Op, key: string): Promise<void> {
    const index = this.log.length;
    this.log.push({ op, key });
    if (this.interleave) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await this.hook?.(op, key, index);
  }

  async get(key: string): Promise<StoredObject | null> {
    await this.before("get", key);
    const stored = this.objects.get(key);
    if (!stored) return null;
    const bytes = stored.bytes.slice();
    return {
      etag: stored.etag,
      size: bytes.byteLength,
      httpMetadata: { contentType: stored.contentType },
      arrayBuffer: async () => bytes.slice().buffer,
      json: async <T>() => JSON.parse(new TextDecoder().decode(bytes)) as T,
    };
  }

  async put(
    key: string,
    value: ArrayBuffer | string | Uint8Array,
    options?: PutOptions,
  ): Promise<{ key: string; etag: string } | null> {
    await this.before("put", key);
    const current = this.objects.get(key);
    const condition = options?.onlyIf;
    if (condition && this.enforceConditions) {
      if (condition.etagDoesNotMatch !== undefined) {
        const blocked =
          condition.etagDoesNotMatch === "*"
            ? Boolean(current)
            : current?.etag === condition.etagDoesNotMatch;
        if (blocked) return null;
      }
      if (condition.etagMatches !== undefined && current?.etag !== condition.etagMatches) {
        return null;
      }
    }
    const bytes =
      typeof value === "string"
        ? new TextEncoder().encode(value)
        : value instanceof Uint8Array
          ? value.slice()
          : new Uint8Array(value.slice(0));
    this.version += 1;
    const etag = `etag-${this.version}`;
    this.objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType, etag });
    return { key, etag };
  }

  async delete(key: string): Promise<void> {
    await this.before("delete", key);
    this.objects.delete(key);
  }

  async list(options: { prefix?: string; cursor?: string; limit?: number } = {}) {
    await this.before("list", options.prefix ?? "");
    const all = [...this.objects.keys()]
      .filter((key) => key.startsWith(options.prefix ?? ""))
      .sort();
    const start = options.cursor ? Number(options.cursor) : 0;
    const limit = options.limit ?? 1000;
    const page = all.slice(start, start + limit);
    const truncated = start + limit < all.length;
    return {
      objects: page.map((key) => ({ key })),
      truncated,
      ...(truncated ? { cursor: String(start + limit) } : {}),
    };
  }

  // Synchronous inspection helpers (do not count as operations).
  has(key: string): boolean {
    return this.objects.has(key);
  }
  keys(prefix = ""): string[] {
    return [...this.objects.keys()].filter((key) => key.startsWith(prefix)).sort();
  }
  text(key: string): string | null {
    const stored = this.objects.get(key);
    return stored ? new TextDecoder().decode(stored.bytes) : null;
  }
  bytes(key: string): Uint8Array | null {
    return this.objects.get(key)?.bytes.slice() ?? null;
  }
  contentType(key: string): string | undefined {
    return this.objects.get(key)?.contentType;
  }
  snapshot(): Record<string, string> {
    return Object.fromEntries(
      [...this.objects.entries()].map(([key, value]) => [
        key,
        `${value.contentType ?? ""}|${Array.from(value.bytes).join(",")}`,
      ]),
    );
  }
}
