#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ALGORITHM = "sha256";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");

function getSourceCommit() {
  return process.env.GIT_COMMIT || process.env.GIT_COMMIT_SHA || process.env.GITHUB_SHA || "";
}

function getBuildNumber() {
  return process.env.BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER || "";
}

function getCiBranch() {
  const branch =
    process.env.BUILD_BRANCH || process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "";
  return branch.replace(/^refs\/heads\//, "").replace(/^origin\//, "");
}

function releaseIdentityFor(manifest) {
  const identity = [
    manifest.project,
    manifest.ci?.repository || "UNKNOWN",
    manifest.ci?.branch || "UNKNOWN",
    manifest.source?.gitCommit || "UNKNOWN",
    manifest.source?.buildNumber || "LOCAL",
  ];
  return createHash(ALGORITHM).update(JSON.stringify(identity)).digest("hex");
}

function verifyReleaseIdentity(manifest, required = false) {
  if (manifest.releaseIdentity === undefined && !required) return;
  if (
    typeof manifest.releaseIdentity !== "string" ||
    !/^[a-f0-9]{64}$/.test(manifest.releaseIdentity) ||
    manifest.releaseIdentity !== releaseIdentityFor(manifest)
  ) {
    throw new Error(
      "Artifact release identity is missing, invalid, or inconsistent with its provenance.",
    );
  }
}

function validateBuildProvenance(manifest, compareContext = false) {
  const project = manifest.project;
  const source = manifest.source;
  const ci = manifest.ci;
  const commit = source?.gitCommit;
  if (
    typeof project !== "string" ||
    !project.trim() ||
    project === "unnamed-project" ||
    project !== project.trim() ||
    /[\x00-\x1f\x7f]/.test(project)
  ) {
    throw new Error("Release provenance requires a valid, explicit project identifier.");
  }
  if (!ci || !["github-actions", "jenkins"].includes(ci.provider)) {
    throw new Error("Release provenance requires a recognized CI provider.");
  }
  const buildNumber = source?.buildNumber;
  const repository = ci?.repository;
  const branch = ci?.branch;
  const requiredCiFields = ["workflow", "runId", "runUrl"];

  if (
    typeof commit !== "string" ||
    !/^[a-f0-9]{40,64}$/i.test(commit) ||
    typeof buildNumber !== "string" ||
    !/^[1-9]\d*$/.test(buildNumber)
  ) {
    throw new Error(
      "Release provenance requires a full Git commit SHA and a positive numeric build number.",
    );
  }
  if (
    typeof repository !== "string" ||
    !repository.trim() ||
    repository === "UNKNOWN" ||
    /[\s\x00-\x1f\x7f]/.test(repository)
  ) {
    throw new Error("Release provenance requires a valid repository identifier.");
  }
  if (
    typeof branch !== "string" ||
    !branch.trim() ||
    branch === "UNKNOWN" ||
    branch.startsWith("refs/heads/") ||
    branch.startsWith("origin/") ||
    /[\s\x00-\x1f\x7f]/.test(branch)
  ) {
    throw new Error("Release provenance requires a normalized, valid branch identifier.");
  }
  for (const key of requiredCiFields) {
    const value = ci?.[key];
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value === "UNKNOWN" ||
      /[\x00-\x1f\x7f]/.test(value)
    ) {
      throw new Error(`Release provenance requires valid CI ${key} metadata.`);
    }
  }
  let runUrl;
  try {
    runUrl = new URL(ci.runUrl);
  } catch {
    throw new Error("Release provenance requires a valid CI run URL.");
  }
  if (!["http:", "https:"].includes(runUrl.protocol)) {
    throw new Error("Release provenance CI run URL must use HTTP or HTTPS.");
  }

  if (compareContext) {
    const expectedProject = process.env.PROJECT_NAME || "";
    const expectedProvider =
      process.env.GITHUB_ACTIONS === "true"
        ? "github-actions"
        : process.env.JENKINS_URL
          ? "jenkins"
          : "";
    const expectedRepository = process.env.BUILD_REPOSITORY || process.env.GITHUB_REPOSITORY || "";
    const expectedBranch = getCiBranch();
    const expectedCommit = getSourceCommit();
    const expectedBuild = getBuildNumber();
    if (
      (expectedProject && project !== expectedProject) ||
      (expectedProvider && ci.provider !== expectedProvider) ||
      (expectedRepository && repository !== expectedRepository) ||
      (expectedBranch && branch !== expectedBranch) ||
      !/^[a-f0-9]{40,64}$/i.test(expectedCommit) ||
      commit.toLowerCase() !== expectedCommit.toLowerCase() ||
      !/^[1-9]\d*$/.test(expectedBuild) ||
      buildNumber !== expectedBuild
    ) {
      throw new Error("Release manifest provenance does not match this build context.");
    }
  }
}

