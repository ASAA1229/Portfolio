import "./lib/error-capture";

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
  return pathname === "/admin" || pathname.startsWith("/admin/") ||
    pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_TRACKED_LOGIN_CLIENTS = 4096;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

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

function jsonResponse(body: unknown, status: number, headers?: HeadersInit): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...Object.fromEntries(new Headers(headers)) },
  });
}

async function limitRequestBody(request: Request, maxBytes: number): Promise<Request | Response> {
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
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  return new Request(request.url, {
    method: request.method,
    headers,
    body,
    redirect: request.redirect,
  });
}

function adminAuthBypassed(env: unknown): boolean {
  // Local Vite development is detected using Vite's compile-time DEV/MODE
  // flags below. Worker/preview requests use explicit runtime bindings.
  const bindings = env as {
    PORTFOLIO_ADMIN_AUTH_BYPASS?: unknown;
    ENVIRONMENT?: unknown;
  } | undefined;

  const runtimeBypass = bindings?.PORTFOLIO_ADMIN_AUTH_BYPASS === "true" &&
    bindings?.ENVIRONMENT === "development";

  // Vite replaces import.meta.env.DEV/MODE at bundle time. This is more
  // reliable than process.env in the Cloudflare/TanStack server runtime.
  // The DEV flag is false in production builds and deployed Workers.
  const localDevBypass = import.meta.env.DEV === true &&
    import.meta.env.MODE === "development";

  return runtimeBypass || localDevBypass;
}

async function isAdminAuthorized(request: Request, env: unknown): Promise<boolean> {
  return adminAuthBypassed(env) || await isAdminRequest(request, env);
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

    const payload = await request.json().catch(() => null) as { password?: unknown } | null;
    const password = typeof payload?.password === "string" ? payload.password : "";
    const valid = password.length > 0 && password.length <= 1024 && await verifyAdminPassword(password, env);
    if (!valid) {
      if (!current && loginAttempts.size >= MAX_TRACKED_LOGIN_CLIENTS) {
        return jsonResponse({ error: "Too many login attempts. Try again shortly." }, 429, {
          "retry-after": "60",
        });
      }
      loginAttempts.set(clientKey, current && current.resetAt > now
        ? { count: current.count + 1, resetAt: current.resetAt }
        : { count: 1, resetAt: now + LOGIN_WINDOW_MS });
      return jsonResponse({ error: "Invalid credentials." }, 401);
    }

    loginAttempts.delete(clientKey);
    const cookie = await createAdminCookie(env);
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

  if (path === "/api/admin/session" && request.method === "GET") {
    if (!(await isAdminAuthorized(request, env))) return privateNotFound();
    return jsonResponse({ authenticated: true }, 200);
  }

  return null;
}


type StructuredResumeEntry = { title?: string; organization?: string; role?: string; location?: string; startDate?: string; endDate?: string; description?: string; technologies?: string[]; url?: string; credentialId?: string; grade?: string };

type ResumeRecord = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  status: "pending" | "approved";
  profileId?: "abhishek" | "ammu" | "bava" | "sai" | "unassigned";
  displayName: string;
  headline: string;
  summary: string;
  skills: string[];
  contact?: { email?: string; phone?: string; linkedin?: string; github?: string };
  structuredSections?: { experience: (string | StructuredResumeEntry)[]; education: (string | StructuredResumeEntry)[]; projects: (string | StructuredResumeEntry)[]; certifications: (string | StructuredResumeEntry)[] };
  privateReviewNotes?: string;
};

