import "./lib/error-capture";
import {
  createBackup,
  MAX_BACKUP_BYTES,
  migrateStorage,
  restoreBackup,
  validateBackup,
} from "@/lib/admin-backup";
import {
  appendAdminAudit,
  bumpSessionEpoch,
  describeAdminAction,
  readAuditLog,
  readSessionEpoch,
} from "@/lib/admin-audit";
import {
  contentKey,
  emptyContentDocument,
  isContentDocument,
  isContentProfileId,
  publishContentDraft,
  publishedContent,
  rollbackContent,
  saveContentDraft,
  unpublishContent,
  validateContentOverrides,
  type ContentDocument,
  type ContentProfileId,
} from "@/lib/cms-content";
import { createLocalDiskBucket } from "@/lib/local-disk-bucket";
import { getPersonProject } from "@/lib/person-portfolios";
import {
  appendHistory,
  emptyHistory,
  historyKey,
  isPublicProfileId,
  isPublishHistory,
  planRollback,
  redactDeletedResume,
  rollbackTargetPublishedAt,
  snapshotOf,
  type ProfileId,
  type PublishHistory,
} from "@/lib/resume-publish-history";
import {
  emptyPersonaDocument,
  isPersonaDocument,
  isPersonaProfileId,
  personaKey,
  publishDraft,
  publishedPersona,
  rollbackTo,
  saveDraft,
  unpublish,
  validatePersonaConfig,
  type PersonaConfig,
  type PersonaDocument,
  type PersonaProfileId,
} from "@/lib/persona";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { extractResumeText } from "./lib/resume-extraction";
import {
  adminAuthConfigured,
  adminCookieHeader,
  clearAdminCookieHeader,
  createAdminCookie,
  isAdminRequest,
  verifyAdminPassword,
} from "./lib/admin-auth";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// Canonicalize repeatedly so encoded and double-encoded admin separators or
// path segments cannot take a different route through the auth boundary.
function normalizedPath(request: Request): string {
  let pathname = new URL(request.url).pathname;
  for (let pass = 0; pass < 4; pass++) {
    try {
      const decoded = decodeURIComponent(pathname);
      if (decoded === pathname) break;
      pathname = decoded;
    } catch {
      // Fail closed: malformed paths must never reach an unprotected handler.
      return "/__invalid_encoded_path__";
    }
  }
  // Do not pass a still-encoded path to a downstream router with different
  // decoding behavior after the bounded canonicalization passes.
  if (/%[0-9a-f]{2}/i.test(pathname)) return "/__invalid_encoded_path__";
  return pathname.toLowerCase().replace(/\/+$/, "") || "/";
}

function isAdminPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_TRACKED_LOGIN_CLIENTS = 4096;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Private admin pages must never be indexed, even when a crawler reaches them.
function withNoindex(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function privateNotFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

// Short public caching for published (already-approved) content. Unpublishing or
// replacing takes effect within this window; private/admin responses stay no-store.
const PUBLIC_FEED_CACHE = "public, max-age=60, must-revalidate";
const PUBLIC_IMAGE_CACHE = "public, max-age=300, must-revalidate";

function jsonResponse(body: unknown, status: number, headers?: HeadersInit): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...Object.fromEntries(new Headers(headers)),
    },
  });
}

export async function limitRequestBody(
  request: Request,
  maxBytes: number,
): Promise<Request | Response> {
  // Snapshot request metadata before consuming the body. Some runtimes (srvx on
  // Node, used by `vite dev`/preview) build the underlying Request lazily on the
  // first access to properties such as `redirect`; doing that after the stream
  // was read throws "Response body object should not be disturbed or locked".
  const { url, method, redirect } = request;
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  const rawLength = request.headers.get("content-length");
  if (rawLength !== null) {
    if (!/^\d+$/.test(rawLength)) return jsonResponse({ error: "Invalid content length." }, 400);
    const declaredLength = Number(rawLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength > maxBytes) {
      return jsonResponse({ error: "Request body exceeds the allowed size." }, 413);
    }
  }
  if (!request.body) return request;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return jsonResponse({ error: "Request body exceeds the allowed size." }, 413);
      }
      chunks.push(value);
    }
  } catch {
    return jsonResponse({ error: "Could not read request body." }, 400);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Request(url, { method, headers, body, redirect });
}

function adminAuthBypassed(env: unknown): boolean {
  // Local Vite development is detected using Vite's compile-time DEV/MODE
  // flags below. Worker/preview requests use explicit runtime bindings.
  const bindings = env as
    | {
        PORTFOLIO_ADMIN_AUTH_BYPASS?: unknown;
        ENVIRONMENT?: unknown;
      }
    | undefined;

  const runtimeBypass =
    bindings?.PORTFOLIO_ADMIN_AUTH_BYPASS === "true" && bindings?.ENVIRONMENT === "development";

  // Vite replaces these at bundle time, which is more reliable than process.env
  // in the Cloudflare/TanStack server runtime. import.meta.env.DEV alone is not
  // enough: `vite build --mode development` also sets it. The marker is defined
  // only by the local `vite dev` server (see vite.config.ts).
  const localDevBypass =
    typeof __PORTFOLIO_VITE_DEV_SERVER__ !== "undefined" &&
    __PORTFOLIO_VITE_DEV_SERVER__ === true &&
    import.meta.env.DEV === true &&
    import.meta.env.MODE === "development";

  return runtimeBypass || localDevBypass;
}

async function isAdminAuthorized(request: Request, env: unknown): Promise<boolean> {
  if (adminAuthBypassed(env)) return true;
  // Cookies are bound to the current session epoch ("log out everywhere").
  const epoch = await readSessionEpoch(resolvePrivateBucket(env));
  return isAdminRequest(request, env, epoch);
}

async function handleAdminAuth(request: Request, env: unknown): Promise<Response | null> {
  const path = normalizedPath(request);
  if (path === "/api/admin/login" && request.method === "POST") {
    const boundedRequest = await limitRequestBody(request, 4 * 1024);
    if (boundedRequest instanceof Response) return boundedRequest;
    request = boundedRequest;
    if (!adminAuthConfigured(env)) {
      console.error("Admin authentication is disabled: required server secrets are missing.");
      return jsonResponse({ error: "Admin authentication is not configured." }, 503);
    }
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return privateNotFound();

    // Only trust the platform-provided client address. X-Forwarded-For is
    // caller-controlled unless a trusted proxy explicitly sanitizes it, so
    // accepting it here would let clients rotate spoofed identities to bypass
    // the per-client login throttle.
    const clientKey = (request.headers.get("cf-connecting-ip") ?? "unknown").slice(0, 128);
    const now = Date.now();
    for (const [key, attempt] of loginAttempts) {
      if (attempt.resetAt <= now) loginAttempts.delete(key);
    }
    const current = loginAttempts.get(clientKey);
    if (current && current.resetAt > now && current.count >= MAX_LOGIN_ATTEMPTS) {
      return jsonResponse({ error: "Too many attempts. Try again in 15 minutes." }, 429, {
        "retry-after": String(Math.ceil((current.resetAt - now) / 1000)),
      });
    }

    const payload = (await request.json().catch(() => null)) as { password?: unknown } | null;
    const password = typeof payload?.password === "string" ? payload.password : "";
    const valid =
      password.length > 0 && password.length <= 1024 && (await verifyAdminPassword(password, env));
    if (!valid) {
      if (!current && loginAttempts.size >= MAX_TRACKED_LOGIN_CLIENTS) {
        return jsonResponse({ error: "Too many login attempts. Try again shortly." }, 429, {
          "retry-after": "60",
        });
      }
      loginAttempts.set(
        clientKey,
        current && current.resetAt > now
          ? { count: current.count + 1, resetAt: current.resetAt }
          : { count: 1, resetAt: now + LOGIN_WINDOW_MS },
      );
      return jsonResponse({ error: "Invalid credentials." }, 401);
    }

    loginAttempts.delete(clientKey);
    const cookie = await createAdminCookie(env, await readSessionEpoch(resolvePrivateBucket(env)));
    if (!cookie) return jsonResponse({ error: "Admin authentication is not configured." }, 503);
    return jsonResponse({ ok: true }, 200, {
      "set-cookie": adminCookieHeader(cookie, new URL(request.url).protocol === "https:"),
    });
  }

  if (path === "/api/admin/logout" && request.method === "POST") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return privateNotFound();
    if (!(await isAdminAuthorized(request, env))) return privateNotFound();
    return jsonResponse({ ok: true }, 200, {
      "set-cookie": clearAdminCookieHeader(new URL(request.url).protocol === "https:"),
    });
  }

  if (path === "/api/admin/logout-all" && request.method === "POST") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return privateNotFound();
    if (!(await isAdminAuthorized(request, env))) return privateNotFound();
    const bucket = resolvePrivateBucket(env);
    if (!bucket) return bucketNotConfigured();
    try {
      await bumpSessionEpoch(bucket);
    } catch (error) {
      return storageFailure(error, "end all admin sessions");
    }
    return jsonResponse({ ok: true, endedAllSessions: true }, 200, {
      "set-cookie": clearAdminCookieHeader(new URL(request.url).protocol === "https:"),
    });
  }

  if (path === "/api/admin/session" && request.method === "GET") {
    if (!(await isAdminAuthorized(request, env))) return privateNotFound();
    return jsonResponse({ authenticated: true }, 200);
  }

  if (path === "/api/admin/audit" && request.method === "GET") {
    if (!(await isAdminAuthorized(request, env))) return privateNotFound();
    const bucket = resolvePrivateBucket(env);
    if (!bucket) return bucketNotConfigured();
    try {
      const log = await readAuditLog(bucket);
      return jsonResponse(
        { startedAt: log.startedAt, entries: [...log.entries].reverse().slice(0, 500) },
        200,
      );
    } catch (error) {
      return storageFailure(error, "read the admin audit log");
    }
  }

  return null;
}

type StructuredResumeEntry = {
  title?: string;
  organization?: string;
  role?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  technologies?: string[];
  url?: string;
  credentialId?: string;
  grade?: string;
};

type ResumeRecord = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  status: "pending" | "approved";
  profileId?: "abhishek" | "ammu" | "bava" | "sai" | "unassigned" | undefined;
  displayName: string;
  headline: string;
  summary: string;
  skills: string[];
  contact?: { email?: string; phone?: string; linkedin?: string; github?: string } | undefined;
  structuredSections?:
    | {
        experience: (string | StructuredResumeEntry)[];
        education: (string | StructuredResumeEntry)[];
        projects: (string | StructuredResumeEntry)[];
        certifications: (string | StructuredResumeEntry)[];
      }
    | undefined;
  privateReviewNotes?: string | undefined;
};