function usage() {
  console.error(
    "Usage:\n" +
      "  node scripts/artifact-integrity.mjs create <directory> <manifest.json> [artifact.tar.gz]\n" +
      "  node scripts/artifact-integrity.mjs verify <directory> <manifest.json> [artifact.tar.gz]\n" +
      "  node scripts/artifact-integrity.mjs hash <file> <checksum-file>\n" +
      "  node scripts/artifact-integrity.mjs verify-hash <file> <checksum-file>\n" +
      "  node scripts/artifact-integrity.mjs verify-release <artifact.tar.gz> <manifest.json> <checksum-file>",
  );
  process.exit(2);
}

async function hashFile(filePath) {
  const hash = createHash(ALGORITHM);
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function inventory(directory) {
  const base = path.resolve(directory);
  const files = [];

  async function walk(current, relative = "") {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      const rel = path.posix.join(relative, entry.name);
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) {
        throw new Error(`Symbolic links are not allowed in release artifacts: ${rel}`);
      }
      if (stat.isDirectory()) {
        await walk(absolute, rel);
      } else if (stat.isFile()) {
        files.push({
          path: rel,
          size: stat.size,
          sha256: await hashFile(absolute),
        });
      } else {
        throw new Error(`Unsupported filesystem entry in release artifact: ${rel}`);
      }
    }
  }

  const stat = await lstat(base);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Artifact target must be a real directory.");
  }
  await walk(base);
  return files.sort((a, b) => a.path.localeCompare(b.path, "en"));
}

function safeManifestPath(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes(String.fromCharCode(0)) ||
    path.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    /^[a-zA-Z]:/.test(value)
  ) {
    throw new Error("Manifest contains an invalid relative file path.");
  }
  const normalized = value.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    segments.some(
      (segment) => !segment || segment === "." || segment === ".." || /^[a-zA-Z]:$/.test(segment),
    )
  ) {
    throw new Error(`Manifest contains an unsafe path: ${value}`);
  }
  return normalized;
}

function validateManifestStructure(manifest, requireArtifact = false) {
  const invalid = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Artifact manifest must be a JSON object.");
  }
  if (manifest.schemaVersion !== 1) invalid.push("schemaVersion");
  if (manifest.algorithm !== "SHA256") invalid.push("algorithm");
  if (!Array.isArray(manifest.files)) invalid.push("files");
  if (!Number.isSafeInteger(manifest.fileCount) || manifest.fileCount < 0) {
    invalid.push("fileCount");
  } else if (Array.isArray(manifest.files) && manifest.fileCount !== manifest.files.length) {
    invalid.push("fileCount/files.length");
  }
  if (
    typeof manifest.project !== "string" ||
    !manifest.project.trim() ||
    manifest.project !== manifest.project.trim() ||
    /[\\x00-\\x1f\\x7f]/.test(manifest.project)
  ) {
    invalid.push("project");
  }
  if (!manifest.source || typeof manifest.source !== "object" || Array.isArray(manifest.source)) {
    invalid.push("source");
  } else {
    if (typeof manifest.source.gitCommit !== "string") {
      invalid.push("source.gitCommit");
    }
    if (typeof manifest.source.buildNumber !== "string") {
      invalid.push("source.buildNumber");
    }
  }
  if (typeof manifest.createdAt !== "string" || Number.isNaN(Date.parse(manifest.createdAt))) {
    invalid.push("createdAt");
  }
  if (invalid.length) {
    throw new Error(
      "Unsupported or invalid artifact manifest metadata: " + invalid.join(", ") + ".",
    );
  }

  if (
    manifest.ci !== undefined &&
    (!manifest.ci ||
      typeof manifest.ci !== "object" ||
      Array.isArray(manifest.ci) ||
      ["provider", "repository", "branch", "workflow", "runId", "runUrl"].some(
        (key) => typeof manifest.ci[key] !== "string",
      ))
  ) {
    throw new Error("Artifact manifest contains invalid CI provenance metadata.");
  }

  if (requireArtifact || manifest.artifact !== undefined) {
    const artifact = manifest.artifact;
    if (
      !artifact ||
      typeof artifact !== "object" ||
      Array.isArray(artifact) ||
      typeof artifact.name !== "string" ||
      !artifact.name ||
      path.basename(artifact.name) !== artifact.name ||
      !Number.isSafeInteger(artifact.size) ||
      artifact.size < 0 ||
      typeof artifact.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(artifact.sha256)
    ) {
      throw new Error("Manifest contains invalid packaged-artifact metadata.");
    }
  }
}

