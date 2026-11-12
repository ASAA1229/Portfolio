// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import server from "@/server";
import { createLocalDiskBucket } from "@/lib/local-disk-bucket";

const PNG = "image/png";
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const origin = "http://localhost";
const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Storage proxy that persists an index write and then reports an ambiguous failure. */
function failingImageBucket() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "portfolio-image-failure-"));
  temps.push(dir);
  const disk = createLocalDiskBucket(dir);
  const state = { failIndexAfterWrite: false };
  const bucket = new Proxy(disk, {
    get(target, property) {
      if (property === "put") {
        return async (key: string, ...rest: unknown[]) => {
          const result = await (target.put as (...args: unknown[]) => Promise<unknown>)(
            key,
            ...rest,
          );
          if (state.failIndexAfterWrite && key === "private-admin/images/index.json") {
            state.failIndexAfterWrite = false;
            throw new Error("simulated ambiguous image-index write failure");
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

function call(env: unknown, pathname: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== "GET") headers.set("origin", origin);
  return server.fetch(new Request(origin + pathname, { ...init, headers }), env, {});
}

async function uploadImage(
  env: unknown,
  publishOnUpload = false,
): Promise<{ id: string }> {
  const form = new FormData();
  form.set("profileId", "ammu");
  form.set("alt", "Ammu profile image");
  form.set("slot", "portrait");
  form.set("publishOnUpload", String(publishOnUpload));
  form.set("file", new File([PNG_BYTES], "ammu.png", { type: PNG }), "ammu.png");
  const uploaded = await call(env, "/api/admin/images", { method: "POST", body: form });
  expect(uploaded.status).toBe(201);
  const { image } = (await uploaded.json()) as { image: { id: string } };
  return { id: image.id };
}

function testEnv(bucket: ReturnType<typeof failingImageBucket>["bucket"]) {
  return {
    ENVIRONMENT: "development",
    PORTFOLIO_ADMIN_AUTH_BYPASS: "true",
    RESUME_BUCKET: bucket,
  };
}

describe("image lifecycle compensation", () => {
  it("reverts an ambiguous index write during publish", async () => {
    const { bucket, state } = failingImageBucket();
    const env = testEnv(bucket);
    const { id } = await uploadImage(env);
    state.failIndexAfterWrite = true;

    const response = await call(env, `/api/admin/images/${id}/publish`, { method: "POST" });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      code: "IMAGE_STORAGE_COMMIT_FAILED",
      restored: true,
    });

    const index = await (await bucket.get("private-admin/images/index.json"))!.json<
      Array<{ id: string; status: string }>
    >();
    expect(index.find((item) => item.id === id)?.status).toBe("pending");
    expect(await bucket.get(`public/profile-images/${id}`)).toBeNull();
  });

  it("restores the public copy and approved index after an ambiguous unpublish write", async () => {
    const { bucket, state } = failingImageBucket();
    const env = testEnv(bucket);
    const { id } = await uploadImage(env, true);
    const publicBefore = new Uint8Array(
      await (await bucket.get(`public/profile-images/${id}`))!.arrayBuffer(),
    );
    state.failIndexAfterWrite = true;

    const response = await call(env, `/api/admin/images/${id}/unpublish`, { method: "POST" });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      code: "IMAGE_STORAGE_COMMIT_FAILED",
      restored: true,
    });

    const index = await (await bucket.get("private-admin/images/index.json"))!.json<
      Array<{ id: string; status: string }>
    >();
    expect(index.find((item) => item.id === id)?.status).toBe("approved");
    const publicAfter = new Uint8Array(
      await (await bucket.get(`public/profile-images/${id}`))!.arrayBuffer(),
    );
    expect([...publicAfter]).toEqual([...publicBefore]);
  });

  it("restores both private and public originals when delete cannot commit its index", async () => {
    const { bucket, state } = failingImageBucket();
    const env = testEnv(bucket);
    const { id } = await uploadImage(env, true);
    state.failIndexAfterWrite = true;

    const response = await call(env, `/api/admin/images/${id}`, { method: "DELETE" });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      code: "IMAGE_STORAGE_COMMIT_FAILED",
      restored: true,
    });

    const index = await (await bucket.get("private-admin/images/index.json"))!.json<
      Array<{ id: string; status: string }>
    >();
    expect(index.find((item) => item.id === id)?.status).toBe("approved");
    expect(await bucket.get(`private-admin/images/files/${id}`)).not.toBeNull();
    expect(await bucket.get(`public/profile-images/${id}`)).not.toBeNull();
  });
  it("removes partially stored upload binaries when the index write fails ambiguously", async () => {
    const { bucket, state } = failingImageBucket();
    const env = testEnv(bucket);
    const form = new FormData();
    form.set("profileId", "sai");
    form.set("alt", "Sai gallery image");
    form.set("slot", "gallery");
    form.set("publishOnUpload", "true");
    form.set("file", new File([PNG_BYTES], "sai.png", { type: PNG }), "sai.png");
    state.failIndexAfterWrite = true;

    const response = await call(env, "/api/admin/images", { method: "POST", body: form });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      code: "IMAGE_UPLOAD_STORAGE_FAILED",
      restored: true,
    });
    expect(await bucket.get("private-admin/images/index.json")).toBeNull();
    expect(await bucket.list("private-admin/images/files/")).toEqual([]);
    expect(await bucket.list("public/profile-images/")).toEqual([]);
  });

  it("restores previous image binaries and metadata when replacement index persistence fails", async () => {
    const { bucket, state } = failingImageBucket();
    const env = testEnv(bucket);
    const { id } = await uploadImage(env, true);
    const originalPrivate = new Uint8Array(
      await (await bucket.get(`private-admin/images/files/${id}`))!.arrayBuffer(),
    );
    const originalPublic = new Uint8Array(
      await (await bucket.get(`public/profile-images/${id}`))!.arrayBuffer(),
    );
    const form = new FormData();
    const replacementBytes = new Uint8Array([...PNG_BYTES, 0x01]);
    form.set(
      "file",
      new File([replacementBytes], "replacement.png", { type: PNG }),
      "replacement.png",
    );
    state.failIndexAfterWrite = true;

    const response = await call(env, `/api/admin/images/${id}/replace`, {
      method: "POST",
      body: form,
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      code: "IMAGE_STORAGE_COMMIT_FAILED",
      restored: true,
    });

    const privateAfter = new Uint8Array(
      await (await bucket.get(`private-admin/images/files/${id}`))!.arrayBuffer(),
    );
    const publicAfter = new Uint8Array(
      await (await bucket.get(`public/profile-images/${id}`))!.arrayBuffer(),
    );
    expect([...privateAfter]).toEqual([...originalPrivate]);
    expect([...publicAfter]).toEqual([...originalPublic]);
    expect(await bucket.list(`private-admin/images/superseded/${id}/`)).toEqual([]);
    const index = await (await bucket.get("private-admin/images/index.json"))!.json<
      Array<{ id: string; filename: string }>
    >();
    expect(index.find((item) => item.id === id)?.filename).toBe("ammu.png");
  });
});
