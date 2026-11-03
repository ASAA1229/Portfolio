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

// Protect every admin path before it reaches TanStack or a route handler.
function normalizedPath(request: Request): string {
  let pathname = new URL(request.url).pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // A malformed path remains private and is rejected below.
  }
  return pathname.toLowerCase().replace(/\/+$/, "") || "/";
}

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/") ||
    pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
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

async function handleAdminAuth(request: Request, env: unknown): Promise<Response | null> {
  const path = normalizedPath(request);
  if (path === "/api/admin/login" && request.method === "POST") {
    if (!adminAuthConfigured(env)) {
      console.error("Admin authentication is disabled: required server secrets are missing.");
      return jsonResponse({ error: "Admin authentication is not configured." }, 503);
    }
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return privateNotFound();

    const clientKey = request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const now = Date.now();
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
    if (!(await isAdminRequest(request, env))) return privateNotFound();
    return jsonResponse({ ok: true }, 200, {
      "set-cookie": clearAdminCookieHeader(new URL(request.url).protocol === "https:"),
    });
  }

  if (path === "/api/admin/session" && request.method === "GET") {
    if (!(await isAdminRequest(request, env))) return privateNotFound();
    return jsonResponse({ authenticated: true }, 200);
  }

  return null;
}


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
  structuredSections?: { experience: string[]; education: string[]; projects: string[]; certifications: string[] };
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

const RESUME_INDEX_KEY = "private-admin/resumes/index.json";
const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const ALLOWED_RESUME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

async function readResumeIndex(bucket: PrivateBucket): Promise<ResumeRecord[]> {
  const object = await bucket.get(RESUME_INDEX_KEY);
  if (!object) return [];
  const records = await object.json<unknown>();
  return Array.isArray(records) ? records as ResumeRecord[] : [];
}