function validateFileInventory(files) {
  const expected = new Map();
  for (const entry of files) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Manifest contains an invalid file entry.");
    }
    const rel = safeManifestPath(entry.path);
    if (
      rel !== entry.path ||
      expected.has(rel) ||
      !Number.isSafeInteger(entry.size) ||
      entry.size < 0 ||
      typeof entry.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(entry.sha256)
    ) {
      throw new Error(`Invalid, non-canonical, or duplicate manifest entry: ${rel}`);
    }
    expected.set(rel, entry);
  }
  return expected;
}

// Run tar from the archive's directory with a bare file name: GNU tar treats a
// drive-letter path such as C:/release.tar.gz as a remote host:file archive.
function runTar(archivePath, args, onStdout) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "tar",
      [...args.slice(0, 1), path.basename(archivePath), ...args.slice(1)],
      {
        cwd: path.dirname(archivePath),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stderr = "";
    let outputError = null;
    child.stdout.on("data", (chunk) => {
      if (outputError) return;
      try {
        onStdout(chunk);
      } catch (error) {
        outputError = error;
        child.kill();
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 16_384) stderr = stderr.slice(-16_384);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (outputError) reject(outputError);
      else if (code === 0) resolve();
      else
        reject(
          new Error(
            "Unable to inspect release archive with tar (exit " + code + "): " + stderr.trim(),
          ),
        );
    });
  });
}

function normalizeArchiveMember(rawName) {
  if (rawName === "./" || rawName === ".") return null;
  let name = rawName.replaceAll(String.fromCharCode(92), "/");
  const isDirectory = name.endsWith("/");
  if (isDirectory) name = name.slice(0, -1);
  while (name.startsWith("./")) name = name.slice(2);
  if (!name) return null;
  const normalized = safeManifestPath(name);
  if (normalized !== name)
    throw new Error("Non-canonical archive member path rejected: " + rawName);
  return isDirectory ? null : normalized;
}

async function archiveMemberDigest(archivePath, memberPath) {
  const hash = createHash(ALGORITHM);
  let size = 0;
  await runTar(archivePath, ["-xOzf", "--", "./" + memberPath], (chunk) => {
    size += chunk.length;
    if (!Number.isSafeInteger(size)) throw new Error("Archive member is too large: " + memberPath);
    hash.update(chunk);
  });
  return { size, sha256: hash.digest("hex") };
}

