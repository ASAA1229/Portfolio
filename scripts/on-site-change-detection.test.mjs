import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { collectInventory, compareInventories } from "./on-site-change-detection.mjs";

const sha = (content) => createHash("sha256").update(content).digest("hex");
const inventory = (files, extra = {}) => ({
  schemaVersion: 1,
  algorithm: "SHA256",
  fileCount: files.length,
  ignoredPaths: [],
  files,
  ...extra,
});

test("inventory hashes files and honors exact directory ignores", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "change-detect-"));
  try {
    await mkdir(path.join(root, "logs"));
    await writeFile(path.join(root, "app.txt"), "release");
    await writeFile(path.join(root, "logs", "run.log"), "ignored");
    const entries = await collectInventory(root, ["logs"]);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].path, "app.txt");
    assert.match(entries[0].sha256, /^[a-f0-9]{64}$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("comparison classifies modified, missing, unexpected and unchanged paths", () => {
  const entry = (name, content) => ({ path: name, size: content.length, sha256: sha(content) });
  const result = compareInventories(
    inventory([entry("same", "a"), entry("edit", "b"), entry("gone", "c")], {
      createdAt: "baseline",
    }),
    inventory([entry("same", "a"), entry("edit", "x"), entry("new", "d")], {
      scannedAt: "current",
    }),
  );
  assert.deepEqual(result.summary, {
    unchanged: 1,
    modified: 1,
    missing: 1,
    unexpected: 1,
    hasChanges: true,
  });
});

test("equivalent ignore policies compare regardless of order", () => {
  const result = compareInventories(
    inventory([], { ignoredPaths: ["logs", "cache"] }),
    inventory([], { ignoredPaths: ["cache", "logs"] }),
  );
  assert.equal(result.summary.hasChanges, false);
});

test("rejects malformed inventories and mismatched ignore policies", () => {
  const good = { path: "app.txt", size: 1, sha256: sha("a") };
  assert.throws(
    () => compareInventories(inventory([{ ...good, path: "../escape" }]), inventory([])),
    /Unsafe relative path/,
  );
  assert.throws(
    () => compareInventories(inventory([{ ...good, path: "C:/escape" }]), inventory([])),
    /Unsafe relative path/,
  );
  assert.throws(
    () => compareInventories(inventory([good, good]), inventory([])),
    /Invalid or duplicate file entry/,
  );
  assert.throws(
    () => compareInventories(inventory([{ ...good, sha256: "a" }]), inventory([])),
    /Invalid or duplicate file entry/,
  );
  assert.throws(
    () => compareInventories({ ...inventory([good]), fileCount: 2 }, inventory([])),
    /schema or file count/,
  );
  assert.throws(
    () => compareInventories(inventory([], { ignoredPaths: ["logs"] }), inventory([])),
    /different ignored-path policies/,
  );
});