type PrivateBucket = {
  get(key: string): Promise<{ json<T>(): Promise<T>; arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>;
  put(key: string, value: ArrayBuffer | string | Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
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

function resolvePrivateBucket(env: unknown): PrivateBucket | undefined {
  const configured = (env as AdminEnv | undefined)?.RESUME_BUCKET;
  if (configured) return configured;
  if (import.meta.env.DEV !== true) return undefined;
  if (!localDevelopmentBucket) {
    const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
    localDevelopmentBucket = {
      async get(key) {
        const stored = objects.get(key);
        if (!stored) return null;
        const bytes = stored.bytes.slice();
        return {
          httpMetadata: { contentType: stored.contentType },
          async json<T>() {
            return JSON.parse(new TextDecoder().decode(bytes)) as T;
          },
          async arrayBuffer() {
            return bytes.slice().buffer;
          },
        };
      },
      async put(key, value, options) {
        const bytes = typeof value === "string"
          ? new TextEncoder().encode(value)
          : value instanceof Uint8Array
            ? value.slice()
            : new Uint8Array(value.slice(0));
        objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType });
      },
      async delete(key) {
        objects.delete(key);
      },
    };
  }
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
  if (Object.keys(contact).some((key) => !["email", "phone", "linkedin", "github"].includes(key))) return false;
  for (const key of ["email", "phone", "linkedin", "github"] as const) {
    const item = contact[key];
    if (item !== undefined && (typeof item !== "string" || item.length > 320)) return false;
    if (typeof item === "string" && (item.includes("\n") || item.includes("\r"))) return false;
  }
  if (typeof contact.email === "string" && contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) return false;
  if (typeof contact.linkedin === "string" && contact.linkedin && !/^https:\/\//i.test(contact.linkedin)) return false;
  if (typeof contact.github === "string" && contact.github && !/^https:\/\//i.test(contact.github)) return false;
  return true;
}

function isValidStructuredEntry(value: unknown): boolean {
  if (typeof value === "string") return value.length <= 2000;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  const allowed = ["title", "organization", "role", "location", "startDate", "endDate", "description", "technologies", "url", "credentialId", "grade"];
  if (Object.keys(entry).some((key) => !allowed.includes(key))) return false;
  for (const key of ["title", "organization", "role", "location", "startDate", "endDate", "description", "url", "credentialId", "grade"]) {
    if (entry[key] !== undefined && (typeof entry[key] !== "string" || String(entry[key]).length > (key === "description" ? 2000 : 320))) return false;
  }
  if (entry.technologies !== undefined && (!Array.isArray(entry.technologies) || entry.technologies.length > 30 || entry.technologies.some((item) => typeof item !== "string" || item.length > 80))) return false;
  if (typeof entry.url === "string" && entry.url && !/^https:\/\//i.test(entry.url)) return false;
  return true;
}

function isValidStructuredSections(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const sections = value as Record<string, unknown>;
  const names = ["experience", "education", "projects", "certifications"];
  return Object.keys(sections).every((key) => names.includes(key)) &&
    names.every((name) => sections[name] === undefined ||
      (Array.isArray(sections[name]) && (sections[name] as unknown[]).length <= 40 &&
        (sections[name] as unknown[]).every(isValidStructuredEntry)));
}

function sanitizeStructuredEntry(value: string | StructuredResumeEntry, maxLength: number): string | StructuredResumeEntry {
  if (typeof value === "string") return value.trim().slice(0, maxLength);
  const result: StructuredResumeEntry = {};
  for (const key of ["title", "organization", "role", "location", "startDate", "endDate", "description", "url", "credentialId", "grade"] as const) {
    const item = value[key];
    if (typeof item === "string") result[key] = item.trim().slice(0, key === "description" ? 2000 : 320);
  }
  if (Array.isArray(value.technologies)) result.technologies = value.technologies.slice(0, 30).filter((item) => typeof item === "string").map((item) => item.trim().slice(0, 80));
  if (result.url && !/^https:\/\//i.test(result.url)) delete result.url;
  return result;
}

function isResumeRecord(value: unknown): value is ResumeRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<ResumeRecord>;
  const validProfiles = ["abhishek", "ammu", "bava", "sai", "unassigned"];
  const sections = record.structuredSections;
  return typeof record.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.id) &&
    typeof record.filename === "string" && record.filename.length > 0 && record.filename.length <= 120 &&
    ALLOWED_RESUME_TYPES.has(String(record.contentType)) &&
    Number.isSafeInteger(record.size) && Number(record.size) > 0 && Number(record.size) <= MAX_RESUME_BYTES &&
    typeof record.uploadedAt === "string" && Number.isFinite(Date.parse(record.uploadedAt)) &&
    (record.status === "pending" || record.status === "approved") &&
    (record.profileId === undefined || validProfiles.includes(record.profileId)) &&
    typeof record.displayName === "string" && typeof record.headline === "string" &&
    typeof record.summary === "string" && Array.isArray(record.skills) && isValidPublicContact(record.contact) &&
    record.skills.every((skill) => typeof skill === "string") &&
    (record.privateReviewNotes === undefined || typeof record.privateReviewNotes === "string") &&
    isValidStructuredSections(sections);
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

async function writePublishedResumeFeed(bucket: PrivateBucket, records: ResumeRecord[]): Promise<void> {
  const publicResumes = records
    .filter((item) => item.status === "approved" && !!item.profileId && item.profileId !== "unassigned")
     .map(({ id, profileId, displayName, headline, summary, skills, contact, structuredSections, uploadedAt }) => ({
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
    }));

  await bucket.put("public/approved-resumes.json", JSON.stringify({
    updatedAt: new Date().toISOString(),
    resumes: publicResumes,
  }), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
      cacheControl: "no-store",
    },
  } as { httpMetadata?: { contentType?: string; cacheControl?: string } });
}

function bucketNotConfigured(): Response {
  return jsonResponse({
    error: "Private content storage is unavailable. Configure the RESUME_BUCKET binding for persistent storage.",
  }, 503);
}

async function handleResumeApi(request: Request, env: unknown): Promise<Response | null> {
  const path = normalizedPath(request);
  if (!path.startsWith("/api/admin/resumes") && path !== "/api/published-resumes") return null;
  if (path === "/api/published-resumes" && request.method === "GET") {
    const publicBucket = resolvePrivateBucket(env);
    if (!publicBucket) return jsonResponse({ updatedAt: null, resumes: [] }, 200);
    const published = await publicBucket.get("public/approved-resumes.json");
    return published ? new Response(await published.arrayBuffer(), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
    }) : jsonResponse({ updatedAt: null, resumes: [] }, 200);
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
    const file = form?.get("file");
    const requestedProfile = form?.get("profileId");
    if (!(file instanceof File)) return jsonResponse({ error: "Choose a PDF or DOCX resume." }, 400);
    if (typeof requestedProfile !== "string" || !["abhishek", "ammu", "bava", "sai", "unassigned"].includes(requestedProfile)) {
      return jsonResponse({ error: "Choose a valid profile assignment." }, 400);
    }
    const type = file.type || (file.name.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : file.name.toLowerCase().endsWith(".docx")
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "");
    if (!ALLOWED_RESUME_TYPES.has(type)) return jsonResponse({ error: "Only PDF and DOCX files are allowed." }, 415);
    if (file.size <= 0 || file.size > MAX_RESUME_BYTES) return jsonResponse({ error: "File must be between 1 byte and 10 MB." }, 413);

    // Validate the extension and file signature rather than trusting client MIME metadata alone.
    const lowerName = file.name.toLowerCase();
    const isPdf = type === "application/pdf";
    const isDocx = type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if ((isPdf && !lowerName.endsWith(".pdf")) || (isDocx && !lowerName.endsWith(".docx"))) {
      return jsonResponse({ error: "The file extension must match its declared PDF or DOCX type." }, 415);
    }
    const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const hasPdfSignature = header.length >= 5 && header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46 && header[4] === 0x2d;
    const hasZipSignature = header.length >= 4 && header[0] === 0x50 && header[1] === 0x4b && ((header[2] === 0x03 && header[3] === 0x04) || (header[2] === 0x05 && header[3] === 0x06) || (header[2] === 0x07 && header[3] === 0x08));
    if ((isPdf && !hasPdfSignature) || (isDocx && !hasZipSignature)) {
      return jsonResponse({ error: "The file content does not match a supported PDF or DOCX file." }, 415);
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
        id, filename: safeName, contentType: type, size: file.size,
        uploadedAt: new Date().toISOString(), status: "pending", profileId: requestedProfile as ResumeRecord["profileId"],
        displayName: safeName.replace(/\.(pdf|docx)$/i, ""),
        headline: "", summary: "", skills: [],
        structuredSections: { experience: [], education: [], projects: [], certifications: [] },
      };
      records.push(record);
      await writeResumeIndex(bucket, records);
      return jsonResponse({ resume: record }, 201);
    } catch (error) {
      if (storedFile) {
        try { await bucket.delete(key); }
        catch (cleanupError) { console.error("Failed to clean up an incomplete resume upload.", cleanupError); }
      }
      throw error;
    }
  }

  const match = path.match(/^\/api\/admin\/resumes\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/(download|extract|publish|draft|unpublish))?$/i);
  if (match) {
    const [, id, action] = match;
    const records = await readResumeIndex(bucket);
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) return privateNotFound();
    const record = records[index];
    const fileKey = `private-admin/resumes/files/${id}`;

    if (action === "extract" && request.method === "POST") {
      const object = await bucket.get(fileKey);
      if (!object) return privateNotFound();
      try {
        const extracted = await extractResumeText(new Uint8Array(await object.arrayBuffer()), record.contentType);
        return jsonResponse({
          text: extracted.text,
          method: extracted.method,
          warning: extracted.warning ?? null,
        }, 200);
      } catch (error) {
        return jsonResponse({
          error: error instanceof Error ? error.message : "Could not extract text from this resume.",
        }, 422);
      }
    }

    if (action === "download" && request.method === "GET") {
      const object = await bucket.get(fileKey);
      if (!object) return privateNotFound();
      const bytes = await object.arrayBuffer();
      return new Response(bytes, { headers: {
        "content-type": record.contentType,
        "content-disposition": `attachment; filename="${record.filename.replace(/["\\\\]/g, "_")}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      } });
    }

    if (action === "draft" && request.method === "POST") {
      const boundedRequest = await limitRequestBody(request, 32 * 1024);
      if (boundedRequest instanceof Response) return boundedRequest;
      request = boundedRequest;
      const payload = await request.json().catch(() => null) as Partial<ResumeRecord> | null;
      if (!payload || typeof payload.displayName !== "string" || typeof payload.headline !== "string" ||
          typeof payload.summary !== "string" || !Array.isArray(payload.skills) ||
          payload.skills.some((skill) => typeof skill !== "string") ||
          !isValidPublicContact(payload.contact) ||
          !isValidStructuredSections(payload.structuredSections) ||
          (payload.privateReviewNotes !== undefined && typeof payload.privateReviewNotes !== "string") ||
          !["abhishek", "ammu", "bava", "sai", "unassigned"].includes(String(payload.profileId))) {
        return jsonResponse({ error: "Provide valid reviewed details and select the correct profile." }, 400);
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
        contact: payload.contact && Object.values(payload.contact).some((value) => typeof value === "string" && value.trim())
          ? payload.contact
          : undefined,
        structuredSections: {
          experience: (payload.structuredSections?.experience ?? record.structuredSections?.experience ?? []).slice(0, 30).map((entry) => sanitizeStructuredEntry(entry, 1200)),
          education: (payload.structuredSections?.education ?? record.structuredSections?.education ?? []).slice(0, 20).map((entry) => sanitizeStructuredEntry(entry, 1200)),
          projects: (payload.structuredSections?.projects ?? record.structuredSections?.projects ?? []).slice(0, 30).map((entry) => sanitizeStructuredEntry(entry, 1200)),
          certifications: (payload.structuredSections?.certifications ?? record.structuredSections?.certifications ?? []).slice(0, 40).map((entry) => sanitizeStructuredEntry(entry, 500)),
        },
        privateReviewNotes: (payload.privateReviewNotes ?? record.privateReviewNotes ?? "").slice(0, 12000),
        status: "pending",
      };
      await writePublishedResumeFeed(bucket, records);
      await writeResumeIndex(bucket, records);
      return jsonResponse({ resume: records[index] }, 200);
    }
    if (action === "unpublish" && request.method === "POST") {
      if (record.status !== "approved") return jsonResponse({ error: "This resume is not currently published." }, 409);
      records[index] = { ...record, status: "pending" };
      await writePublishedResumeFeed(bucket, records);
      await writeResumeIndex(bucket, records);
      return jsonResponse({ resume: records[index] }, 200);
    }

    if (action === "publish" && request.method === "POST") {
      const boundedRequest = await limitRequestBody(request, 32 * 1024);
      if (boundedRequest instanceof Response) return boundedRequest;
      request = boundedRequest;
      const payload = await request.json().catch(() => null) as Partial<ResumeRecord> | null;
      if (!payload || typeof payload.displayName !== "string" || typeof payload.headline !== "string" ||
          typeof payload.summary !== "string" || !Array.isArray(payload.skills) ||
          payload.skills.some((skill) => typeof skill !== "string") ||
          !isValidPublicContact(payload.contact) ||
          !isValidStructuredSections(payload.structuredSections) ||
          (payload.privateReviewNotes !== undefined && typeof payload.privateReviewNotes !== "string") ||
          !["abhishek", "ammu", "bava", "sai", "unassigned"].includes(String(payload.profileId))) {
        return jsonResponse({ error: "Provide valid reviewed details and select the correct profile." }, 400);
      }
      if (!payload.profileId || payload.profileId === "unassigned") {
        return jsonResponse({ error: "Assign this resume to a public profile before publishing." }, 400);
      }
      records[index] = {
        ...record,
        profileId: payload.profileId as ResumeRecord["profileId"],
        displayName: payload.displayName.slice(0, 120),
        headline: payload.headline.slice(0, 180),
        summary: payload.summary.slice(0, 3000),
        skills: payload.skills.slice(0, 60).map((skill) => skill.slice(0, 80)),
        contact: payload.contact && Object.values(payload.contact).some((value) => typeof value === "string" && value.trim())
          ? payload.contact
          : undefined,
        structuredSections: {
          experience: (payload.structuredSections?.experience ?? record.structuredSections?.experience ?? []).slice(0, 30).map((entry) => sanitizeStructuredEntry(entry, 1200)),
          education: (payload.structuredSections?.education ?? record.structuredSections?.education ?? []).slice(0, 20).map((entry) => sanitizeStructuredEntry(entry, 1200)),
          projects: (payload.structuredSections?.projects ?? record.structuredSections?.projects ?? []).slice(0, 30).map((entry) => sanitizeStructuredEntry(entry, 1200)),
          certifications: (payload.structuredSections?.certifications ?? record.structuredSections?.certifications ?? []).slice(0, 40).map((entry) => sanitizeStructuredEntry(entry, 500)),
        },
        privateReviewNotes: (payload.privateReviewNotes ?? record.privateReviewNotes ?? "").slice(0, 12000),
        status: "approved",
      };
      await writeResumeIndex(bucket, records);
      await writePublishedResumeFeed(bucket, records);
      return jsonResponse({ resume: records[index] }, 200);
    }

    if (request.method === "DELETE" && !action) {
      records.splice(index, 1);
      await writePublishedResumeFeed(bucket, records);
      await writeResumeIndex(bucket, records);
      await bucket.delete(fileKey);
      return jsonResponse({ ok: true }, 200);
    }
  }

  return privateNotFound();
}

type PortfolioImageRecord = { id: string; filename: string; contentType: string; size: number; uploadedAt: string; status: "pending" | "approved"; profileId: "abhishek" | "ammu" | "bava" | "sai"; alt: string; slot?: "gallery" | "portrait"; };
const IMAGE_INDEX_KEY = "private-admin/images/index.json";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Map([["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/webp", ".webp"], ["image/avif", ".avif"]]);

function isPortfolioImageRecord(value: unknown): value is PortfolioImageRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<PortfolioImageRecord>;
  return typeof record.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.id) &&
    typeof record.filename === "string" && record.filename.length > 0 && record.filename.length <= 120 &&
    IMAGE_TYPES.has(String(record.contentType)) &&
    Number.isSafeInteger(record.size) && Number(record.size) > 0 && Number(record.size) <= MAX_IMAGE_BYTES &&
    typeof record.uploadedAt === "string" && Number.isFinite(Date.parse(record.uploadedAt)) &&
    (record.status === "pending" || record.status === "approved") &&
    ["abhishek", "ammu", "bava", "sai"].includes(String(record.profileId)) &&
    typeof record.alt === "string" && record.alt.trim().length > 0 && record.alt.length <= 300 &&
    (record.slot === undefined || record.slot === "gallery" || record.slot === "portrait");
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
async function writeImageIndex(bucket: PrivateBucket, records: PortfolioImageRecord[]): Promise<void> {
  await bucket.put(IMAGE_INDEX_KEY, JSON.stringify(records), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
}

async function handlePortfolioImageApi(request: Request, env: unknown): Promise<Response | null> {
  const path = normalizedPath(request);
  if (!path.startsWith("/api/admin/images") && path !== "/api/published-images" && !path.startsWith("/api/published-images/")) return null;
  const bucket = resolvePrivateBucket(env);
  if (!bucket) {
    if (path === "/api/published-images" && request.method === "GET") return jsonResponse({ images: [] }, 200);
    return bucketNotConfigured();
  }
  if (path === "/api/published-images" && request.method === "GET") {
    const images = (await readImageIndex(bucket)).filter((item) => item.status === "approved").map(({ id, profileId, alt, filename, contentType, slot }) => ({ id, profileId, alt, filename, contentType, slot: slot ?? "gallery", src: `/api/published-images/${id}` }));
    return jsonResponse({ images }, 200, { "cache-control": "no-store" });
  }
  const publicImage = path.match(/^\/api\/published-images\/([a-f0-9-]+)$/);
  if (publicImage && request.method === "GET") {
    const record = (await readImageIndex(bucket)).find((item) => item.id === publicImage[1] && item.status === "approved");
    if (!record) return privateNotFound();
    const object = await bucket.get(`public/profile-images/${record.id}`);
    if (!object) return privateNotFound();
    return new Response(await object.arrayBuffer(), { headers: { "content-type": record.contentType, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  }
  if (!(await isAdminAuthorized(request, env))) return privateNotFound();
  if (["POST", "DELETE"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return privateNotFound();
  }
  if (path === "/api/admin/images" && request.method === "GET") return jsonResponse({ images: await readImageIndex(bucket), storageMode: isLocalDevelopmentBucket(bucket) ? "local-ephemeral" : "persistent" }, 200);
  if (path === "/api/admin/images" && request.method === "POST") {
    const boundedRequest = await limitRequestBody(request, MAX_IMAGE_BYTES + 1024 * 1024);
    if (boundedRequest instanceof Response) return boundedRequest;
    request = boundedRequest;
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const profileId = form?.get("profileId");
    const alt = form?.get("alt");
    const requestedSlot = form?.get("slot");
    const slot = requestedSlot === "portrait" ? "portrait" : requestedSlot === "gallery" ? "gallery" : null;
    const publishOnUpload = form?.get("publishOnUpload") === "true";
    if (!(file instanceof File) || typeof profileId !== "string" || !["abhishek", "ammu", "bava", "sai"].includes(profileId) || typeof alt !== "string" || !alt.trim() || !slot) return jsonResponse({ error: "Choose an image, profile, image placement and descriptive alt text." }, 400);
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) return jsonResponse({ error: "Image must be between 1 byte and 10 MB." }, 413);
    const expectedExtension = IMAGE_TYPES.get(file.type);
    if (!expectedExtension || !(file.type === "image/jpeg" ? /\.jpe?g$/i.test(file.name) : file.name.toLowerCase().endsWith(expectedExtension))) return jsonResponse({ error: "Only JPEG, PNG, WebP and AVIF images with matching extensions are allowed." }, 415);
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const validSignature = file.type === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff : file.type === "image/png" ? bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 : file.type === "image/webp" ? String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP" : file.type === "image/avif" ? String.fromCharCode(...bytes.slice(4,12)).includes("ftypavif") || String.fromCharCode(...bytes.slice(4,12)).includes("ftypavis") : false;
    if (!validSignature) return jsonResponse({ error: "The file signature does not match its declared image type." }, 415);
    const id = crypto.randomUUID();
    const filename = file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120) || `image${expectedExtension}`;
    const privateKey = `private-admin/images/files/${id}`;
    const publicKey = `public/profile-images/${id}`;
    let storedPrivate = false;
    let storedPublic = false;
    let indexed = false;
    try {
      await bucket.put(privateKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
      storedPrivate = true;
      const records = await readImageIndex(bucket);
      const record: PortfolioImageRecord = { id, filename, contentType: file.type, size: file.size, uploadedAt: new Date().toISOString(), status: publishOnUpload ? "approved" : "pending", profileId: profileId as PortfolioImageRecord["profileId"], alt: alt.trim().slice(0, 300), slot };
      if (publishOnUpload) {
        const privateObject = await bucket.get(privateKey);
        if (!privateObject) throw new Error("Stored image upload is missing.");
        await bucket.put(publicKey, await privateObject.arrayBuffer(), { httpMetadata: { contentType: file.type } });
        storedPublic = true;
      }
      records.push(record);
      await writeImageIndex(bucket, records);
      indexed = true;
      return jsonResponse({ image: record }, 201);
    } catch (error) {
      // Keep the API failure actionable during local development instead of
      // allowing the framework to replace it with an opaque HTTPError response.
      console.error("Portfolio image upload failed while storing or indexing the image.", error);
      const cleanupFailures: string[] = [];
      if (!indexed) {
        if (storedPublic) {
          try { await bucket.delete(publicKey); }
          catch (cleanupError) {
            cleanupFailures.push("public image cleanup failed");
            console.error("Failed to clean up an incomplete public image upload.", cleanupError);
          }
        }
        if (storedPrivate) {
          try { await bucket.delete(privateKey); }
          catch (cleanupError) {
            cleanupFailures.push("private image cleanup failed");
            console.error("Failed to clean up an incomplete private image upload.", cleanupError);
          }
        }
      }
      return jsonResponse({
        error: "Image upload failed while saving the image. Check the development server terminal for the detailed cause and retry.",
        code: "IMAGE_UPLOAD_STORAGE_FAILED",
        cleanupWarning: cleanupFailures.length ? cleanupFailures.join("; ") : undefined,
      }, 500);
    }
  }
  const match = path.match(/^\/api\/admin\/images\/([a-f0-9-]+)(?:\/(publish|unpublish))?$/);
  if (match) {
    const [, id, action] = match; const records = await readImageIndex(bucket); const index = records.findIndex((item) => item.id === id);
    if (index < 0) return privateNotFound(); const record = records[index];
    if (action === "publish" && request.method === "POST") {
      const object = await bucket.get(`private-admin/images/files/${id}`); if (!object) return privateNotFound();
      await bucket.put(`public/profile-images/${id}`, await object.arrayBuffer(), { httpMetadata: { contentType: record.contentType } });
      records[index] = { ...record, status: "approved" }; await writeImageIndex(bucket, records);
      return jsonResponse({ image: records[index] }, 200);
    }
    if (action === "unpublish" && request.method === "POST") {
      if (record.status !== "approved") return jsonResponse({ error: "This image is not currently published." }, 409);
      await bucket.delete(`public/profile-images/${id}`);
      records[index] = { ...record, status: "pending" }; await writeImageIndex(bucket, records);
      return jsonResponse({ image: records[index] }, 200);
    }
    if (!action && request.method === "DELETE") {
      // Remove public bytes before changing the index; a failed index write can
      // leave an approved record temporarily unavailable, but never publicly served.
      await bucket.delete(`public/profile-images/${id}`);
      records.splice(index, 1);
      await writeImageIndex(bucket, records);
      // Private cleanup happens only after the public index no longer references the image.
      await bucket.delete(`private-admin/images/files/${id}`);
      return jsonResponse({ ok: true }, 200);
    }
  }  return privateNotFound();
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

async function attachPublishedResumeContext(request: Request, env: unknown): Promise<Request | Response> {
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

  const profileId = typeof payload.person === "string" ? payload.person : "abhishek";
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
          ? feed.resumes.filter((item): item is Record<string, unknown> =>
              !!item && typeof item === "object" && !Array.isArray(item) &&
              item.profileId === profileId)
          : [];
        const timestamp = (record: Record<string, unknown>): number => {
          if (typeof record.uploadedAt !== "string") return 0;
          const parsed = Date.parse(record.uploadedAt);
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

  // Discard any client-supplied internal field before adding trusted data.
  const clientPayload = { ...payload };
  delete clientPayload._publishedResume;
  let body = JSON.stringify({ ...clientPayload, _publishedResume: publishedResume });
  const encoder = new TextEncoder();
  if (encoder.encode(body).byteLength > 70 * 1024) {
    // Preserve a valid user request when its body leaves no room for resume
    // context; the chat route will then use its static verified profile data.
    body = JSON.stringify({ ...clientPayload, _publishedResume: null });
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

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const path = normalizedPath(request);
    const isAdmin = isAdminPath(path);
    const authResponse = await handleAdminAuth(request, env);
    if (authResponse) return authResponse;
    const resumeResponse = await handleResumeApi(request, env);
    if (resumeResponse) return resumeResponse;
    try {
      const imageResponse = await handlePortfolioImageApi(request, env);
      if (imageResponse) return imageResponse;
    } catch (error) {
      // Keep image API failures inside the API boundary so the admin UI receives
      // a JSON response instead of an opaque framework-generated HTTP 500.
      console.error("Portfolio image API request failed.", error);
      const message = error instanceof Error ? error.message : "Unknown image storage error.";
      return jsonResponse({
        error: "The image operation failed on the server.",
        ...(import.meta.env.DEV === true ? { detail: message } : {}),
      }, 500);
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
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
