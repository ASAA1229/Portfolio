#!/usr/bin/env node
/**
 * Local release rehearsal: build the Cloudflare/Worker artifact and run the same integrity and
 * provenance verification CI performs (scripts/artifact-integrity.mjs and customer-release-verifier.mjs).
 *
 * Usage: node scripts/release-local.mjs [outputDir]
 *
 * It never deploys, publishes or touches any hosted resource. Provenance fields are filled from git and
 * labelled as a local simulation (workflow "local-release-rehearsal"); a real release must come from CI
 * with CI-supplied provenance. Output goes to a temporary directory (default: the OS temp dir), never
 * into the repository.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const outDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : mkdtempSync(path.join(os.tmpdir(), "portfolio-release-"));
mkdirSync(outDir, { recursive: true });

const git = (...args) => spawnSync("git", args, { encoding: "utf8" }).stdout.trim();
const sha = git("rev-parse", "HEAD");
if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("Could not read the full git commit SHA.");
const dirty = git("status", "--porcelain").length > 0;

const env = {
  ...process.env,
  GITHUB_ACTIONS: "true", // selects the GitHub provenance provider; values below mark it as a rehearsal
  PROJECT_NAME: "portfolio",
  GIT_COMMIT: sha,
  BUILD_NUMBER: String(Date.now()),
  BUILD_REPOSITORY: "ASAA1229/Portfolio",
  GITHUB_REPOSITORY: "ASAA1229/Portfolio",
  BUILD_BRANCH: git("rev-parse", "--abbrev-ref", "HEAD") || "new",
  BUILD_WORKFLOW: "local-release-rehearsal",
  BUILD_RUN_ID: "local",
  BUILD_RUN_URL: "https://example.invalid/local-release-rehearsal",
  REQUIRE_BUILD_PROVENANCE: "true",
  CUSTOMER_RELEASE_REPORT_PATH: path.join(outDir, "customer-release-report.json"),
};

function run(label, command, args) {
  console.log(`\n== ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32" && command === "npm",
  });
  if (result.status !== 0) {
    console.error(`FAILED: ${label}`);
    process.exit(result.status ?? 1);
  }
}

const node = process.execPath;
const archive = path.join(outDir, "portfolio-build.tar.gz");
const manifest = path.join(outDir, "portfolio-manifest.json");
const checksum = path.join(outDir, "portfolio-build.tar.gz.sha256");
const policy = path.join(outDir, "portfolio-manifest-ignore.json");
const policyHash = path.join(outDir, "portfolio-manifest-ignore.json.sha256");

// Remove any earlier build output so the artifact contains exactly this commit's build.
rmSync(path.join(root, ".output"), { recursive: true, force: true });
run("Production build (Cloudflare preset)", "npm", ["run", "build"]);
run("Bundle budget", "npm", ["run", "check:budget"]);
run("Package .output", "tar", ["-czf", archive, "-C", ".output", "."]);
const integrity = path.join("scripts", "artifact-integrity.mjs");
const verifier = path.join("scripts", "customer-release-verifier.mjs");
run("Create manifest", node, [integrity, "create", ".output", manifest, archive]);
run("Verify manifest against the build directory", node, [
  integrity,
  "verify",
  ".output",
  manifest,
  archive,
]);
run("Archive checksum", node, [integrity, "hash", archive, checksum]);
run("Verify archive checksum", node, [integrity, "verify-hash", archive, checksum]);
run("Create customer policy", node, [verifier, "create", manifest, archive, policy]);
run("Policy checksum", node, [integrity, "hash", policy, policyHash]);
const trusted = readFileSync(policyHash, "utf8").split(" ")[0].trim();
run("Customer verification (authenticity, manifest, archive contents)", node, [
  verifier,
  "verify",
  policy,
  policyHash,
  manifest,
  archive,
  trusted,
]);

console.log(
  `\nRelease rehearsal PASSED for ${sha}${dirty ? " (working tree has uncommitted changes)" : ""}`,
);
console.log(`Artifacts: ${outDir}`);
