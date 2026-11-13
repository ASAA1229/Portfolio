// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import server from "@/server";
import { createLocalDiskBucket } from "@/lib/local-disk-bucket";

const ORIGIN = "http://localhost";
const PDF = "application/pdf";
const PDF_BYTES = new TextEncoder().encode("%PDF-1.4\nPortfolio resume fixture\n%%EOF");
const PROFILES = ["abhishek", "ammu", "bava", "sai"] as const;
const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createEnv() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "portfolio-four-profile-resumes-"));
  tempDirs.push(directory);
  const bucket = createLocalDiskBucket(directory);
  return {
    bucket,
    env: {
      ENVIRONMENT: "development",
      PORTFOLIO_ADMIN_AUTH_BYPASS: "true",
      RESUME_BUCKET: bucket,
    },
  };
}

async function call(env: unknown, pathname: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== "GET") headers.set("origin", ORIGIN);
  return server.fetch(new Request(ORIGIN + pathname, { ...init, headers }), env, {});
}

async function uploadResume(env: unknown, profileId: (typeof PROFILES)[number], filename: string) {
  const form = new FormData();
  form.set("profileId", profileId);
  form.set("file", new File([PDF_BYTES], filename, { type: PDF }));
  const response = await call(env, "/api/admin/resumes", { method: "POST", body: form });
  expect(response.status).toBe(201);
  return (await response.json()) as { resume: { id: string; profileId: string; status: string } };
}

async function publishResume(
  env: unknown,
  id: string,
  profileId: (typeof PROFILES)[number],
  version: string,
) {
  return call(env, `/api/admin/resumes/${id}/publish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      profileId,
      displayName: `${profileId} ${version}`,
      headline: `${version} headline`,
      summary: `${version} public summary`,
      skills: ["TypeScript", "React"],
      contact: {},
      structuredSections: {
        experience: [],
        education: [],
        projects: [{ title: `${version} project` }],
        certifications: [],
      },
      privateReviewNotes: "private reviewer note",
    }),
  });
}

describe("four-profile resume resource lifecycle", () => {
  it.each(PROFILES)(
    "%s supports private upload, publish, supersede, rollback, unpublish and delete",
    async (profileId) => {
      const { bucket, env } = createEnv();
      const first = await uploadResume(env, profileId, `${profileId}-first.pdf`);
      expect(first.resume).toMatchObject({ profileId, status: "pending" });

      let publicFeed = (await (await call(env, "/api/published-resumes")).json()) as {
        resumes: Array<{ id: string; profileId: string }>;
      };
      expect(publicFeed.resumes.some((item) => item.id === first.resume.id)).toBe(false);
      expect((await publishResume(env, first.resume.id, profileId, "first")).status).toBe(200);

      publicFeed = (await (await call(env, "/api/published-resumes")).json()) as typeof publicFeed;
      expect(publicFeed.resumes).toContainEqual(
        expect.objectContaining({ id: first.resume.id, profileId }),
      );
      expect((await call(env, `/api/published-resumes/${first.resume.id}`)).status).toBe(200);

      const second = await uploadResume(env, profileId, `${profileId}-second.pdf`);
      expect((await publishResume(env, second.resume.id, profileId, "second")).status).toBe(200);
      const privateIndex = (await (await bucket.get(
        "private-admin/resumes/index.json",
      ))!.json()) as Array<{
        id: string;
        status: string;
        profileId: string;
      }>;
      expect(privateIndex.find((item) => item.id === first.resume.id)).toMatchObject({
        status: "pending",
        profileId,
      });
      expect(privateIndex.find((item) => item.id === second.resume.id)).toMatchObject({
        status: "approved",
        profileId,
      });

      const history = await call(env, `/api/admin/resumes/history?profileId=${profileId}`);
      expect(history.status).toBe(200);
      expect(((await history.json()) as { entries: unknown[] }).entries).toHaveLength(2);

      const rollback = await call(env, "/api/admin/resumes/rollback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      expect(rollback.status).toBe(200);
      expect((await rollback.json()).resume.id).toBe(first.resume.id);
      publicFeed = (await (await call(env, "/api/published-resumes")).json()) as typeof publicFeed;
      expect(publicFeed.resumes.some((item) => item.id === first.resume.id)).toBe(true);
      expect(publicFeed.resumes.some((item) => item.id === second.resume.id)).toBe(false);

      expect(
        (await call(env, `/api/admin/resumes/${first.resume.id}/unpublish`, { method: "POST" }))
          .status,
      ).toBe(200);
      publicFeed = (await (await call(env, "/api/published-resumes")).json()) as typeof publicFeed;
      expect(publicFeed.resumes.some((item) => item.id === first.resume.id)).toBe(false);
      expect((await call(env, `/api/published-resumes/${first.resume.id}`)).status).toBe(404);
      expect((await call(env, `/api/admin/resumes/${first.resume.id}/download`)).status).toBe(200);

      expect(
        (await call(env, `/api/admin/resumes/${first.resume.id}`, { method: "DELETE" })).status,
      ).toBe(200);
      expect(await bucket.get(`private-admin/resumes/files/${first.resume.id}`)).toBeNull();
      const afterDelete = (await (
        await call(env, "/api/published-resumes")
      ).json()) as typeof publicFeed;
      expect(afterDelete.resumes.some((item) => item.id === first.resume.id)).toBe(false);
      const redactedHistory = await call(env, `/api/admin/resumes/history?profileId=${profileId}`);
      const entries = (
        (await redactedHistory.json()) as {
          entries: Array<{ resumeId: string; displayName: string }>;
        }
      ).entries;
      expect(entries.find((entry) => entry.resumeId === first.resume.id)?.displayName).toBe(
        "[deleted resume]",
      );
    },
  );
});