type PrivateBucket = {
  get(key: string): Promise<{
    json<T>(): Promise<T>;
    arrayBuffer(): Promise<ArrayBuffer>;
    httpMetadata?: { contentType?: string | undefined };
  } | null>;
  put(
    key: string,
    value: ArrayBuffer | string | Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<unknown>;
};

type AdminEnv = {
  RESUME_BUCKET?: PrivateBucket;
};

/**
 * Local-only object storage keeps admin content workflows usable under Vite.
 * It is intentionally process-memory-only; deployed environments must bind R2.
 */
let localDevelopmentBucket: PrivateBucket | undefined;

/**
 * In `vite dev` (no R2 binding) admin uploads are stored on the local disk so they
 * survive dev-server restarts: PORTFOLIO_LOCAL_STORAGE_DIR, default `.local-storage/`
 * (git-ignored). Deployed environments must bind the RESUME_BUCKET R2 bucket.
 */
function resolvePrivateBucket(env: unknown): PrivateBucket | undefined {
  const configured = (env as AdminEnv | undefined)?.RESUME_BUCKET;
  if (configured) return configured;
  if (import.meta.env.DEV !== true) return undefined;
  localDevelopmentBucket ??= createLocalDiskBucket(
    process.env["PORTFOLIO_LOCAL_STORAGE_DIR"] || ".local-storage",
  );
  return localDevelopmentBucket;
}

function isLocalDevelopmentBucket(bucket: PrivateBucket): boolean {
  return bucket === localDevelopmentBucket;
}

const RESUME_INDEX_KEY = "private-admin/resumes/index.json";
const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const ALLOWED_RESUME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function isValidPublicContact(value: unknown): value is NonNullable<ResumeRecord["contact"]> {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const contact = value as Record<string, unknown>;
  if (Object.keys(contact).some((key) => !["email", "phone", "linkedin", "github"].includes(key)))
    return false;
  for (const key of ["email", "phone", "linkedin", "github"] as const) {
    const item = contact[key];
    if (item !== undefined && (typeof item !== "string" || item.length > 320)) return false;
    if (typeof item === "string" && (item.includes("\n") || item.includes("\r"))) return false;
  }
  if (
    typeof contact["email"] === "string" &&
    contact["email"] &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact["email"])
  )
    return false;
  if (
    typeof contact["linkedin"] === "string" &&
    contact["linkedin"] &&
    !/^https:\/\//i.test(contact["linkedin"])
  )
    return false;
  if (
    typeof contact["github"] === "string" &&
    contact["github"] &&
    !/^https:\/\//i.test(contact["github"])
  )
    return false;
  return true;
}

function isValidStructuredEntry(value: unknown): boolean {
  if (typeof value === "string") return value.length <= 2000;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  const allowed = [
    "title",
    "organization",
    "role",
    "location",
    "startDate",
    "endDate",
    "description",
    "technologies",
    "url",
    "credentialId",
    "grade",
  ];
  if (Object.keys(entry).some((key) => !allowed.includes(key))) return false;
  for (const key of [
    "title",
    "organization",
    "role",
    "location",
    "startDate",
    "endDate",
    "description",
    "url",
    "credentialId",
    "grade",
  ]) {
    if (
      entry[key] !== undefined &&
      (typeof entry[key] !== "string" ||
        String(entry[key]).length > (key === "description" ? 2000 : 320))
    )
      return false;
  }
  if (
    entry["technologies"] !== undefined &&
    (!Array.isArray(entry["technologies"]) ||
      entry["technologies"].length > 30 ||
      entry["technologies"].some((item) => typeof item !== "string" || item.length > 80))
  )
    return false;
  if (typeof entry["url"] === "string" && entry["url"] && !/^https:\/\//i.test(entry["url"]))
    return false;
  return true;
}

function isValidStructuredSections(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const sections = value as Record<string, unknown>;
  const names = ["experience", "education", "projects", "certifications"];
  return (
    Object.keys(sections).every((key) => names.includes(key)) &&
    names.every(
      (name) =>
        sections[name] === undefined ||
        (Array.isArray(sections[name]) &&
          (sections[name] as unknown[]).length <= 40 &&
          (sections[name] as unknown[]).every(isValidStructuredEntry)),
    )
  );
}

function sanitizeStructuredEntry(
  value: string | StructuredResumeEntry,
  maxLength: number,
): string | StructuredResumeEntry {
  if (typeof value === "string") return value.trim().slice(0, maxLength);
  const result: StructuredResumeEntry = {};
  for (const key of [
    "title",
    "organization",
    "role",
    "location",
    "startDate",
    "endDate",
    "description",
    "url",
    "credentialId",
    "grade",
  ] as const) {
    const item = value[key];
    if (typeof item === "string")
      result[key] = item.trim().slice(0, key === "description" ? 2000 : 320);
  }
  if (Array.isArray(value.technologies))
    result.technologies = value.technologies
      .slice(0, 30)
      .filter((item) => typeof item === "string")
      .map((item) => item.trim().slice(0, 80));
  if (result.url && !/^https:\/\//i.test(result.url)) delete result.url;
  return result;
}

function isResumeRecord(value: unknown): value is ResumeRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<ResumeRecord>;
  const validProfiles = ["abhishek", "ammu", "bava", "sai", "unassigned"];
  const sections = record.structuredSections;
  return (
    typeof record.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.id) &&
    typeof record.filename === "string" &&
    record.filename.length > 0 &&
    record.filename.length <= 120 &&
    ALLOWED_RESUME_TYPES.has(String(record.contentType)) &&
    Number.isSafeInteger(record.size) &&
    Number(record.size) > 0 &&
    Number(record.size) <= MAX_RESUME_BYTES &&
    typeof record.uploadedAt === "string" &&
    Number.isFinite(Date.parse(record.uploadedAt)) &&
    (record.status === "pending" || record.status === "approved") &&
    (record.profileId === undefined || validProfiles.includes(record.profileId)) &&
    typeof record.displayName === "string" &&
    typeof record.headline === "string" &&
    typeof record.summary === "string" &&
    Array.isArray(record.skills) &&
    isValidPublicContact(record.contact) &&
    record.skills.every((skill) => typeof skill === "string") &&
    (record.privateReviewNotes === undefined || typeof record.privateReviewNotes === "string") &&
    isValidStructuredSections(sections)
  );
}

async function readResumeIndex(bucket: PrivateBucket): Promise<ResumeRecord[]> {
  const object = await bucket.get(RESUME_INDEX_KEY);
  if (!object) return [];
  const value = await object.json<unknown>();
  if (!Array.isArray(value) || !value.every(isResumeRecord)) {
    throw new Error("Stored resume index failed integrity validation.");
  }
  const ids = new Set(value.map((record) => record.id));
  if (ids.size !== value.length) {
    throw new Error("Stored resume index contains duplicate record IDs.");
  }
  return value;
}

async function writeResumeIndex(bucket: PrivateBucket, records: ResumeRecord[]): Promise<void> {
  await bucket.put(RESUME_INDEX_KEY, JSON.stringify(records), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function writePublishedResumeFeed(
  bucket: PrivateBucket,
  records: ResumeRecord[],
): Promise<void> {
  const publicResumes = records
    .filter(
      (item) => item.status === "approved" && !!item.profileId && item.profileId !== "unassigned",
    )
    .map(
      ({
        id,
        profileId,
        displayName,
        headline,
        summary,
        skills,
        contact,
        structuredSections,
        uploadedAt,
      }) => ({
        id,
        uploadedAt,
        profileId,
        displayName,
        headline,
        summary,
        skills,
        contact: contact ?? {},
        structuredSections: structuredSections ?? {
          experience: [],
          education: [],
          projects: [],
          certifications: [],
        },
      }),
    );

  await bucket.put(
    "public/approved-resumes.json",
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      resumes: publicResumes,
    }),
    {
      httpMetadata: {
        contentType: "application/json; charset=utf-8",
        cacheControl: "no-store",
      },
    } as { httpMetadata?: { contentType?: string; cacheControl?: string } },
  );
}

async function readPublishHistory(
  bucket: PrivateBucket,
  profileId: ProfileId,
): Promise<PublishHistory> {
  const object = await bucket.get(historyKey(profileId));
  if (!object) return emptyHistory(profileId);
  const value = await object.json<unknown>();
  if (!isPublishHistory(value, profileId)) {
    throw new Error("Stored publish history failed integrity validation.");
  }
  return value;
}