async function verifyArchiveInventory(archivePath, expected) {
  let listing = "";
  let verboseListing = "";
  const listingLimit = 64 * 1024 * 1024;
  await runTar(archivePath, ["-tzf"], (chunk) => {
    listing += chunk.toString("utf8");
    if (listing.length > listingLimit)
      throw new Error("Archive member listing exceeds the 64 MiB safety limit.");
  });
  await runTar(archivePath, ["-tvzf"], (chunk) => {
    verboseListing += chunk.toString("utf8");
    if (verboseListing.length > listingLimit)
      throw new Error("Verbose archive listing exceeds the 64 MiB safety limit.");
  });

  const verboseLines = verboseListing.split(/\r?\n/).filter(Boolean);
  const archived = new Map();
  const problems = [];
  for (const rawName of listing.split(/\r?\n/)) {
    if (!rawName) continue;
    const member = normalizeArchiveMember(rawName);
    if (!member) continue;
    if (archived.has(member)) {
      problems.push("ARCHIVE DUPLICATE: " + member);
      continue;
    }
    const metadata = verboseLines.find((line) => line.endsWith(rawName));
    if (!metadata || !metadata.length) {
      problems.push("ARCHIVE TYPE UNKNOWN: " + member + " (could not read verbose tar metadata)");
    } else if (metadata[0] !== "-") {
      problems.push(
        "ARCHIVE TYPE REJECTED: " +
          member +
          " (only regular files are permitted; type=" +
          metadata[0] +
          ")",
      );
    }
    archived.set(member, rawName);
  }

  for (const [member, entry] of expected) {
    if (!archived.has(member)) {
      problems.push("ARCHIVE MISSING: " + member);
      continue;
    }
    try {
      const actual = await archiveMemberDigest(archivePath, member);
      if (actual.size !== entry.size) {
        problems.push(
          "ARCHIVE SIZE MISMATCH: " +
            member +
            " (expected=" +
            entry.size +
            ", actual=" +
            actual.size +
            ")",
        );
      }
      if (actual.sha256 !== entry.sha256) {
        problems.push(
          "ARCHIVE SHA256 MISMATCH: " +
            member +
            " (expected=" +
            entry.sha256 +
            ", actual=" +
            actual.sha256 +
            ")",
        );
      }
    } catch (error) {
      problems.push("ARCHIVE UNREADABLE: " + member + " (" + error.message + ")");
    }
    archived.delete(member);
  }
  for (const member of archived.keys()) problems.push("ARCHIVE UNEXPECTED: " + member);

  if (problems.length) {
    console.error(
      "Release archive inventory verification FAILED (" + problems.length + " issue(s)):",
    );
    for (const problem of problems) console.error(" - " + problem);
    throw new Error("Release archive contents or entry types do not match the manifest inventory.");
  }
  console.log(
    "Release archive inventory verification PASSED: " +
      expected.size +
      " regular file(s) verified.",
  );
}
async function createManifest(directory, manifestPath, artifactPath) {
  const sourceCommit = getSourceCommit();
  const buildNumber = getBuildNumber();
  if (
    process.env.REQUIRE_BUILD_PROVENANCE === "true" &&
    (!/^[a-f0-9]{40,64}$/i.test(sourceCommit) || !buildNumber.trim())
  ) {
    throw new Error("Release provenance requires a full Git commit SHA and build number.");
  }
  const target = path.resolve(directory);
  const output = path.resolve(manifestPath);
  if (output === target || output.startsWith(target + path.sep)) {
    throw new Error(
      "Store the manifest outside the artifact directory to avoid self-referencing hashes.",
    );
  }

  const files = await inventory(target);
  const manifest = {
    schemaVersion: 1,
    project: process.env.PROJECT_NAME || "unnamed-project",
    algorithm: ALGORITHM.toUpperCase(),
    source: {
      gitCommit: getSourceCommit() || "UNKNOWN",
      buildNumber: getBuildNumber() || "LOCAL",
    },
    ci: {
      provider:
        process.env.GITHUB_ACTIONS === "true"
          ? "github-actions"
          : process.env.JENKINS_URL
            ? "jenkins"
            : "local",
      repository: process.env.BUILD_REPOSITORY || process.env.GITHUB_REPOSITORY || "UNKNOWN",
      branch: getCiBranch() || "UNKNOWN",
      workflow: process.env.BUILD_WORKFLOW || process.env.GITHUB_WORKFLOW || "UNKNOWN",
      runId: process.env.BUILD_RUN_ID || process.env.GITHUB_RUN_ID || "UNKNOWN",
      runUrl:
        process.env.BUILD_RUN_URL ||
        (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
          ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
          : "UNKNOWN"),
    },
    createdAt: new Date().toISOString(),
    fileCount: files.length,
    files,
  };

  if (process.env.REQUIRE_BUILD_PROVENANCE === "true") validateBuildProvenance(manifest);

  manifest.releaseIdentity = releaseIdentityFor(manifest);

  if (artifactPath) {
    const artifact = path.resolve(artifactPath);
    const stat = await lstat(artifact);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error("Packaged artifact must be a regular file.");
    }
    manifest.artifact = {
      name: path.basename(artifact),
      size: stat.size,
      sha256: await hashFile(artifact),
    };
  }

  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  console.log(`Manifest created: ${output} (${files.length} files)`);
}

