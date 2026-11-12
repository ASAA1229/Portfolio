// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import server from "@/server";
import { createLocalDiskBucket } from "@/lib/local-disk-bucket";

const ORIGIN = "http://localhost";
const PNG = "image/png";
const ORIGINAL = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const REPLACEMENT = new Uint8Array([...ORIGINAL, 0x01]);
const PROFILES = ["abhishek", "ammu", "bava", "sai"] as const;
const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createEnv() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "portfolio-four-profile-images-"));
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

async function uploadImage(
  env: unknown,
  profileId: (typeof PROFILES)[number],
  slot: "portrait" | "gallery" | "project",
  options: { publish?: boolean; projectSlug?: string; bytes?: Uint8Array; filename?: string } = {},
) {
  const form = new FormData();
  form.set("profileId", profileId);
  form.set("alt", `${profileId} ${slot} image`);
  form.set("slot", slot);
  if (slot === "project") form.set("projectSlug", options.projectSlug ?? `project-${profileId}`);
  form.set("publishOnUpload", String(options.publish ?? false));
  form.set(
    "file",
    new File([options.bytes ?? ORIGINAL], options.filename ?? `${profileId}.png`, { type: PNG }),
  );
  const response = await call(env, "/api/admin/images", { method: "POST", body: form });
  expect(response.status).toBe(201);
  return (await response.json()) as { image: { id: string; profileId: string; status: string } };
}

describe("four-profile public image resource lifecycle", () => {
  it.each(PROFILES)(
    "%s supports private upload, publish, replace, restore, unpublish, republish and delete",
    async (profileId) => {
      const { bucket, env } = createEnv();
      const { image } = await uploadImage(env, profileId, "portrait");
      expect(image).toMatchObject({ profileId, status: "pending" });

      const pendingFeed = (await (await call(env, "/api/published-images")).json()) as {
        images: Array<{ id: string }>;
      };
      expect(pendingFeed.images.some((item) => item.id === image.id)).toBe(false);
      expect(
        await (await call(env, `/api/admin/images/${image.id}/file`)).status,
      ).toBe(200);

      expect((await call(env, `/api/admin/images/${image.id}/publish`, { method: "POST" })).status).toBe(200);
      let feed = (await (await call(env, "/api/published-images")).json()) as {
        images: Array<{ id: string; profileId: string; slot: string }>;
      };
      expect(feed.images).toContainEqual(
        expect.objectContaining({ id: image.id, profileId, slot: "portrait" }),
      );
      const publicResponse = await call(env, `/api/published-images/${image.id}`);
      expect(publicResponse.status).toBe(200);
      expect([...new Uint8Array(await publicResponse.arrayBuffer())]).toEqual([...ORIGINAL]);

      const replacement = new FormData();
      replacement.set("file", new File([REPLACEMENT], "replacement.png", { type: PNG }));
      expect(
        (await call(env, `/api/admin/images/${image.id}/replace`, {
          method: "POST",
          body: replacement,
        })).status,
      ).toBe(200);
      const versionsResponse = await call(env, `/api/admin/images/${image.id}/versions`);
      expect(versionsResponse.status).toBe(200);
      const versions = (await versionsResponse.json()) as {
        versions: Array<{ version: string; filename: string }>;
      };
      expect(versions.versions).toHaveLength(1);
      expect(versions.versions[0]?.filename).toBe(`${profileId}.png`);

      const restore = await call(env, `/api/admin/images/${image.id}/restore`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: versions.versions[0]?.version }),
      });
      expect(restore.status).toBe(200);
      expect((await restore.json()).restored).toBe(true);
      const restoredPublic = await call(env, `/api/published-images/${image.id}`);
      expect([...new Uint8Array(await restoredPublic.arrayBuffer())]).toEqual([...ORIGINAL]);

      expect((await call(env, `/api/admin/images/${image.id}/unpublish`, { method: "POST" })).status).toBe(200);
      feed = (await (await call(env, "/api/published-images")).json()) as typeof feed;
      expect(feed.images.some((item) => item.id === image.id)).toBe(false);
      expect((await call(env, `/api/published-images/${image.id}`)).status).toBe(404);
      expect((await call(env, `/api/admin/images/${image.id}/file`)).status).toBe(200);

      expect((await call(env, `/api/admin/images/${image.id}/publish`, { method: "POST" })).status).toBe(200);
      expect((await call(env, `/api/admin/images/${image.id}`, { method: "DELETE" })).status).toBe(200);
      feed = (await (await call(env, "/api/published-images")).json()) as typeof feed;
      expect(feed.images.some((item) => item.id === image.id)).toBe(false);
      expect(await bucket.get(`private-admin/images/files/${image.id}`)).toBeNull();
      expect(await bucket.get(`public/profile-images/${image.id}`)).toBeNull();
    },
  );

  it.each(PROFILES)(
    "%s publishes project media with an exact profile and project assignment",
    async (profileId) => {
      const { env } = createEnv();
      const projectSlug = `project-${profileId}`;
      const { image } = await uploadImage(env, profileId, "project", {
        publish: true,
        projectSlug,
      });
      const feed = (await (await call(env, "/api/published-images")).json()) as {
        images: Array<{ id: string; profileId: string; slot: string; projectSlug?: string }>;
      };
      expect(feed.images).toContainEqual(
        expect.objectContaining({
          id: image.id,
          profileId,
          slot: "project",
          projectSlug,
        }),
      );
    },
  );
});