async function writePublishHistory(bucket: PrivateBucket, history: PublishHistory): Promise<void> {
  await bucket.put(historyKey(history.profileId), JSON.stringify(history), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

class StorageCommitError extends Error {
  constructor(
    readonly restored: boolean,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : "Storage write failed.");
  }
}

/**
 * Persist a resume state change: private index, then public feed, then publish
 * history. If any write fails, already-applied writes are reverted in reverse order
 * so the public feed never references a state the private index does not hold.
 */
async function commitResumeState(
  bucket: PrivateBucket,
  before: ResumeRecord[],
  after: ResumeRecord[],
  history?: { before: PublishHistory; after: PublishHistory },
): Promise<void> {
  const steps: Array<{ apply: () => Promise<void>; undo: () => Promise<void> }> = [
    { apply: () => writeResumeIndex(bucket, after), undo: () => writeResumeIndex(bucket, before) },
    {
      apply: () => writePublishedResumeFeed(bucket, after),
      undo: () => writePublishedResumeFeed(bucket, before),
    },
  ];
  if (history) {
    steps.push({
      apply: () => writePublishHistory(bucket, history.after),
      undo: () => writePublishHistory(bucket, history.before),
    });
  }
  const attempted: typeof steps = [];
  for (const step of steps) {
    // Include the current step before awaiting it: an object-store operation can
    // commit its write and still reject (for example, a transport error after the
    // provider accepted the object). Compensate that ambiguous write as well as
    // every earlier successful step, in reverse order.
    attempted.push(step);
    try {
      await step.apply();
    } catch (error) {
      let restored = true;
      for (const done of attempted.reverse()) {
        try {
          await done.undo();
        } catch (undoError) {
          restored = false;
          console.error("Could not revert a partial resume storage update.", undoError);
        }
      }
      throw new StorageCommitError(restored, error);
    }
  }
}

function storageFailure(error: unknown, operation: string): Response {
  const restored = error instanceof StorageCommitError ? error.restored : false;
  console.error(`Resume ${operation} failed while writing storage.`, error);
  return jsonResponse(
    {
      error: restored
        ? `The ${operation} could not be saved. Nothing was changed; please retry.`
        : `The ${operation} failed part-way and could not be fully reverted. Refresh and review the published state before retrying.`,
      code: "RESUME_STORAGE_COMMIT_FAILED",
      restored,
      ...(import.meta.env.DEV === true
        ? { detail: error instanceof Error ? error.message : "Unknown storage error." }
        : {}),
    },
    500,
  );
}

function imageStorageFailure(error: unknown, operation: string): Response {
  const restored = !(error instanceof StorageCommitError) || error.restored;
  console.error(`Portfolio image ${operation} failed while writing storage.`, error);
  return jsonResponse(
    {
      error: restored
        ? `The image ${operation} could not be saved. Nothing was changed; please retry.`
        : `The image ${operation} failed part-way and could not be fully reverted. Refresh and review the published state before retrying.`,
      code: "IMAGE_STORAGE_COMMIT_FAILED",
      restored,
      ...(import.meta.env.DEV === true
        ? { detail: error instanceof Error ? error.message : "Unknown storage error." }
        : {}),
    },
    500,
  );
}

function bucketNotConfigured(): Response {
  return jsonResponse(
    {
      error:
        "Private content storage is unavailable. Configure the RESUME_BUCKET binding for persistent storage.",
    },
    503,
  );
}

async function handleResumeApi(request: Request, env: unknown): Promise<Response | null> {
  const path = normalizedPath(request);
  if (!path.startsWith("/api/admin/resumes") && path !== "/api/published-resumes" && !path.startsWith("/api/published-resumes/")) return null;
  if (path === "/api/published-resumes" && request.method === "GET") {
    const publicBucket = resolvePrivateBucket(env);
    if (!publicBucket) return jsonResponse({ updatedAt: null, resumes: [] }, 200);
    const published = await publicBucket.get("public/approved-resumes.json");
    return published
      ? new Response(await published.arrayBuffer(), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": PUBLIC_FEED_CACHE,
            "x-content-type-options": "nosniff",
          },
        })
      : jsonResponse({ updatedAt: null, resumes: [] }, 200);
  }
  const publishedResumeFile = path.match(/^\/api\/published-resumes\/([a-f0-9-]{36})$/);
  if (publishedResumeFile && request.method === "GET") {
    const publicBucket = resolvePrivateBucket(env);
    if (!publicBucket) return privateNotFound();
    const records = await readResumeIndex(publicBucket);
    const record = records.find(
      (item) =>
        item.id === publishedResumeFile[1] &&
        item.status === "approved" &&
        isPublicProfileId(item.profileId),
    );
    if (!record) return privateNotFound();
    const object = await publicBucket.get(`private-admin/resumes/files/${record.id}`);
    if (!object) return privateNotFound();
    const safeFilename = record.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "resume";
    return new Response(await object.arrayBuffer(), {
      headers: {
        "content-type": record.contentType,
        "content-disposition": `attachment; filename="${safeFilename}"`,
        "cache-control": PUBLIC_FEED_CACHE,
        "x-content-type-options": "nosniff",
      },
    });
  }
  if (!(await isAdminAuthorized(request, env))) return privateNotFound();
  if (["POST", "DELETE", "PUT", "PATCH"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return privateNotFound();
  }
  if (path === "/api/admin/resumes" && request.method === "POST") {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_RESUME_BYTES + 1024 * 1024) {
      return jsonResponse({ error: "Upload exceeds the 10 MB limit." }, 413);
    }
  }
  if (path === "/api/admin/resumes" && request.method === "POST") {
    const boundedRequest = await limitRequestBody(request, MAX_RESUME_BYTES + 1024 * 1024);
    if (boundedRequest instanceof Response) return boundedRequest;
    request = boundedRequest;
  }
  const bucket = resolvePrivateBucket(env);
  if (!bucket) return bucketNotConfigured();

  if (path === "/api/admin/resumes" && request.method === "GET") {
    return jsonResponse({ resumes: await readResumeIndex(bucket) }, 200);
  }

  if (path === "/api/admin/resumes" && request.method === "POST") {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file") ?? null;
    const requestedProfile = form?.get("profileId");
    if (!isUploadedResumeFile(file))
      return jsonResponse({ error: "Choose a PDF or DOCX resume." }, 400);
    if (
      typeof requestedProfile !== "string" ||
      !["abhishek", "ammu", "bava", "sai", "unassigned"].includes(requestedProfile)
    ) {
      return jsonResponse({ error: "Choose a valid profile assignment." }, 400);
    }
    const type =
      file.type ||
      (file.name.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : file.name.toLowerCase().endsWith(".docx")
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "");
    if (!ALLOWED_RESUME_TYPES.has(type))
      return jsonResponse({ error: "Only PDF and DOCX files are allowed." }, 415);
    if (file.size <= 0 || file.size > MAX_RESUME_BYTES)
      return jsonResponse({ error: "File must be between 1 byte and 10 MB." }, 413);

    // Validate the extension and file signature rather than trusting client MIME metadata alone.
    const lowerName = file.name.toLowerCase();
    const isPdf = type === "application/pdf";
    const isDocx =
      type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if ((isPdf && !lowerName.endsWith(".pdf")) || (isDocx && !lowerName.endsWith(".docx"))) {
      return jsonResponse(
        { error: "The file extension must match its declared PDF or DOCX type." },
        415,
      );
    }
    const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const hasPdfSignature =
      header.length >= 5 &&
      header[0] === 0x25 &&
      header[1] === 0x50 &&
      header[2] === 0x44 &&
      header[3] === 0x46 &&
      header[4] === 0x2d;
    const hasZipSignature =
      header.length >= 4 &&
      header[0] === 0x50 &&
      header[1] === 0x4b &&
      ((header[2] === 0x03 && header[3] === 0x04) ||
        (header[2] === 0x05 && header[3] === 0x06) ||
        (header[2] === 0x07 && header[3] === 0x08));
    if ((isPdf && !hasPdfSignature) || (isDocx && !hasZipSignature)) {
      return jsonResponse(
        { error: "The file content does not match a supported PDF or DOCX file." },
        415,
      );
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120) || "resume";
    const id = crypto.randomUUID();
    const key = `private-admin/resumes/files/${id}`;
    let storedFile = false;
    try {
      await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: type } });
      storedFile = true;
      const records = await readResumeIndex(bucket);
      const record: ResumeRecord = {
        id,
        filename: safeName,
        contentType: type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        status: "pending",
        profileId: requestedProfile as ResumeRecord["profileId"],
        displayName: safeName.replace(/\.(pdf|docx)$/i, ""),
        headline: "",
        summary: "",
        skills: [],
        structuredSections: { experience: [], education: [], projects: [], certifications: [] },
      };
      records.push(record);
      await writeResumeIndex(bucket, records);
      return jsonResponse({ resume: record }, 201);
    } catch (error) {
      if (storedFile) {
        try {
          await bucket.delete(key);
        } catch (cleanupError) {
          console.error("Failed to clean up an incomplete resume upload.", cleanupError);
        }
      }
      console.error("Portfolio resume upload failed while storing or indexing the resume.", error);
      return jsonResponse(
        {
          error:
            "Resume upload failed while saving the file. Check the development server terminal for the detailed cause and retry.",
          code: "RESUME_UPLOAD_STORAGE_FAILED",
          ...(import.meta.env.DEV === true
            ? { detail: error instanceof Error ? error.message : "Unknown resume storage error." }
            : {}),
        },
        500,
      );
    }
  }

  // Publish history for one profile (public fields + timestamps only).
  if (path === "/api/admin/resumes/history" && request.method === "GET") {
    const profileId = new URL(request.url).searchParams.get("profileId");
    if (!isPublicProfileId(profileId)) {
      return jsonResponse({ error: "Choose a public profile." }, 400);
    }
    const history = await readPublishHistory(bucket, profileId);
    const records = await readResumeIndex(bucket);
    const current = records.find(
      (item) => item.profileId === profileId && item.status === "approved",
    );
    return jsonResponse(
      {
        profileId,
        currentResumeId: current?.id ?? null,
        // publishedAt of the version a rollback would restore (append-only history).
        rollbackTarget: rollbackTargetPublishedAt(history, current?.id ?? null),
        entries: history.entries
          .map(({ resumeId, publishedAt, displayName, headline, kind, restoredPublishedAt }) => ({
            resumeId,
            publishedAt,
            displayName,
            headline,
            kind: kind ?? "publish",
            ...(restoredPublishedAt ? { restoredPublishedAt } : {}),
            resumeStillStored: records.some((item) => item.id === resumeId),
          }))
          .reverse(),
      },
      200,
    );
  }

  // Consistency report: the private index is the source of truth for the public feed.
  if (
    (path === "/api/admin/resumes/consistency" && request.method === "GET") ||
    (path === "/api/admin/resumes/reconcile" && request.method === "POST")
  ) {
    const records = await readResumeIndex(bucket);
    const expected = records
      .filter(
        (item) => item.status === "approved" && !!item.profileId && item.profileId !== "unassigned",
      )
      .map((item) => item.id)
      .sort();
    const feedObject = await bucket.get("public/approved-resumes.json");
    const feed = feedObject
      ? ((await feedObject.json<unknown>().catch(() => null)) as {
          resumes?: Array<{ id?: unknown }>;
        } | null)
      : null;
    const feedIds = Array.isArray(feed?.resumes)
      ? feed.resumes.map((item) => (typeof item?.id === "string" ? item.id : "")).sort()
      : null;
    const missingFiles: string[] = [];
    for (const record of records) {
      if (!(await bucket.get(`private-admin/resumes/files/${record.id}`)))
        missingFiles.push(record.id);
    }
    const feedInSync =
      feedIds !== null &&
      feedIds.length === expected.length &&
      feedIds.every((id, index) => id === expected[index]);
    if (request.method === "GET") {
      return jsonResponse(
        {
          feedInSync,
          feedReadable: feedIds !== null || !feedObject,
          expectedPublished: expected,
          feedPublished: feedIds ?? [],
          missingFiles,
        },
        200,
      );
    }
    if (missingFiles.length) {
      return jsonResponse(
        {
          error: "Resume reconciliation was blocked because one or more indexed originals are missing.",
          code: "RESUME_ORIGINALS_MISSING",
          missingFiles,
          reconciled: false,
        },
        409,
      );
    }
    const boundedRequest = await limitRequestBody(request, 1024);
    if (boundedRequest instanceof Response) return boundedRequest;
    try {
      await writePublishedResumeFeed(bucket, records);
    } catch (error) {
      return storageFailure(error, "reconcile");
    }
    console.info("Portfolio resume feed reconciled from the private index.", {
      published: expected.length,
      wasInSync: feedInSync,
    });
    return jsonResponse(
      { reconciled: true, wasInSync: feedInSync, published: expected, missingFiles },
      200,
    );
  }

  // Restore the previously published version for a profile.
  if (path === "/api/admin/resumes/rollback" && request.method === "POST") {
    const boundedRequest = await limitRequestBody(request, 4 * 1024);
    if (boundedRequest instanceof Response) return boundedRequest;
    const payload = (await boundedRequest.json().catch(() => null)) as {
      profileId?: unknown;
    } | null;
    const profileId = payload?.profileId;
    if (!isPublicProfileId(profileId)) {
      return jsonResponse({ error: "Choose a public profile to roll back." }, 400);
    }
    const records = await readResumeIndex(bucket);
    const history = await readPublishHistory(bucket, profileId);
    const current = records.find(
      (item) => item.profileId === profileId && item.status === "approved",
    );
    const plan = planRollback(history, current?.id);
    if (!plan.ok) return jsonResponse({ error: plan.reason }, 409);
    const targetIndex = records.findIndex((item) => item.id === plan.target.resumeId);
    if (targetIndex < 0) {
      return jsonResponse(
        {
          error:
            "The earlier version's resume record was deleted, so it cannot be restored. Upload and publish it again.",
        },
        409,
      );
    }
    const target = records[targetIndex]!;
    const after = records.map((item) =>
      item.profileId === profileId && item.status === "approved" && item.id !== target.id
        ? { ...item, status: "pending" as const }
        : item,
    );
    after[targetIndex] = {
      ...target,
      profileId,
      displayName: plan.target.displayName,
      headline: plan.target.headline,
      summary: plan.target.summary,
      skills: [...plan.target.skills],
      contact: plan.target.contact,
      structuredSections:
        (plan.target.structuredSections as ResumeRecord["structuredSections"]) ??
        target.structuredSections,
      status: "approved",
    };
    try {
      await commitResumeState(bucket, records, after, { before: history, after: plan.next });
    } catch (error) {
      return storageFailure(error, "rollback");
    }
    // Operational log without private review notes or resume content.
    console.info("Portfolio resume rolled back.", {
      profileId,
      from: current?.id ?? null,
      to: target.id,
      restoredPublishedAt: plan.target.publishedAt,
    });
    return jsonResponse({ resume: after[targetIndex], restoredFrom: plan.target.publishedAt }, 200);
  }

  const match = path.match(
    /^\/api\/admin\/resumes\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/(download|extract|publish|draft|unpublish))?$/i,
  );
  if (match) {
    const [, id, action] = match;
    const records = await readResumeIndex(bucket);
    // Snapshot of the stored state, used to revert partial writes.
    const original = records.map((item) => ({ ...item }));
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) return privateNotFound();
    const record = records[index];
    if (!record) return privateNotFound();
    const fileKey = `private-admin/resumes/files/${id}`;

    if (action === "extract" && request.method === "POST") {
      const object = await bucket.get(fileKey);
      if (!object) return privateNotFound();
      try {
        const extracted = await extractResumeText(
          new Uint8Array(await object.arrayBuffer()),
          record.contentType,
        );
        return jsonResponse(
          {
            text: extracted.text,
            method: extracted.method,
            warning: extracted.warning ?? null,
          },
          200,
        );
      } catch (error) {
        return jsonResponse(
          {
            error:
              error instanceof Error ? error.message : "Could not extract text from this resume.",
          },
          422,
        );
      }
    }

    if (action === "download" && request.method === "GET") {
      const object = await bucket.get(fileKey);
      if (!object) return privateNotFound();
      const bytes = await object.arrayBuffer();
      return new Response(bytes, {
        headers: {
          "content-type": record.contentType,
          "content-disposition": `attachment; filename="${record.filename.replace(/["\\\\]/g, "_")}"`,
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      });
    }

    if (action === "draft" && request.method === "POST") {
      const boundedRequest = await limitRequestBody(request, 32 * 1024);
      if (boundedRequest instanceof Response) return boundedRequest;
      request = boundedRequest;
      const payload = (await request.json().catch(() => null)) as Partial<ResumeRecord> | null;
      if (
        !payload ||
        typeof payload.displayName !== "string" ||
        typeof payload.headline !== "string" ||
        typeof payload.summary !== "string" ||
        !Array.isArray(payload.skills) ||
        payload.skills.some((skill) => typeof skill !== "string") ||
        !isValidPublicContact(payload.contact) ||
        !isValidStructuredSections(payload.structuredSections) ||
        (payload.privateReviewNotes !== undefined &&
          typeof payload.privateReviewNotes !== "string") ||
        !["abhishek", "ammu", "bava", "sai", "unassigned"].includes(String(payload.profileId))
      ) {
        return jsonResponse(
          { error: "Provide valid reviewed details and select the correct profile." },
          400,
        );
      }
      records[index] = {
        ...record,
        profileId: payload.profileId as ResumeRecord["profileId"],
        displayName: payload.displayName.slice(0, 120),
        headline: payload.headline.slice(0, 180),
        summary: payload.summary.slice(0, 3000),
        skills: payload.skills.slice(0, 60).map((skill) => skill.slice(0, 80)),
        // Replace the public contact block on every draft save. Omitting a
        // previously supplied field must remove it rather than silently retaining
        // stale contact details from an older publication.
        contact:
          payload.contact &&
          Object.values(payload.contact).some((value) => typeof value === "string" && value.trim())
            ? payload.contact
            : undefined,
        structuredSections: {
          experience: (
            payload.structuredSections?.experience ??
            record.structuredSections?.experience ??
            []
          )
            .slice(0, 30)
            .map((entry) => sanitizeStructuredEntry(entry, 1200)),
          education: (
            payload.structuredSections?.education ??
            record.structuredSections?.education ??
            []
          )
            .slice(0, 20)
            .map((entry) => sanitizeStructuredEntry(entry, 1200)),
          projects: (
            payload.structuredSections?.projects ??
            record.structuredSections?.projects ??
            []
          )
            .slice(0, 30)
            .map((entry) => sanitizeStructuredEntry(entry, 1200)),
          certifications: (
            payload.structuredSections?.certifications ??
            record.structuredSections?.certifications ??
            []
          )
            .slice(0, 40)
            .map((entry) => sanitizeStructuredEntry(entry, 500)),
        },
        privateReviewNotes: (payload.privateReviewNotes ?? record.privateReviewNotes ?? "").slice(
          0,
          12000,
        ),
        status: "pending",
      };
      try {
        await commitResumeState(bucket, original, records);
      } catch (error) {
        return storageFailure(error, "draft save");
      }
      return jsonResponse({ resume: records[index] }, 200);
    }
    if (action === "unpublish" && request.method === "POST") {
      if (record.status !== "approved")
        return jsonResponse({ error: "This resume is not currently published." }, 409);
      // Public visibility is removed; the private original and history are kept.
      records[index] = { ...record, status: "pending" };
      try {
        await commitResumeState(bucket, original, records);
      } catch (error) {
        return storageFailure(error, "unpublish");
      }
      return jsonResponse({ resume: records[index] }, 200);
    }

    if (action === "publish" && request.method === "POST") {
      const boundedRequest = await limitRequestBody(request, 32 * 1024);
      if (boundedRequest instanceof Response) return boundedRequest;
      request = boundedRequest;
      const payload = (await request.json().catch(() => null)) as Partial<ResumeRecord> | null;
      if (
        !payload ||
        typeof payload.displayName !== "string" ||
        typeof payload.headline !== "string" ||
        typeof payload.summary !== "string" ||
        !Array.isArray(payload.skills) ||
        payload.skills.some((skill) => typeof skill !== "string") ||
        !isValidPublicContact(payload.contact) ||
        !isValidStructuredSections(payload.structuredSections) ||
        (payload.privateReviewNotes !== undefined &&
          typeof payload.privateReviewNotes !== "string") ||
        !["abhishek", "ammu", "bava", "sai", "unassigned"].includes(String(payload.profileId))
      ) {
        return jsonResponse(
          { error: "Provide valid reviewed details and select the correct profile." },
          400,
        );
      }
      if (!payload.profileId || payload.profileId === "unassigned") {
        return jsonResponse(
          { error: "Assign this resume to a public profile before publishing." },
          400,
        );
      }
      records[index] = {
        ...record,
        profileId: payload.profileId as ResumeRecord["profileId"],
        displayName: payload.displayName.slice(0, 120),
        headline: payload.headline.slice(0, 180),
        summary: payload.summary.slice(0, 3000),
        skills: payload.skills.slice(0, 60).map((skill) => skill.slice(0, 80)),
        contact:
          payload.contact &&
          Object.values(payload.contact).some((value) => typeof value === "string" && value.trim())
            ? payload.contact
            : undefined,
        structuredSections: {
          experience: (
            payload.structuredSections?.experience ??
            record.structuredSections?.experience ??
            []
          )
            .slice(0, 30)
            .map((entry) => sanitizeStructuredEntry(entry, 1200)),
          education: (
            payload.structuredSections?.education ??
            record.structuredSections?.education ??
            []
          )
            .slice(0, 20)
            .map((entry) => sanitizeStructuredEntry(entry, 1200)),
          projects: (
            payload.structuredSections?.projects ??
            record.structuredSections?.projects ??
            []
          )
            .slice(0, 30)
            .map((entry) => sanitizeStructuredEntry(entry, 1200)),
          certifications: (
            payload.structuredSections?.certifications ??
            record.structuredSections?.certifications ??
            []
          )
            .slice(0, 40)
            .map((entry) => sanitizeStructuredEntry(entry, 500)),
        },
        privateReviewNotes: (payload.privateReviewNotes ?? record.privateReviewNotes ?? "").slice(
          0,
          12000,
        ),
        status: "approved",
      };
      const published = records[index]!;
      const profileId = published.profileId as ProfileId;
      // One published resume per profile: an earlier publication is superseded
      // (kept privately and in history) rather than silently left alongside.
      const supersededIds: string[] = [];
      for (let i = 0; i < records.length; i++) {
        const item = records[i]!;
        if (i !== index && item.profileId === profileId && item.status === "approved") {
          records[i] = { ...item, status: "pending" };
          supersededIds.push(item.id);
        }
      }
      let historyBefore: PublishHistory;
      try {
        historyBefore = await readPublishHistory(bucket, profileId);
      } catch (error) {
        return storageFailure(error, "publish");
      }
      const historyAfter = appendHistory(
        historyBefore,
        snapshotOf(published, new Date().toISOString()),
      );
      try {
        await commitResumeState(bucket, original, records, {
          before: historyBefore,
          after: historyAfter,
        });
      } catch (error) {
        return storageFailure(error, "publish");
      }
      return jsonResponse({ resume: published, supersededIds }, 200);
    }

    if (request.method === "DELETE" && !action) {
      const deleted = records[index]!;
      records.splice(index, 1);
      // Retention (PORT-US-036): the deleted resume's extracted draft lives only in its
      // index record (removed here) and the public feed/AI context are rebuilt from the
      // index; its history entries keep timestamps only, never its content.
      let historyChange: { before: PublishHistory; after: PublishHistory } | undefined;
      if (isPublicProfileId(deleted.profileId)) {
        try {
          const historyBefore = await readPublishHistory(bucket, deleted.profileId);
          historyChange = {
            before: historyBefore,
            after: redactDeletedResume(historyBefore, deleted.id),
          };
        } catch (error) {
          return storageFailure(error, "delete");
        }
      }
      try {
        await commitResumeState(bucket, original, records, historyChange);
      } catch (error) {
        return storageFailure(error, "delete");
      }
      // The private file is removed only after nothing references it.
      await bucket.delete(fileKey);
      return jsonResponse({ ok: true }, 200);
    }
  }

  return privateNotFound();
}