async function verifyManifest(directory, manifestPath, artifactPath) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  validateManifestStructure(manifest);
  verifyReleaseIdentity(manifest, process.env.REQUIRE_BUILD_PROVENANCE === "true");
  if (process.env.REQUIRE_BUILD_PROVENANCE === "true") validateBuildProvenance(manifest, true);
  if (
    process.env.REQUIRE_BUILD_PROVENANCE === "true" &&
    (!manifest.ci ||
      ["repository", "branch", "workflow", "runId", "runUrl"].some(
        (key) =>
          typeof manifest.ci[key] !== "string" ||
          !manifest.ci[key].trim() ||
          manifest.ci[key] === "UNKNOWN",
      ))
  ) {
    throw new Error("Artifact manifest is missing complete CI run provenance.");
  }

  if (
    process.env.REQUIRE_BUILD_PROVENANCE === "true" &&
    (!/^[a-f0-9]{40,64}$/i.test(manifest.source.gitCommit) ||
      !manifest.source.buildNumber.trim() ||
      manifest.source.gitCommit === "UNKNOWN" ||
      manifest.source.buildNumber === "LOCAL")
  ) {
    throw new Error("Artifact manifest is missing trustworthy build provenance.");
  }

  if (process.env.REQUIRE_BUILD_PROVENANCE === "true") {
    const expectedCommit = getSourceCommit();
    const expectedBuild = getBuildNumber();
    if (
      !/^[a-f0-9]{40,64}$/i.test(expectedCommit) ||
      !expectedBuild.trim() ||
      manifest.source.gitCommit.toLowerCase() !== expectedCommit.toLowerCase() ||
      manifest.source.buildNumber !== expectedBuild
    ) {
      throw new Error("Artifact manifest provenance does not match this build context.");
    }
  }

  const expected = validateFileInventory(manifest.files);

  const actualFiles = await inventory(directory);
  const actual = new Map(actualFiles.map((entry) => [entry.path, entry]));
  const problems = [];

  for (const [rel, entry] of expected) {
    const found = actual.get(rel);
    if (!found) problems.push(`MISSING: ${rel}`);
    else if (found.size !== entry.size || found.sha256 !== entry.sha256)
      problems.push(`MISMATCH: ${rel}`);
  }
  for (const rel of actual.keys()) {
    if (!expected.has(rel)) problems.push(`UNEXPECTED: ${rel}`);
  }

  if (manifest.fileCount !== expected.size)
    problems.push("Manifest fileCount does not match its inventory.");
  if (artifactPath) {
    if (!manifest.artifact) {
      problems.push("Manifest has no packaged-artifact metadata.");
    } else {
      const artifact = path.resolve(artifactPath);
      try {
        const stat = await lstat(artifact);
        if (!stat.isFile() || stat.isSymbolicLink()) {
          problems.push("Packaged artifact is not a regular file.");
        } else if (
          path.basename(artifact) !== manifest.artifact.name ||
          stat.size !== manifest.artifact.size ||
          (await hashFile(artifact)) !== manifest.artifact.sha256
        ) {
          problems.push("Packaged artifact name, checksum, or size mismatch.");
        }
      } catch {
        problems.push("Packaged artifact is missing.");
      }
    }
  }

  if (problems.length) {
    console.error("Artifact verification FAILED:");
    for (const problem of problems) console.error(` - ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Artifact verification PASSED: ${actualFiles.length} files verified.`);
}
async function writeHash(filePath, checksumPath) {
  const file = path.resolve(filePath);
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error("Hash target must be a regular file.");
  const digest = await hashFile(file);
  await writeFile(checksumPath, `${digest}  ${path.basename(file)}\n`, { flag: "wx" });
  console.log(`SHA-256 written: ${checksumPath}`);
}

