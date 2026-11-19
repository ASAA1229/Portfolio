// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import server from "@/server";
import { createLocalDiskBucket } from "@/lib/local-disk-bucket";

/**
 * Single real-filesystem pass through the Admin image lifecycle. The four-profile lifecycle and
 * failure-path suites run on an in-memory R2 model so they do not depend on disk speed; this one
 * test keeps the disk adapter wired end to end (one profile, deliberately small).
 */
const ORIGIN = "http://localhost";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const directory = mkdtempSync(path.join(os.tmpdir(), "portfolio-disk-smoke-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

const env = {
  ENVIRONMENT: "development",
  PORTFOLIO_ADMIN_AUTH_BYPASS: "true",
  RESUME_BUCKET: createLocalDiskBucket(directory),
};

function call(pathname: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== "GET") headers.set("origin", ORIGIN);
  return server.fetch(new Request(ORIGIN + pathname, { ...init, headers }), env, {});
}

describe("disk-backed storage smoke test", () => {
  it("uploads, publishes, serves, unpublishes and deletes an image on the real filesystem", async () => {
    const form = new FormData();
    form.set("profileId", "sai");
    form.set("alt", "disk smoke");
    form.set("slot", "gallery");
    form.set("publishOnUpload", "true");
    form.set("file", new File([PNG], "smoke.png", { type: "image/png" }));
    const uploaded = await call("/api/admin/images", { method: "POST", body: form });
    expect(uploaded.status).toBe(201);
    const { image } = (await uploaded.json()) as { image: { id: string } };
    const served = await call(`/api/published-images/${image.id}`);
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG);
    expect((await call(`/api/admin/images/${image.id}/unpublish`, { method: "POST" })).status).toBe(
      200,
    );
    expect((await call(`/api/published-images/${image.id}`)).status).toBe(404);
    expect((await call(`/api/admin/images/${image.id}`, { method: "DELETE" })).status).toBe(200);
  }, 60_000);
});