type PortfolioImageRecord = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  status: "pending" | "approved";
  profileId: "abhishek" | "ammu" | "bava" | "sai";
  alt: string;
  slot?: "gallery" | "portrait";
};
const IMAGE_INDEX_KEY = "private-admin/images/index.json";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/avif", ".avif"],
]);

function isPortfolioImageRecord(value: unknown): value is PortfolioImageRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<PortfolioImageRecord>;
  return (
    typeof record.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.id) &&
    typeof record.filename === "string" &&
    record.filename.length > 0 &&
    record.filename.length <= 120 &&
    IMAGE_TYPES.has(String(record.contentType)) &&
    Number.isSafeInteger(record.size) &&
    Number(record.size) > 0 &&
    Number(record.size) <= MAX_IMAGE_BYTES &&
    typeof record.uploadedAt === "string" &&
    Number.isFinite(Date.parse(record.uploadedAt)) &&
    (record.status === "pending" || record.status === "approved") &&
    ["abhishek", "ammu", "bava", "sai"].includes(String(record.profileId)) &&
    typeof record.alt === "string" &&
    record.alt.trim().length > 0 &&
    record.alt.length <= 300 &&
    (record.slot === undefined || record.slot === "gallery" || record.slot === "portrait")
  );
}

/** Size, type/extension and magic-byte checks shared by image upload and replace. */
async function checkImageFile(file: File): Promise<Response | { extension: string }> {
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES)
    return jsonResponse({ error: "Image must be between 1 byte and 10 MB." }, 413);
  const expectedExtension = IMAGE_TYPES.get(file.type);
  if (
    !expectedExtension ||
    !(file.type === "image/jpeg"
      ? /\.jpe?g$/i.test(file.name)
      : file.name.toLowerCase().endsWith(expectedExtension))
  )
    return jsonResponse(
      { error: "Only JPEG, PNG, WebP and AVIF images with matching extensions are allowed." },
      415,
    );
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const validSignature =
    file.type === "image/jpeg"
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : file.type === "image/png"
        ? bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
        : file.type === "image/webp"
          ? String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
            String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
          : file.type === "image/avif"
            ? String.fromCharCode(...bytes.slice(4, 12)).includes("ftypavif") ||
              String.fromCharCode(...bytes.slice(4, 12)).includes("ftypavis")
            : false;
  if (!validSignature)
    return jsonResponse(
      { error: "The file signature does not match its declared image type." },
      415,
    );
  return { extension: expectedExtension };
}