async function verifyHash(filePath, checksumPath) {
  const file = path.resolve(filePath);
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error("Hash target must be a regular file.");
  const content = (await readFile(checksumPath, "utf8")).trim();
  const match = content.match(/^([a-f0-9]{64})\s+\*?(.+)$/);
  if (!match || match[2] !== path.basename(file) || match[1] !== (await hashFile(file))) {
    throw new Error("SHA-256 verification failed.");
  }
  console.log(`SHA-256 verification PASSED: ${path.basename(file)}`);
}

async function verifyRelease(artifactPath, manifestPath, checksumPath) {
  const artifact = path.resolve(artifactPath);
  const stat = await lstat(artifact);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error("Release artifact must be a regular file.");

  // Validate manifest structure and inventory metadata before hashing the package.
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  validateManifestStructure(manifest, true);
  validateFileInventory(manifest.files);

  const expectedProject = process.env.PROJECT_NAME;
  if (expectedProject && manifest.project !== expectedProject) {
    throw new Error(
      `Release manifest project mismatch: expected ${expectedProject}, found ${manifest.project}.`,
    );
  }

  verifyReleaseIdentity(manifest, process.env.REQUIRE_BUILD_PROVENANCE === "true");
  if (process.env.REQUIRE_BUILD_PROVENANCE === "true") validateBuildProvenance(manifest, true);
  if (
    process.env.REQUIRE_BUILD_PROVENANCE === "true" &&
    (!manifest.ci ||
      ["repository", "branch", "workflow", "runId", "runUrl"].some(
        (key) =>
          typeof manifest.ci[key] !== "string" ||
          !manifest.ci[key].trim() ||
          manifest.ci[key] === "UNKNOWN",
      ))
  ) {
    throw new Error("Release manifest is missing complete CI run provenance.");
  }
  if (process.env.REQUIRE_BUILD_PROVENANCE === "true") {
    const expectedCommit = getSourceCommit();
    const expectedBuild = getBuildNumber();
    if (
      !/^[a-f0-9]{40,64}$/i.test(manifest.source.gitCommit) ||
      !manifest.source.buildNumber.trim() ||
      manifest.source.gitCommit === "UNKNOWN" ||
      manifest.source.buildNumber === "LOCAL" ||
      !/^[a-f0-9]{40,64}$/i.test(expectedCommit) ||
      !expectedBuild.trim() ||
      manifest.source.gitCommit.toLowerCase() !== expectedCommit.toLowerCase() ||
      manifest.source.buildNumber !== expectedBuild
    ) {
      throw new Error(
        "Release manifest provenance is missing or does not match this build context.",
      );
    }
  }

  const checksumContent = (await readFile(checksumPath, "utf8")).trim();
  const checksumMatch = checksumContent.match(/^([a-f0-9]{64})\s+\*?(.+)$/);
  const actualHash = await hashFile(artifact);
  if (
    !checksumMatch ||
    checksumMatch[2] !== path.basename(artifact) ||
    checksumMatch[1] !== actualHash
  ) {
    throw new Error("Release artifact SHA-256 sidecar verification failed.");
  }
  if (
    manifest.artifact.name !== path.basename(artifact) ||
    manifest.artifact.size !== stat.size ||
    manifest.artifact.sha256 !== actualHash
  ) {
    throw new Error("Release artifact does not match the manifest name, size, and SHA-256.");
  }

  await verifyArchiveInventory(artifact, validateFileInventory(manifest.files));

  console.log(
    `Release bundle verification PASSED: project=${manifest.project}; build=${manifest.source.buildNumber}; commit=${manifest.source.gitCommit}; artifact=${manifest.artifact.name}; size=${stat.size}; sha256=${actualHash}.`,
  );
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "create" && args.length >= 2 && args.length <= 3) {
    await createManifest(args[0], args[1], args[2]);
  } else if (command === "verify" && args.length >= 2 && args.length <= 3) {
    await verifyManifest(args[0], args[1], args[2]);
  } else if (command === "hash" && args.length === 2) {
    await writeHash(args[0], args[1]);
  } else if (command === "verify-hash" && args.length === 2) {
    await verifyHash(args[0], args[1]);
  } else if (command === "verify-release" && args.length === 3) {
    await verifyRelease(args[0], args[1], args[2]);
  } else {
    usage();
  }
}

main().catch((error) => {
  console.error(`Artifact integrity error: ${error.message}`);
  process.exitCode = 1;
});