async function writeResumeIndex(bucket: PrivateBucket, records: ResumeRecord[]): Promise<void> {
  await bucket.put(RESUME_INDEX_KEY, JSON.stringify(records), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

function bucketNotConfigured(): Response {
  return jsonResponse({ error: "Private resume storage is not configured." }, 503);
}

async function handleResumeApi(request: Request, env: unknown): Promise<Response | null> {
  const path = normalizedPath(request);
  if (!path.startsWith("/api/admin/resumes") && path !== "/api/published-resumes") return null;
  if (path === "/api/published-resumes" && request.method === "GET") {
    const publicBucket = (env as AdminEnv | undefined)?.RESUME_BUCKET;
    if (!publicBucket) return jsonResponse({ updatedAt: null, resumes: [] }, 200);
    const published = await publicBucket.get("public/approved-resumes.json");
    return published ? new Response(await published.arrayBuffer(), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
    }) : jsonResponse({ updatedAt: null, resumes: [] }, 200);
  }
  if (!(await isAdminRequest(request, env))) return privateNotFound();
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
  const bucket = (env as AdminEnv | undefined)?.RESUME_BUCKET;
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
    await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: type } });
    const records = await readResumeIndex(bucket);
    records.push({
      id, filename: safeName, contentType: type, size: file.size,
      uploadedAt: new Date().toISOString(), status: "pending", profileId: requestedProfile as ResumeRecord["profileId"],
      displayName: safeName.replace(/\.(pdf|docx)$/i, ""),
      headline: "", summary: "", skills: [],
      structuredSections: { experience: [], education: [], projects: [], certifications: [] },
    });
    await writeResumeIndex(bucket, records);
    return jsonResponse({ resume: records[records.length - 1] }, 201);
  }

  const match = path.match(/^\/api\/admin\/resumes\/([a-f0-9-]+)(?:\/(download|extract|publish|draft|unpublish))?$/);
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
      const payload = await request.json().catch(() => null) as Partial<ResumeRecord> | null;
      if (!payload || typeof payload.displayName !== "string" || typeof payload.headline !== "string" ||
          typeof payload.summary !== "string" || !Array.isArray(payload.skills) ||
          payload.skills.some((skill) => typeof skill !== "string") ||
          (payload.structuredSections !== undefined && (!payload.structuredSections || typeof payload.structuredSections !== "object" || !["experience", "education", "projects", "certifications"].every((section) => Array.isArray(payload.structuredSections?.[section as keyof NonNullable<ResumeRecord["structuredSections"]>]) && (payload.structuredSections?.[section as keyof NonNullable<ResumeRecord["structuredSections"]>] as unknown[]).every((entry) => typeof entry === "string")))) ||
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
        structuredSections: {
          experience: (payload.structuredSections?.experience ?? record.structuredSections?.experience ?? []).slice(0, 30).map((entry) => entry.slice(0, 1200)),
          education: (payload.structuredSections?.education ?? record.structuredSections?.education ?? []).slice(0, 20).map((entry) => entry.slice(0, 1200)),
          projects: (payload.structuredSections?.projects ?? record.structuredSections?.projects ?? []).slice(0, 30).map((entry) => entry.slice(0, 1200)),
          certifications: (payload.structuredSections?.certifications ?? record.structuredSections?.certifications ?? []).slice(0, 40).map((entry) => entry.slice(0, 500)),
        },
        privateReviewNotes: (payload.privateReviewNotes ?? record.privateReviewNotes ?? "").slice(0, 12000),
        status: "pending",
      };
      await writeResumeIndex(bucket, records);
      await bucket.put("public/approved-resumes.json", JSON.stringify({
        updatedAt: new Date().toISOString(),
        resumes: records.filter((item) => item.status === "approved" && !!item.profileId && item.profileId !== "unassigned").map(({ id, profileId, displayName, headline, summary, skills, structuredSections }) => ({ id, profileId, displayName, headline, summary, skills, structuredSections: structuredSections ?? { experience: [], education: [], projects: [], certifications: [] } })),
      }), { httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" } } as { httpMetadata?: { contentType?: string } });
      return jsonResponse({ resume: records[index] }, 200);
    }
    if (action === "unpublish" && request.method === "POST") {
      if (record.status !== "approved") return jsonResponse({ error: "This resume is not currently published." }, 409);
      records[index] = { ...record, status: "pending" };
      await writeResumeIndex(bucket, records);
      await bucket.put("public/approved-resumes.json", JSON.stringify({
        updatedAt: new Date().toISOString(),
        resumes: records.filter((item) => item.status === "approved" && !!item.profileId && item.profileId !== "unassigned").map(({ id, profileId, displayName, headline, summary, skills, structuredSections }) => ({ id, profileId, displayName, headline, summary, skills, structuredSections: structuredSections ?? { experience: [], education: [], projects: [], certifications: [] } })),
      }), { httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" } } as { httpMetadata?: { contentType?: string } });
      return jsonResponse({ resume: records[index] }, 200);
    }

    if (action === "publish" && request.method === "POST") {
      const payload = await request.json().catch(() => null) as Partial<ResumeRecord> | null;
      if (!payload || typeof payload.displayName !== "string" || typeof payload.headline !== "string" ||
          typeof payload.summary !== "string" || !Array.isArray(payload.skills) ||
          payload.skills.some((skill) => typeof skill !== "string") ||
          (payload.structuredSections !== undefined && (!payload.structuredSections || typeof payload.structuredSections !== "object" || !["experience", "education", "projects", "certifications"].every((section) => Array.isArray(payload.structuredSections?.[section as keyof NonNullable<ResumeRecord["structuredSections"]>]) && (payload.structuredSections?.[section as keyof NonNullable<ResumeRecord["structuredSections"]>] as unknown[]).every((entry) => typeof entry === "string")))) ||
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
        structuredSections: {
          experience: (payload.structuredSections?.experience ?? record.structuredSections?.experience ?? []).slice(0, 30).map((entry) => entry.slice(0, 1200)),
          education: (payload.structuredSections?.education ?? record.structuredSections?.education ?? []).slice(0, 20).map((entry) => entry.slice(0, 1200)),
          projects: (payload.structuredSections?.projects ?? record.structuredSections?.projects ?? []).slice(0, 30).map((entry) => entry.slice(0, 1200)),
          certifications: (payload.structuredSections?.certifications ?? record.structuredSections?.certifications ?? []).slice(0, 40).map((entry) => entry.slice(0, 500)),
        },
        privateReviewNotes: (payload.privateReviewNotes ?? record.privateReviewNotes ?? "").slice(0, 12000),
        status: "approved",
      };
      await writeResumeIndex(bucket, records);
      await bucket.put("public/approved-resumes.json", JSON.stringify({
        updatedAt: new Date().toISOString(),
        resumes: records.filter((item) => item.status === "approved" && !!item.profileId && item.profileId !== "unassigned").map(({ id, profileId, displayName, headline, summary, skills, structuredSections }) => ({ id, profileId, displayName, headline, summary, skills, structuredSections: structuredSections ?? { experience: [], education: [], projects: [], certifications: [] } })),
      }), { httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" } } as { httpMetadata?: { contentType?: string } });
      return jsonResponse({ resume: records[index] }, 200);
    }

    if (request.method === "DELETE" && !action) {
      await bucket.delete(fileKey);
      records.splice(index, 1);
      await writeResumeIndex(bucket, records);
      await bucket.put("public/approved-resumes.json", JSON.stringify({
        updatedAt: new Date().toISOString(),
        resumes: records.filter((item) => item.status === "approved" && item.profileId !== "unassigned").map(({ id, profileId, displayName, headline, summary, skills, structuredSections }) => ({ id, profileId, displayName, headline, summary, skills, structuredSections: structuredSections ?? { experience: [], education: [], projects: [], certifications: [] } })),
      }), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
      return jsonResponse({ ok: true }, 200);
    }
  }

  return privateNotFound();
}

type PortfolioImageRecord = { id: string; filename: string; contentType: string; size: number; uploadedAt: string; status: "pending" | "approved"; profileId: "abhishek" | "ammu" | "bava" | "sai"; alt: string; };
const IMAGE_INDEX_KEY = "private-admin/images/index.json";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Map([["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/webp", ".webp"], ["image/avif", ".avif"]]);

async function readImageIndex(bucket: PrivateBucket): Promise<PortfolioImageRecord[]> {
  const object = await bucket.get(IMAGE_INDEX_KEY);
  if (!object) return [];
  const records = await object.json<unknown>();
  return Array.isArray(records) ? records as PortfolioImageRecord[] : [];
}
async function writeImageIndex(bucket: PrivateBucket, records: PortfolioImageRecord[]): Promise<void> {
  await bucket.put(IMAGE_INDEX_KEY, JSON.stringify(records), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
}

async function handlePortfolioImageApi(request: Request, env: unknown): Promise<Response | null> {
  const path = normalizedPath(request);
  if (!path.startsWith("/api/admin/images") && path !== "/api/published-images" && !path.startsWith("/api/published-images/")) return null;
  const bucket = (env as AdminEnv | undefined)?.RESUME_BUCKET;
  if (!bucket) {
    if (path === "/api/published-images" && request.method === "GET") return jsonResponse({ images: [] }, 200);
    return bucketNotConfigured();
  }
  if (path === "/api/published-images" && request.method === "GET") {
    const images = (await readImageIndex(bucket)).filter((item) => item.status === "approved").map(({ id, profileId, alt, filename, contentType }) => ({ id, profileId, alt, filename, contentType, src: `/api/published-images/${id}` }));
    return jsonResponse({ images }, 200, { "cache-control": "public, max-age=60, stale-while-revalidate=300" });
  }
  const publicImage = path.match(/^\/api\/published-images\/([a-f0-9-]+)$/);
  if (publicImage && request.method === "GET") {
    const record = (await readImageIndex(bucket)).find((item) => item.id === publicImage[1] && item.status === "approved");
    if (!record) return privateNotFound();
    const object = await bucket.get(`public/profile-images/${record.id}`);
    if (!object) return privateNotFound();
    return new Response(await object.arrayBuffer(), { headers: { "content-type": record.contentType, "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" } });
  }
  if (!(await isAdminRequest(request, env))) return privateNotFound();
  if (["POST", "DELETE"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return privateNotFound();
  }
  if (path === "/api/admin/images" && request.method === "GET") return jsonResponse({ images: await readImageIndex(bucket) }, 200);
  if (path === "/api/admin/images" && request.method === "POST") {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const profileId = form?.get("profileId");
    const alt = form?.get("alt");
    const publishOnUpload = form?.get("publishOnUpload") === "true";
    if (!(file instanceof File) || typeof profileId !== "string" || !["abhishek", "ammu", "bava", "sai"].includes(profileId) || typeof alt !== "string" || !alt.trim()) return jsonResponse({ error: "Choose an image, profile and descriptive alt text." }, 400);
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) return jsonResponse({ error: "Image must be between 1 byte and 10 MB." }, 413);
    const expectedExtension = IMAGE_TYPES.get(file.type);
    if (!expectedExtension || !(file.type === "image/jpeg" ? /\.jpe?g$/i.test(file.name) : file.name.toLowerCase().endsWith(expectedExtension))) return jsonResponse({ error: "Only JPEG, PNG, WebP and AVIF images with matching extensions are allowed." }, 415);
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const validSignature = file.type === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff : file.type === "image/png" ? bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 : file.type === "image/webp" ? String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP" : file.type === "image/avif" ? String.fromCharCode(...bytes.slice(4,12)).includes("ftypavif") || String.fromCharCode(...bytes.slice(4,12)).includes("ftypavis") : false;
    if (!validSignature) return jsonResponse({ error: "The file signature does not match its declared image type." }, 415);
    const id = crypto.randomUUID();
    const filename = file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120) || `image${expectedExtension}`;
    await bucket.put(`private-admin/images/files/${id}`, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    const records = await readImageIndex(bucket);
    const record: PortfolioImageRecord = { id, filename, contentType: file.type, size: file.size, uploadedAt: new Date().toISOString(), status: publishOnUpload ? "approved" : "pending", profileId: profileId as PortfolioImageRecord["profileId"], alt: alt.trim().slice(0, 300) };
    if (publishOnUpload) {
      await bucket.put(`public/profile-images/${id}`, await bucket.get(`private-admin/images/files/${id}`).then((object) => object?.arrayBuffer() ?? Promise.reject(new Error("Stored upload is missing."))), { httpMetadata: { contentType: file.type } });
    }
    records.push(record); await writeImageIndex(bucket, records);
    return jsonResponse({ image: record }, 201);
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
      await bucket.delete(`private-admin/images/files/${id}`); await bucket.delete(`public/profile-images/${id}`); records.splice(index, 1); await writeImageIndex(bucket, records); return jsonResponse({ ok: true }, 200);
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

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const path = normalizedPath(request);
    const isAdmin = isAdminPath(path);
    const authResponse = await handleAdminAuth(request, env);
    if (authResponse) return authResponse;
    const resumeResponse = await handleResumeApi(request, env);
    if (resumeResponse) return resumeResponse;
    const imageResponse = await handlePortfolioImageApi(request, env);
    if (imageResponse) return imageResponse;

    // The login page is intentionally the only public admin page. Every other
    // admin URL returns the same generic 404 until a valid signed session exists.
    if (isAdmin && path !== "/admin/login" && !(await isAdminRequest(request, env))) {
      return privateNotFound();
    }
    if (isAdmin && path === "/admin/login" && request.method !== "GET") {
      return privateNotFound();
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