async function readImageIndex(bucket: PrivateBucket): Promise<PortfolioImageRecord[]> {
  const object = await bucket.get(IMAGE_INDEX_KEY);
  if (!object) return [];
  const records = await object.json<unknown>();
  if (!Array.isArray(records) || !records.every(isPortfolioImageRecord)) {
    throw new Error("Stored image index failed integrity validation.");
  }
  const ids = new Set(records.map((record) => record.id));
  if (ids.size !== records.length) {
    throw new Error("Stored image index contains duplicate record IDs.");
  }
  return records;
}
/** List keys under a prefix on R2 (paged `list`) or the local disk bucket (`list(prefix)`). */
async function listBucketKeys(bucket: PrivateBucket, prefix: string): Promise<string[]> {
  const lister = (bucket as unknown as { list?: (arg: unknown) => Promise<unknown> }).list;
  if (typeof lister !== "function") {
    throw new Error("This storage binding cannot list files, so cleanup is unavailable.");
  }
  // The local disk bucket takes a prefix string and returns keys; R2 takes options.
  if ("root" in (bucket as object)) {
    const result = (await lister.call(bucket, prefix)) as unknown;
    return Array.isArray(result)
      ? result.filter((key): key is string => typeof key === "string")
      : [];
  }
  const keys: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const result = (await lister.call(bucket, {
      prefix,
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    })) as unknown;
    const listing = result as { objects?: { key: string }[]; truncated?: boolean; cursor?: string };
    keys.push(...(listing.objects ?? []).map((object) => object.key));
    if (!listing.truncated || !listing.cursor) break;
    cursor = listing.cursor;
  }
  return keys;
}

