#!/usr/bin/env node
/**
 * Validates the Cloudflare Workers deployment configuration WITHOUT credentials or network access to
 * Cloudflare: `wrangler deploy --dry-run` against the generated production config. It never logs in,
 * deploys or touches R2/KV.
 *
 * Usage: node scripts/cf-dry-run.mjs [r2|no-r2]
 *   r2     (default) full mode: the RESUME_BUCKET R2 binding is declared (Admin storage, resumes, images,
 *          versioning). R2 may require a payment method on file even on the free plan.
 *   no-r2  DEGRADED free mode, no R2 binding: the four public profiles serve from the build; the Admin
 *          reports "Private content storage is unavailable" (HTTP 503) instead of pretending to save.
 *          Content changes then need a rebuild. Use only if R2 cannot be enabled.
 * Run `npm run build` first (the default build is the Cloudflare preset).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const mode = process.argv[2] ?? "r2";
if (!["r2", "no-r2"].includes(mode)) {
  console.error("Usage: node scripts/cf-dry-run.mjs [r2|no-r2]");
  process.exit(2);
}
const serverDir = path.resolve(".output", "server");
const generated = path.join(serverDir, "wrangler.json");
if (!existsSync(generated)) {
  console.error(
    "Missing .output/server/wrangler.json. Run `npm run build` (Cloudflare preset) first.",
  );
  process.exit(1);
}
const config = JSON.parse(readFileSync(generated, "utf8"));
if (mode === "no-r2") {
  delete config.r2_buckets;
  console.log("MODE no-r2: DEGRADED (no R2 binding): public site only, Admin storage unavailable.");
} else {
  const bound = (config.r2_buckets ?? []).some((b) => b.binding === "RESUME_BUCKET");
  if (!bound) {
    console.error("Generated config has no RESUME_BUCKET R2 binding; check wrangler.jsonc.");
    process.exit(1);
  }
  console.log("MODE r2: full (R2 binding RESUME_BUCKET declared).");
}
const configFile = path.join(serverDir, `wrangler.dryrun-${mode}.json`);
writeFileSync(configFile, JSON.stringify(config, null, 2));
const outdir = path.join(os.tmpdir(), `portfolio-wrangler-dry-${mode}`);
mkdirSync(outdir, { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    path.resolve("node_modules", "wrangler", "bin", "wrangler.js"),
    "deploy",
    "--dry-run",
    "--config",
    configFile,
    "--outdir",
    outdir,
  ],
  { stdio: "inherit", env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "true" } },
);
process.exit(result.status ?? 1);
