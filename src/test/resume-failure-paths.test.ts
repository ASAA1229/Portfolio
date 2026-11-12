// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import server from "@/server";
import { createLocalDiskBucket } from "@/lib/local-disk-bucket";
import { extractResumeText } from "@/lib/resume-extraction";

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const encoder = new TextEncoder();

describe("resume parser failures", () => {
  it("rejects empty, unsupported, image-only PDF and corrupt DOCX input with clear errors", async () => {
    await expect(extractResumeText(new Uint8Array(), PDF)).rejects.toThrow(/empty/);
    await expect(extractResumeText(encoder.encode("hello"), "text/plain")).rejects.toThrow(
      /Only PDF and DOCX/,
    );
    await expect(
      extractResumeText(encoder.encode("%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF"), PDF),
    ).rejects.toThrow(/No extractable text/);
    await expect(
      extractResumeText(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5]), DOCX),
    ).rejects.toThrow();
  });
});

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Disk bucket whose public feed writes can be made to fail. */
function failingBucket() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "portfolio-failure-"));
  temps.push(dir);
  const disk = createLocalDiskBucket(dir);
  const state = {
    failFeed: false,
    failFeedAfterWrite: false,
    failHistoryAfterWrite: false,
  };
  const bucket = new Proxy(disk, {
    get(target, property) {
      if (property === "put") {
        return async (key: string, ...rest: unknown[]) => {
          if (state.failFeed && key === "public/approved-resumes.json") {
            // Model a transient provider failure: the failed write is rejected,
            // but a compensating restore is allowed to reach the object store.
            state.failFeed = false;
            throw new Error("simulated storage outage");
          }
          const result = await (target.put as (...args: unknown[]) => Promise<unknown>)(
            key,
            ...rest,
          );
          if (state.failFeedAfterWrite && key === "public/approved-resumes.json") {
            state.failFeedAfterWrite = false;
            throw new Error("simulated ambiguous write failure after persistence");
          }
          if (
            state.failHistoryAfterWrite &&
            key.startsWith("private-admin/resumes/history/")
          ) {
            state.failHistoryAfterWrite = false;
            throw new Error("simulated ambiguous history write failure after persistence");
          }
          return result;
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { bucket, state };
}

const origin = "http://localhost";
function call(env: unknown, pathname: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== "GET") headers.set("origin", origin);
  return server.fetch(new Request(origin + pathname, { ...init, headers }), env, {});
}

describe("resume partial persistence failures", () => {
  it("reverts the private index when the public feed write fails during publish", async () => {
    const { bucket, state } = failingBucket();
    const env = {
      ENVIRONMENT: "development",
      PORTFOLIO_ADMIN_AUTH_BYPASS: "true",
      RESUME_BUCKET: bucket,
    };
    const form = new FormData();
    form.set("profileId", "ammu");
    form.set(
      "file",
      new File([encoder.encode("%PDF-1.4 resume")], "ammu.pdf", { type: PDF }),
      "ammu.pdf",
    );
    const uploaded = await call(env, "/api/admin/resumes", { method: "POST", body: form });
    expect(uploaded.status).toBe(201);
    const { resume } = (await uploaded.json()) as { resume: { id: string } };

    state.failFeed = true;
    const published = await call(env, `/api/admin/resumes/${resume.id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profileId: "ammu",
        displayName: "Ammu",
        headline: "Engineer",
        summary: "Summary",
        skills: ["React"],
      }),
    });
    expect(published.status).toBe(500);
    expect(await published.json()).toMatchObject({
      code: "RESUME_STORAGE_COMMIT_FAILED",
      restored: true,
    });

    const listed = (await (await call(env, "/api/admin/resumes")).json()) as {
      resumes: Array<{ id: string; status: string }>;
    };
    expect(listed.resumes.find((item) => item.id === resume.id)?.status).toBe("pending");

    state.failFeed = false;
    const consistency = (await (await call(env, "/api/admin/resumes/consistency")).json()) as {
      feedInSync: boolean;
      missingFiles: string[];
    };
    expect(consistency.missingFiles).toEqual([]);
    const reconciled = await call(env, "/api/admin/resumes/reconcile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(reconciled.status).toBe(200);
    const after = (await (await call(env, "/api/admin/resumes/consistency")).json()) as {
      feedInSync: boolean;
    };
    expect(after.feedInSync).toBe(true);
  });

  it("compensates a public-feed write that persists before reporting failure", async () => {
    const { bucket, state } = failingBucket();
    const env = {
      ENVIRONMENT: "development",
      PORTFOLIO_ADMIN_AUTH_BYPASS: "true",
      RESUME_BUCKET: bucket,
    };
    const form = new FormData();
    form.set("profileId", "bava");
    form.set(
      "file",
      new File([encoder.encode("%PDF-1.4 resume")], "bava.pdf", { type: PDF }),
      "bava.pdf",
    );
    const uploaded = await call(env, "/api/admin/resumes", { method: "POST", body: form });
    expect(uploaded.status).toBe(201);
    const { resume } = (await uploaded.json()) as { resume: { id: string } };

    state.failFeedAfterWrite = true;
    const published = await call(env, `/api/admin/resumes/${resume.id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profileId: "bava",
        displayName: "Bava",
        headline: "Engineer",
        summary: "Summary",
        skills: ["TypeScript"],
      }),
    });
    expect(published.status).toBe(500);
    expect(await published.json()).toMatchObject({
      code: "RESUME_STORAGE_COMMIT_FAILED",
      restored: true,
    });

    const listed = (await (await call(env, "/api/admin/resumes")).json()) as {
      resumes: Array<{ id: string; status: string }>;
    };
    expect(listed.resumes.find((item) => item.id === resume.id)?.status).toBe("pending");
    const publicFeed = (await bucket.get("public/approved-resumes.json"))!;
    expect(await publicFeed.json()).toMatchObject({ resumes: [] });
    // The public-feed write failed before the history step was attempted.
    expect(await bucket.get("private-admin/resumes/history/bava.json")).toBeNull();
  });
});


it("blocks reconciliation when an indexed resume original is missing", async () => {
  const { bucket } = failingBucket();
  const env = {
    ENVIRONMENT: "development",
    PORTFOLIO_ADMIN_AUTH_BYPASS: "true",
    RESUME_BUCKET: bucket,
  };
  const form = new FormData();
  form.set("profileId", "sai");
  form.set(
    "file",
    new File([encoder.encode("%PDF-1.4 resume")], "sai.pdf", { type: PDF }),
    "sai.pdf",
  );
  const uploaded = await call(env, "/api/admin/resumes", { method: "POST", body: form });
  expect(uploaded.status).toBe(201);
  const { resume } = (await uploaded.json()) as { resume: { id: string } };

  const published = await call(env, `/api/admin/resumes/${resume.id}/publish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      profileId: "sai",
      displayName: "Sai",
      headline: "Engineer",
      summary: "Approved profile summary",
      skills: ["JavaScript"],
    }),
  });
  expect(published.status).toBe(200);
  const feedBefore = await (await bucket.get("public/approved-resumes.json"))!.text();

  await bucket.delete(`private-admin/resumes/files/${resume.id}`);
  const consistency = (await (await call(env, "/api/admin/resumes/consistency")).json()) as {
    missingFiles: string[];
  };
  expect(consistency.missingFiles).toContain(resume.id);

  const reconciled = await call(env, "/api/admin/resumes/reconcile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  expect(reconciled.status).toBe(409);
  expect(await reconciled.json()).toMatchObject({
    code: "RESUME_ORIGINALS_MISSING",
    reconciled: false,
    missingFiles: [resume.id],
  });
  const feedAfter = await (await bucket.get("public/approved-resumes.json"))!.text();
  expect(feedAfter).toBe(feedBefore);
  it("reverts index, public feed and history when the history write fails ambiguously", async () => {
    const { bucket, state } = failingBucket();
    const env = {
      ENVIRONMENT: "development",
      PORTFOLIO_ADMIN_AUTH_BYPASS: "true",
      RESUME_BUCKET: bucket,
    };
    const form = new FormData();
    form.set("profileId", "bava");
    form.set(
      "file",
      new File([encoder.encode("%PDF-1.4 resume")], "bava.pdf", { type: PDF }),
      "bava.pdf",
    );
    const uploaded = await call(env, "/api/admin/resumes", { method: "POST", body: form });
    expect(uploaded.status).toBe(201);
    const { resume } = (await uploaded.json()) as { resume: { id: string } };
    state.failHistoryAfterWrite = true;

    const published = await call(env, `/api/admin/resumes/${resume.id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profileId: "bava",
        displayName: "Bava",
        headline: "Engineer",
        summary: "Summary",
        skills: ["TypeScript"],
      }),
    });
    expect(published.status).toBe(500);
    expect(await published.json()).toMatchObject({
      code: "RESUME_STORAGE_COMMIT_FAILED",
      restored: true,
    });

    const listed = (await (await call(env, "/api/admin/resumes")).json()) as {
      resumes: Array<{ id: string; status: string }>;
    };
    expect(listed.resumes.find((item) => item.id === resume.id)?.status).toBe("pending");
    const feed = await (await bucket.get("public/approved-resumes.json"))!.json<{
      resumes: unknown[];
    }>();
    expect(feed.resumes).toEqual([]);
    expect(await bucket.get("private-admin/resumes/history/bava.json")).toBeNull();
  });

});