async function writeImageIndex(
  bucket: PrivateBucket,
  records: PortfolioImageRecord[],
): Promise<void> {
  await bucket.put(IMAGE_INDEX_KEY, JSON.stringify(records), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

type BucketMutation =
  | { key: string; operation: "put"; value: ArrayBuffer | string | Uint8Array; contentType?: string }
  | { key: string; operation: "delete" };

/**
 * Apply a small multi-object image lifecycle change with compensating rollback.
 * Snapshot every key before the first write and include an ambiguous failing
 * operation in compensation because providers can persist then reject.
 */
async function commitImageState(
  bucket: PrivateBucket,
  mutations: BucketMutation[],
): Promise<void> {
  const snapshots: Array<{
    key: string;
    bytes: Uint8Array | null;
    contentType?: string;
  }> = [];

  // Read all prior values before mutating anything. A failed snapshot therefore
  // leaves the bucket untouched.
  for (const mutation of mutations) {
    const existing = await bucket.get(mutation.key);
    snapshots.push({
      key: mutation.key,
      bytes: existing ? new Uint8Array(await existing.arrayBuffer()) : null,
      ...(existing?.httpMetadata?.contentType
        ? { contentType: existing.httpMetadata.contentType }
        : {}),
    });
  }

  let attempted = 0;
  try {
    for (const mutation of mutations) {
      attempted += 1;
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
  } catch (error) {
    let restored = true;
    for (const snapshot of snapshots.slice(0, attempted).reverse()) {
      try {
        if (snapshot.bytes) {
          await bucket.put(snapshot.key, snapshot.bytes, {
            ...(snapshot.contentType
              ? { httpMetadata: { contentType: snapshot.contentType } }
              : {}),
          });
        } else {
          await bucket.delete(snapshot.key);
        }
      } catch (rollbackError) {
        restored = false;
        console.error("Could not compensate a partial image storage update.", rollbackError);
      }
    }
    throw new StorageCommitError(restored, error);
  }
}

function isUploadedResumeFile(value: FormDataEntryValue | null): value is File {
  // Multipart File instances may come from a different runtime realm than the
  // global File constructor used by the SSR server. Validate the File surface
  // instead of relying on instanceof, which can reject otherwise valid uploads.
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<File>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.arrayBuffer === "function" &&
    typeof candidate.slice === "function"
  );
}

function isUploadedImageFile(value: FormDataEntryValue | null): value is File {
  // Avoid relying on a runtime-global File constructor: some Vite/SSR runtimes
  // expose multipart uploads as File objects without installing globalThis.File.
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<File>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.arrayBuffer === "function" &&
    typeof candidate.slice === "function"
  );
}

async function handlePortfolioImageApi(request: Request, env: unknown): Promise<Response | null> {
  const path = normalizedPath(request);
  if (
    !path.startsWith("/api/admin/images") &&
    path !== "/api/published-images" &&
    !path.startsWith("/api/published-images/")
  )
    return null;
  const bucket = resolvePrivateBucket(env);
  if (!bucket) {
    if (path === "/api/published-images" && request.method === "GET")
      return jsonResponse({ images: [] }, 200);
    return bucketNotConfigured();
  }
  if (path === "/api/published-images" && request.method === "GET") {
    const images = (await readImageIndex(bucket))
      .filter((item) => item.status === "approved")
      .map(({ id, profileId, alt, filename, contentType, slot }) => ({
        id,
        profileId,
        alt,
        filename,
        contentType,
        slot: slot ?? "gallery",
        src: `/api/published-images/${id}`,
      }));
    return jsonResponse({ images }, 200, { "cache-control": PUBLIC_FEED_CACHE });
  }
  const publicImage = path.match(/^\/api\/published-images\/([a-f0-9-]+)$/);
  if (publicImage && request.method === "GET") {
    const record = (await readImageIndex(bucket)).find(
      (item) => item.id === publicImage[1] && item.status === "approved",
    );
    if (!record) return privateNotFound();
    const object = await bucket.get(`public/profile-images/${record.id}`);
    if (!object) return privateNotFound();
    return new Response(await object.arrayBuffer(), {
      headers: {
        "content-type": record.contentType,
        "cache-control": PUBLIC_IMAGE_CACHE,
        "x-content-type-options": "nosniff",
      },
    });
  }
  if (!(await isAdminAuthorized(request, env))) return privateNotFound();
  if (["POST", "DELETE"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return privateNotFound();
  }
  if (path === "/api/admin/images" && request.method === "GET")
    return jsonResponse(
      {
        images: await readImageIndex(bucket),
        storageMode: isLocalDevelopmentBucket(bucket) ? "local-disk" : "persistent",
      },
      200,
    );
  if (path === "/api/admin/images" && request.method === "POST") {
    const boundedRequest = await limitRequestBody(request, MAX_IMAGE_BYTES + 1024 * 1024);
    if (boundedRequest instanceof Response) return boundedRequest;
    request = boundedRequest;
    const form = await request.formData().catch(() => null);
    const file = form?.get("file") ?? null;
    const profileId = form?.get("profileId");
    const alt = form?.get("alt");
    const requestedSlot = form?.get("slot");
    const slot =
      requestedSlot === "portrait" ? "portrait" : requestedSlot === "gallery" ? "gallery" : null;
    const publishOnUpload = form?.get("publishOnUpload") === "true";
    if (
      !isUploadedImageFile(file) ||
      typeof profileId !== "string" ||
      !["abhishek", "ammu", "bava", "sai"].includes(profileId) ||
      typeof alt !== "string" ||
      !alt.trim() ||
      !slot
    )
      return jsonResponse(
        { error: "Choose an image, profile, image placement and descriptive alt text." },
        400,
      );
    const checked = await checkImageFile(file);
    if (checked instanceof Response) return checked;
    const expectedExtension = checked.extension;
    const id = crypto.randomUUID();
    const filename =
      file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120) || `image${expectedExtension}`;
    const privateKey = `private-admin/images/files/${id}`;
    const publicKey = `public/profile-images/${id}`;
    try {
      const records = await readImageIndex(bucket);
      const record: PortfolioImageRecord = {
        id,
        filename,
        contentType: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        status: publishOnUpload ? "approved" : "pending",
        profileId: profileId as PortfolioImageRecord["profileId"],
        alt: alt.trim().slice(0, 300),
        slot,
      };
      const bytes = await file.arrayBuffer();
      records.push(record);
      await commitImageState(bucket, [
        { key: privateKey, operation: "put", value: bytes, contentType: file.type },
        ...(publishOnUpload
          ? [{ key: publicKey, operation: "put" as const, value: bytes, contentType: file.type }]
          : []),
        {
          key: IMAGE_INDEX_KEY,
          operation: "put",
          value: JSON.stringify(records),
          contentType: "application/json; charset=utf-8",
        },
      ]);
      return jsonResponse({ image: record }, 201);
    } catch (error) {
      // Keep the API failure actionable during local development instead of
      // allowing the framework to replace it with an opaque HTTPError response.
      const restored = !(error instanceof StorageCommitError) || error.restored;
      console.error("Portfolio image upload failed while storing or indexing the image.", error);
      return jsonResponse(
        {
          error: restored
            ? "Image upload failed; no changes were retained. Check the development server terminal and retry."
            : "Image upload failed part-way and compensation was incomplete. Review image storage consistency before retrying.",
          code: "IMAGE_UPLOAD_STORAGE_FAILED",
          restored,
          ...(import.meta.env.DEV === true
            ? { detail: error instanceof Error ? error.message : "Unknown image storage error." }
            : {}),
        },
        500,
      );
    }
  }
  // Remove private files no longer referenced by the index, superseded versions,
  // and public copies of images that are not currently published.
  if (path === "/api/admin/images/cleanup" && request.method === "POST") {
    const records = await readImageIndex(bucket);
    const ids = new Set(records.map((item) => item.id));
    const approved = new Set(
      records.filter((item) => item.status === "approved").map((item) => item.id),
    );
    let removed = 0;
    try {
      for (const key of await listBucketKeys(bucket, "private-admin/images/superseded/")) {
        await bucket.delete(key);
        removed += 1;
      }
      for (const key of await listBucketKeys(bucket, "private-admin/images/files/")) {
        if (!ids.has(key.slice("private-admin/images/files/".length))) {
          await bucket.delete(key);
          removed += 1;
        }
      }
      for (const key of await listBucketKeys(bucket, "public/profile-images/")) {
        if (!approved.has(key.slice("public/profile-images/".length))) {
          await bucket.delete(key);
          removed += 1;
        }
      }
    } catch (error) {
      return imageStorageFailure(error, "clean up");
    }
    return jsonResponse({ removed }, 200);
  }

  // Owner-only preview of the private original (works for unpublished images too).
  const previewMatch = path.match(/^\/api\/admin\/images\/([a-f0-9-]+)\/file$/);
  if (previewMatch && request.method === "GET") {
    const id = previewMatch[1]!;
    const record = (await readImageIndex(bucket)).find((item) => item.id === id);
    if (!record) return privateNotFound();
    const object = await bucket.get(`private-admin/images/files/${id}`);
    if (!object) return privateNotFound();
    return new Response(await object.arrayBuffer(), {
      headers: {
        "content-type": record.contentType,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "x-robots-tag": "noindex",
      },
    });
  }

  // Replace an image's file in place (same id, placement and alt text). The previous
  // file is kept privately as a superseded version until cleanup; on failure the
  // previous private and public files are restored.
  const replaceMatch = path.match(/^\/api\/admin\/images\/([a-f0-9-]+)\/replace$/);
  if (replaceMatch && request.method === "POST") {
    const id = replaceMatch[1]!;
    const boundedRequest = await limitRequestBody(request, MAX_IMAGE_BYTES + 1024 * 1024);
    if (boundedRequest instanceof Response) return boundedRequest;
    const form = await boundedRequest.formData().catch(() => null);
    const file = form?.get("file") ?? null;
    if (!isUploadedImageFile(file))
      return jsonResponse({ error: "Choose a replacement image." }, 400);
    const checked = await checkImageFile(file);
    if (checked instanceof Response) return checked;
    const records = await readImageIndex(bucket);
    const index = records.findIndex((item) => item.id === id);
    const record = index < 0 ? undefined : records[index];
    if (!record) return privateNotFound();
    const privateKey = `private-admin/images/files/${id}`;
    const publicKey = `public/profile-images/${id}`;
    const previous = await bucket.get(privateKey);
    if (!previous) return privateNotFound();
    const previousBytes = await previous.arrayBuffer();
    const supersededKey = `private-admin/images/superseded/${id}/${Date.now()}`;
    const bytes = await file.arrayBuffer();
    const filename =
      file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120) || `image${checked.extension}`;
    records[index] = {
      ...record,
      filename,
      contentType: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };
    try {
      await commitImageState(bucket, [
        {
          key: supersededKey,
          operation: "put",
          value: previousBytes,
          contentType: record.contentType,
        },
        { key: privateKey, operation: "put", value: bytes, contentType: file.type },
        ...(record.status === "approved"
          ? [{ key: publicKey, operation: "put" as const, value: bytes, contentType: file.type }]
          : []),
        {
          key: IMAGE_INDEX_KEY,
          operation: "put",
          value: JSON.stringify(records),
          contentType: "application/json; charset=utf-8",
        },
      ]);
    } catch (error) {
      return imageStorageFailure(error, "replace");
    }
    return jsonResponse({ image: records[index], replaced: true }, 200);
  }

  const match = path.match(/^\/api\/admin\/images\/([a-f0-9-]+)(?:\/(publish|unpublish))?$/);
  if (match) {
    const [, id, action] = match;
    const records = await readImageIndex(bucket);
    const index = records.findIndex((item) => item.id === id);
    const record = index < 0 ? undefined : records[index];
    if (!record) return privateNotFound();
    if (action === "publish" && request.method === "POST") {
      const object = await bucket.get(`private-admin/images/files/${id}`);
      if (!object) return privateNotFound();
      const bytes = await object.arrayBuffer();
      records[index] = { ...record, status: "approved" };
      try {
        await commitImageState(bucket, [
          {
            key: `public/profile-images/${id}`,
            operation: "put",
            value: bytes,
            contentType: record.contentType,
          },
          {
            key: IMAGE_INDEX_KEY,
            operation: "put",
            value: JSON.stringify(records),
            contentType: "application/json; charset=utf-8",
          },
        ]);
      } catch (error) {
        return imageStorageFailure(error, "publish");
      }
      return jsonResponse({ image: records[index] }, 200);
    }
    if (action === "unpublish" && request.method === "POST") {
      if (record.status !== "approved")
        return jsonResponse({ error: "This image is not currently published." }, 409);
      records[index] = { ...record, status: "pending" };
      try {
        await commitImageState(bucket, [
          { key: `public/profile-images/${id}`, operation: "delete" },
          {
            key: IMAGE_INDEX_KEY,
            operation: "put",
            value: JSON.stringify(records),
            contentType: "application/json; charset=utf-8",
          },
        ]);
      } catch (error) {
        return imageStorageFailure(error, "unpublish");
      }
      return jsonResponse({ image: records[index] }, 200);
    }
    if (!action && request.method === "DELETE") {
      // Remove public/private bytes and update the index as one compensating
      // operation. If any provider call fails ambiguously, restore every prior key.
      records.splice(index, 1);
      try {
        await commitImageState(bucket, [
          { key: `public/profile-images/${id}`, operation: "delete" },
          {
            key: IMAGE_INDEX_KEY,
            operation: "put",
            value: JSON.stringify(records),
            contentType: "application/json; charset=utf-8",
          },
          { key: `private-admin/images/files/${id}`, operation: "delete" },
        ]);
      } catch (error) {
        return imageStorageFailure(error, "delete");
      }
      return jsonResponse({ ok: true }, 200);
    }
  }
  return privateNotFound();
}
// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

async function attachPublishedResumeContext(
  request: Request,
  env: unknown,
): Promise<Request | Response> {
  const boundedRequest = await limitRequestBody(request, 70 * 1024);
  if (boundedRequest instanceof Response) return boundedRequest;

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = await boundedRequest.clone().json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return jsonResponse({ error: "Invalid request." }, 400);
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Invalid request." }, 400);
  }

  const profileId = typeof payload["person"] === "string" ? payload["person"] : "abhishek";
  if (!["abhishek", "ammu", "bava", "sai"].includes(profileId)) return boundedRequest;

  // Always overwrite the internal field: a browser cannot choose the resume
  // facts used by the model, even if it submits a forged _publishedResume.
  let publishedResume: Record<string, unknown> | null = null;
  const bucket = resolvePrivateBucket(env);
  if (bucket) {
    try {
      const object = await bucket.get("public/approved-resumes.json");
      if (object) {
        const feed = await object.json<{ resumes?: unknown[] }>();
        const candidates = Array.isArray(feed.resumes)
          ? feed.resumes.filter(
              (item): item is Record<string, unknown> =>
                !!item &&
                typeof item === "object" &&
                !Array.isArray(item) &&
                (item as Record<string, unknown>)["profileId"] === profileId,
            )
          : [];
        const timestamp = (record: Record<string, unknown>): number => {
          const uploadedAt = record["uploadedAt"];
          if (typeof uploadedAt !== "string") return 0;
          const parsed = Date.parse(uploadedAt);
          return Number.isFinite(parsed) ? parsed : 0;
        };
        candidates.sort((a, b) => timestamp(b) - timestamp(a));
        const latest = candidates[0];
        if (latest) {
          const candidate = JSON.stringify(latest);
          if (new TextEncoder().encode(candidate).byteLength <= 20 * 1024) publishedResume = latest;
        }
      }
    } catch (error) {
      // A missing or unreadable publication must not expose private drafts or
      // block the static portfolio assistant.
      console.error("Could not load the approved resume context for portfolio chat.", error);
    }
  }

  // Only the selected profile's *published* persona is attached (PORT-US-038).
  const persona = await loadPublishedPersona(env, profileId);

  // Discard any client-supplied internal fields before adding trusted data.
  const clientPayload = { ...payload };
  delete clientPayload["_publishedResume"];
  delete clientPayload["_persona"];
  let body = JSON.stringify({
    ...clientPayload,
    _publishedResume: publishedResume,
    _persona: persona,
  });
  const encoder = new TextEncoder();
  if (encoder.encode(body).byteLength > 70 * 1024) {
    // Preserve a valid user request when its body leaves no room for resume
    // context; the chat route will then use its static verified profile data.
    body = JSON.stringify({ ...clientPayload, _publishedResume: null, _persona: persona });
  }
  if (encoder.encode(body).byteLength > 70 * 1024) {
    return jsonResponse({ error: "Request body exceeds the allowed size." }, 413);
  }

  const headers = new Headers(boundedRequest.headers);
  headers.delete("content-length");
  return new Request(boundedRequest.url, {
    method: boundedRequest.method,
    headers,
    body,
    redirect: boundedRequest.redirect,
  });
}

// ---------------------------------------------------------------------------
// Owner-configured AI personas (PORT-US-038). Private storage, owner-only.
// ---------------------------------------------------------------------------

async function readPersonaDocument(
  bucket: PrivateBucket,
  profileId: PersonaProfileId,
): Promise<PersonaDocument> {
  const object = await bucket.get(personaKey(profileId));
  if (!object) return emptyPersonaDocument(profileId);
  const value = await object.json<unknown>();
  if (!isPersonaDocument(value, profileId)) {
    throw new Error("Stored persona failed integrity validation.");
  }
  return value;
}

async function writePersonaDocument(bucket: PrivateBucket, doc: PersonaDocument): Promise<void> {
  await bucket.put(personaKey(doc.profileId), JSON.stringify(doc), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

/** Published persona for one profile, or null. Never throws (chat must not break). */
async function loadPublishedPersona(
  env: unknown,
  profileId: string,
): Promise<(PersonaConfig & { profileId: PersonaProfileId }) | null> {
  if (!isPersonaProfileId(profileId)) return null;
  const bucket = resolvePrivateBucket(env);
  if (!bucket) return null;
  try {
    const config = publishedPersona(await readPersonaDocument(bucket, profileId));
    return config ? { ...config, profileId } : null;
  } catch (error) {
    console.error("Could not load the published persona for portfolio chat.", error);
    return null;
  }
}

async function handlePersonaApi(request: Request, env: unknown): Promise<Response | null> {
  const path = normalizedPath(request);
  if (path !== "/api/admin/personas" && !path.startsWith("/api/admin/personas/")) return null;
  if (!(await isAdminAuthorized(request, env))) return privateNotFound();
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return privateNotFound();
  }
  const bucket = resolvePrivateBucket(env);
  if (!bucket) return bucketNotConfigured();

  if (path === "/api/admin/personas" && request.method === "GET") {
    const profileId = new URL(request.url).searchParams.get("profileId");
    if (!isPersonaProfileId(profileId)) return jsonResponse({ error: "Choose a profile." }, 400);
    try {
      return jsonResponse({ persona: await readPersonaDocument(bucket, profileId) }, 200);
    } catch (error) {
      return storageFailure(error, "read persona");
    }
  }

  const action = path.match(/^\/api\/admin\/personas\/(draft|publish|rollback|unpublish)$/)?.[1];
  if (!action || request.method !== "POST") return privateNotFound();
  const bounded = await limitRequestBody(request, 16 * 1024);
  if (bounded instanceof Response) return bounded;
  const payload = (await bounded.json().catch(() => null)) as {
    profileId?: unknown;
    config?: unknown;
    version?: unknown;
  } | null;
  const profileId = payload?.profileId;
  if (!isPersonaProfileId(profileId)) return jsonResponse({ error: "Choose a profile." }, 400);

  let doc: PersonaDocument;
  try {
    doc = await readPersonaDocument(bucket, profileId);
  } catch (error) {
    return storageFailure(error, "read persona");
  }
  const now = new Date().toISOString();
  let next: PersonaDocument;
  try {
    if (action === "draft") {
      const validated = validatePersonaConfig(payload?.config);
      if (!validated.ok) return jsonResponse({ error: validated.errors.join(" ") }, 400);
      next = saveDraft(doc, validated.config, now);
    } else if (action === "publish") {
      next = publishDraft(doc, now);
    } else if (action === "rollback") {
      if (typeof payload?.version !== "number") {
        return jsonResponse({ error: "Choose a version to restore." }, 400);
      }
      next = rollbackTo(doc, payload.version, now);
    } else {
      next = unpublish(doc);
    }
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Invalid request." },
      409,
    );
  }
  try {
    await writePersonaDocument(bucket, next);
  } catch (error) {
    return storageFailure(error, `persona ${action}`);
  }
  // Operational log without persona text.
  console.info("Portfolio persona updated.", {
    profileId,
    action,
    publishedVersion: next.publishedVersion,
  });
  return jsonResponse({ persona: next }, 200);
}

// ---------------------------------------------------------------------------
// Owner-managed CMS content (PORT-US-035). Private storage; public read of the
// published version only. Logs carry ids and versions, never content text.
// ---------------------------------------------------------------------------

async function readContentDocument(
  bucket: PrivateBucket,
  profileId: ContentProfileId,
): Promise<ContentDocument> {
  const object = await bucket.get(contentKey(profileId));
  if (!object) return emptyContentDocument(profileId);
  const value = await object.json<unknown>();
  if (!isContentDocument(value, profileId)) {
    throw new Error("Stored content failed integrity validation.");
  }
  return value;
}

async function handleContentApi(request: Request, env: unknown): Promise<Response | null> {
  const path = normalizedPath(request);
  if (path === "/api/published-content" && request.method === "GET") {
    const profileId = new URL(request.url).searchParams.get("profileId");
    if (!isContentProfileId(profileId)) return jsonResponse({ error: "Unknown profile." }, 400);
    const bucket = resolvePrivateBucket(env);
    if (!bucket) return jsonResponse({ profileId, content: null }, 200);
    try {
      const content = publishedContent(await readContentDocument(bucket, profileId));
      return jsonResponse({ profileId, content }, 200, { "cache-control": PUBLIC_FEED_CACHE });
    } catch (error) {
      console.error("Could not read published portfolio content.", error);
      // Pages fall back to curated static content.
      return jsonResponse({ profileId, content: null }, 200);
    }
  }
  if (path !== "/api/admin/content" && !path.startsWith("/api/admin/content/")) return null;
  if (!(await isAdminAuthorized(request, env))) return privateNotFound();
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return privateNotFound();
  }
  const bucket = resolvePrivateBucket(env);
  if (!bucket) return bucketNotConfigured();

  if (path === "/api/admin/content" && request.method === "GET") {
    const profileId = new URL(request.url).searchParams.get("profileId");
    if (!isContentProfileId(profileId)) return jsonResponse({ error: "Choose a profile." }, 400);
    try {
      return jsonResponse({ document: await readContentDocument(bucket, profileId) }, 200);
    } catch (error) {
      return storageFailure(error, "read content");
    }
  }

  const action = path.match(/^\/api\/admin\/content\/(draft|publish|rollback|unpublish)$/)?.[1];
  if (!action || request.method !== "POST") return privateNotFound();
  const bounded = await limitRequestBody(request, 128 * 1024);
  if (bounded instanceof Response) return bounded;
  const payload = (await bounded.json().catch(() => null)) as {
    profileId?: unknown;
    content?: unknown;
    version?: unknown;
  } | null;
  const profileId = payload?.profileId;
  if (!isContentProfileId(profileId)) return jsonResponse({ error: "Choose a profile." }, 400);

  let doc: ContentDocument;
  try {
    doc = await readContentDocument(bucket, profileId);
  } catch (error) {
    return storageFailure(error, "read content");
  }
  const now = new Date().toISOString();
  let next: ContentDocument;
  try {
    if (action === "draft") {
      const validated = validateContentOverrides(payload?.content);
      if (!validated.ok) return jsonResponse({ error: validated.errors.join(" ") }, 400);
      next = saveContentDraft(doc, validated.content, now);
    } else if (action === "publish") {
      next = publishContentDraft(doc, now);
    } else if (action === "rollback") {
      if (typeof payload?.version !== "number") {
        return jsonResponse({ error: "Choose a version to restore." }, 400);
      }
      next = rollbackContent(doc, payload.version, now);
    } else {
      next = unpublishContent(doc);
    }
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Invalid request." },
      409,
    );
  }
  try {
    await bucket.put(contentKey(profileId), JSON.stringify(next), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
  } catch (error) {
    return storageFailure(error, `content ${action}`);
  }
  // Audit trail without content text.
  console.info("Portfolio content updated.", {
    profileId,
    action,
    publishedVersion: next.publishedVersion,
    historyEntries: next.history.length,
  });
  return jsonResponse({ document: next }, 200);
}

// ---------------------------------------------------------------------------
// Owner backup / restore of admin metadata (PORT-US-041).
// ---------------------------------------------------------------------------

async function handleBackupApi(request: Request, env: unknown): Promise<Response | null> {
  const path = normalizedPath(request);
  if (
    path !== "/api/admin/backup" &&
    path !== "/api/admin/backup/restore" &&
    path !== "/api/admin/storage" &&
    path !== "/api/admin/storage/migrate"
  )
    return null;
  if (!(await isAdminAuthorized(request, env))) return privateNotFound();
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return privateNotFound();
  }
  const bucket = resolvePrivateBucket(env);
  if (!bucket) return bucketNotConfigured();

  if (path === "/api/admin/backup" && request.method === "GET") {
    try {
      const backup = await createBackup(bucket);
      console.info("Portfolio admin backup exported.", {
        documents: Object.keys(backup.entries).length,
      });
      return jsonResponse(backup, 200, {
        "content-disposition": `attachment; filename="portfolio-admin-backup-${backup.exportedAt.slice(0, 10)}.json"`,
      });
    } catch (error) {
      return storageFailure(error, "export backup");
    }
  }
  if (path === "/api/admin/storage" && request.method === "GET") {
    return handleStorageMigration(request, env);
  }
  if (path === "/api/admin/storage/migrate" && request.method === "POST") {
    return handleStorageMigration(request, env);
  }
  if (path !== "/api/admin/backup/restore" || request.method !== "POST") return privateNotFound();
  const bounded = await limitRequestBody(request, MAX_BACKUP_BYTES);
  if (bounded instanceof Response) return bounded;
  const payload = (await bounded.json().catch(() => null)) as {
    confirm?: unknown;
    backup?: unknown;
  } | null;
  if (payload?.confirm !== "RESTORE") {
    return jsonResponse({ error: "Type RESTORE to confirm replacing current admin data." }, 400);
  }
  // Everything (documents, file keys, sizes, SHA-256) is validated before the first write.
  const validated = await validateBackup(payload.backup);
  if (!validated.ok) return jsonResponse({ error: validated.errors.join(" ") }, 400);
  const result = await restoreBackup(bucket, validated);
  if (!result.ok) {
    console.error("Portfolio admin restore failed.", { rolledBack: result.rolledBack });
    return jsonResponse(
      {
        error: result.rolledBack
          ? "Restore failed and every change was rolled back. Nothing was modified."
          : "Restore failed and could not be fully rolled back. Export a fresh backup and retry.",
        rolledBack: result.rolledBack,
      },
      500,
    );
  }
  console.info("Portfolio admin backup restored.", {
    keys: result.restored.length,
    files: validated.files.length,
  });
  return jsonResponse(
    {
      restored: result.restored,
      files: validated.files.length,
      missingFiles: validated.missingFiles,
    },
    200,
  );
}

/**
 * Storage adapters available to this runtime: the R2 binding (deployed or via the
 * platform proxy) and, in `vite dev` only, the local disk bucket.
 */
function availableStorageAdapters(
  env: unknown,
): Partial<Record<"r2" | "local-disk", PrivateBucket>> {
  const adapters: Partial<Record<"r2" | "local-disk", PrivateBucket>> = {};
  const r2 = (env as AdminEnv | undefined)?.RESUME_BUCKET;
  if (r2) adapters.r2 = r2;
  if (import.meta.env.DEV === true) {
    localDevelopmentBucket ??= createLocalDiskBucket(
      process.env["PORTFOLIO_LOCAL_STORAGE_DIR"] || ".local-storage",
    );
    adapters["local-disk"] = localDevelopmentBucket;
  }
  return adapters;
}

async function handleStorageMigration(request: Request, env: unknown): Promise<Response> {
  const adapters = availableStorageAdapters(env);
  if (request.method === "GET") {
    return jsonResponse({ available: Object.keys(adapters) }, 200);
  }
  const bounded = await limitRequestBody(request, 1024);
  if (bounded instanceof Response) return bounded;
  const payload = (await bounded.json().catch(() => null)) as {
    from?: unknown;
    to?: unknown;
    confirm?: unknown;
  } | null;
  const from = payload?.from;
  const to = payload?.to;
  if (
    (from !== "r2" && from !== "local-disk") ||
    (to !== "r2" && to !== "local-disk") ||
    from === to
  ) {
    return jsonResponse({ error: "Choose two different storage adapters (r2, local-disk)." }, 400);
  }
  if (payload?.confirm !== "MIGRATE") {
    return jsonResponse({ error: "Type MIGRATE to confirm copying admin data." }, 400);
  }
  const source = adapters[from];
  const target = adapters[to];
  if (!source || !target) {
    return jsonResponse({ error: "Both storage adapters must be available in this runtime." }, 409);
  }
  const result = await migrateStorage(source, target);
  if (!result.ok) {
    return jsonResponse({ error: result.error, rolledBack: result.rolledBack ?? false }, 500);
  }
  console.info("Portfolio admin storage migrated.", {
    from,
    to,
    documents: result.documents,
    files: result.files,
  });
  return jsonResponse(result, 200);
}

/**
 * Person project pages render on the client from curated data plus CMS overrides,
 * so the HTML is always produced. Decide the HTTP status here: a slug that exists
 * in neither the curated data nor the published CMS projects (or is archived)
 * returns a real 404 for crawlers and direct loads.
 */
async function personProjectExists(path: string, env: unknown): Promise<boolean | null> {
  const match = /^\/people\/([a-z]+)\/projects\/([a-z0-9][a-z0-9-]{0,79})$/.exec(path);
  if (!match) return null;
  const [, person, slug] = match as unknown as [string, string, string];
  let archived = false;
  const bucket = resolvePrivateBucket(env);
  if (bucket && isContentProfileId(person)) {
    try {
      const content = publishedContent(await readContentDocument(bucket, person));
      const edit = content?.projects?.find((project) => project.slug === slug);
      if (edit) {
        if (edit.archived) archived = true;
        else return true;
      }
    } catch {
      // Unreadable CMS content: fall back to curated data only.
    }
  }
  if (archived) return false;
  return Boolean(getPersonProject(person, slug));
}

/**
 * Central admin audit hook: every admin API mutation (any non-GET request under
 * /api/admin/) is recorded once, after the handler responds, with ids/actions/
 * status only. Audit failures are logged but never change the API response.
 */
async function auditAdminMutation(request: Request, env: unknown, response: Response) {
  const path = normalizedPath(request);
  if (!path.startsWith("/api/admin/") || ["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return;
  }
  // Failed logins are rate-limited separately; only record successful sign-ins.
  if (path === "/api/admin/login" && response.status !== 200) return;
  const bucket = resolvePrivateBucket(env);
  if (!bucket) return;
  const { action, targets } = describeAdminAction(request.method, path);
  try {
    await appendAdminAudit(bucket, {
      actor: adminAuthBypassed(env) ? "local-dev" : "owner",
      action,
      targets,
      status: response.status,
      outcome: response.status < 400 ? "success" : response.status < 500 ? "rejected" : "failed",
    });
  } catch (error) {
    console.error("Admin audit entry could not be written.", {
      action,
      reason: error instanceof Error ? error.message : "unknown",
    });
  }
}

let runtimeConfigChecked = false;

/**
 * One-time startup check of deployment configuration. Logs only the NAMES of
 * missing settings, never their values, and never blocks requests.
 */
function checkRuntimeConfig(env: unknown): void {
  if (runtimeConfigChecked) return;
  runtimeConfigChecked = true;
  const bindings = (env ?? {}) as Record<string, unknown>;
  const has = (name: string) => {
    const value =
      bindings[name] ?? (typeof process !== "undefined" ? process.env[name] : undefined);
    return typeof value === "string"
      ? value.trim().length > 0
      : value !== undefined && value !== null;
  };
  const missing: string[] = [];
  if (!has("JARVIS_AI_URL") || !has("JARVIS_AI_KEY"))
    missing.push("JARVIS_AI_URL/JARVIS_AI_KEY (live AI chat)");
  if (!import.meta.env["VITE_SITE_URL"]) missing.push("VITE_SITE_URL (canonical URLs, sitemap)");
  if (import.meta.env.PROD) {
    if (!has("RESUME_BUCKET")) missing.push("RESUME_BUCKET R2 binding (admin storage)");
    if (!has("PORTFOLIO_ADMIN_PASSWORD") || !has("PORTFOLIO_ADMIN_SESSION_SECRET")) {
      missing.push("PORTFOLIO_ADMIN_PASSWORD/PORTFOLIO_ADMIN_SESSION_SECRET (admin login)");
    }
  }
  if (has("OPENAI_API_KEY") && !has("PORTFOLIO_AI_ALLOW_PAID_FALLBACK")) {
    console.info("OPENAI_API_KEY is set but unused: paid fallback is not enabled.");
  }
  if (missing.length) {
    console.warn("Portfolio configuration incomplete; affected features fall back safely.", {
      missing,
    });
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    checkRuntimeConfig(env);
    const method = request.method;
    const auditRequest = new Request(request.url, { method });
    const response = await routeRequest(request, env, ctx);
    // Unauthenticated probes return a private 404 and are not worth an audit entry.
    if (response.status !== 404) await auditAdminMutation(auditRequest, env, response);
    return response;
  },
};

async function routeRequest(request: Request, env: unknown, ctx: unknown): Promise<Response> {
  {
    const path = normalizedPath(request);
    const isAdmin = isAdminPath(path);
    const authResponse = await handleAdminAuth(request, env);
    if (authResponse) return authResponse;
    const resumeResponse = await handleResumeApi(request, env);
    if (resumeResponse) return resumeResponse;
    const personaResponse = await handlePersonaApi(request, env);
    if (personaResponse) return personaResponse;
    const contentResponse = await handleContentApi(request, env);
    if (contentResponse) return contentResponse;
    const backupResponse = await handleBackupApi(request, env);
    if (backupResponse) return backupResponse;
    try {
      const imageResponse = await handlePortfolioImageApi(request, env);
      if (imageResponse) return imageResponse;
    } catch (error) {
      // Keep image API failures inside the API boundary so the admin UI receives
      // a JSON response instead of an opaque framework-generated HTTP 500.
      console.error("Portfolio image API request failed.", error);
      const message = error instanceof Error ? error.message : "Unknown image storage error.";
      return jsonResponse(
        {
          error: "The image operation failed on the server.",
          ...(import.meta.env.DEV === true ? { detail: message } : {}),
        },
        500,
      );
    }

    // Admin routes remain protected by default. For local testing only, set
    // PORTFOLIO_ADMIN_AUTH_BYPASS=true with NODE_ENV other than production.
    if (isAdmin && path !== "/admin/login" && !(await isAdminAuthorized(request, env))) {
      return privateNotFound();
    }
    if (isAdmin && path === "/admin/login" && request.method !== "GET") {
      return privateNotFound();
    }

    if (path === "/api/chat" && request.method === "POST") {
      const contextualRequest = await attachPublishedResumeContext(request, env);
      if (contextualRequest instanceof Response) return contextualRequest;
      request = contextualRequest;
    }

    try {
      const handler = await getServerEntry();
      const response = await normalizeCatastrophicSsrResponse(
        await handler.fetch(request, env, ctx),
      );
      if (request.method === "GET" && response.status === 200) {
        const exists = await personProjectExists(path, env);
        if (exists === false) {
          return new Response(response.body, {
            status: 404,
            statusText: "Not Found",
            headers: response.headers,
          });
        }
      }
      return isAdmin ? withNoindex(response) : response;
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  }
}
