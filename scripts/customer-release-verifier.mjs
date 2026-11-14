#!/usr/bin/env node
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { createReadStream } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);

const hash = async (file) => {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(file)) h.update(chunk);
  return h.digest("hex");
};
let activeStage = "INPUT_VALIDATION";
const fail = (message, code) => {
  const error = new Error(message);
  error.stage = activeStage;
  if (code) error.code = code;
  throw error;
};

function validateReleaseManifest(manifest) {
  if (
    !manifest ||
    typeof manifest !== "object" ||
    Array.isArray(manifest) ||
    manifest.schemaVersion !== 1 ||
    manifest.algorithm !== "SHA256" ||
    typeof manifest.project !== "string" ||
    !manifest.project.trim() ||
    !manifest.source ||
    typeof manifest.source !== "object" ||
    Array.isArray(manifest.source) ||
    typeof manifest.source.gitCommit !== "string" ||
    !manifest.source.gitCommit.trim() ||
    typeof manifest.source.buildNumber !== "string" ||
    !manifest.source.buildNumber.trim() ||
    typeof manifest.createdAt !== "string" ||
    !Number.isFinite(Date.parse(manifest.createdAt)) ||
    !Array.isArray(manifest.files) ||
    !Number.isSafeInteger(manifest.fileCount) ||
    manifest.fileCount < 0 ||
    manifest.fileCount !== manifest.files.length ||
    !manifest.artifact ||
    typeof manifest.artifact !== "object" ||
    Array.isArray(manifest.artifact)
  ) {
    fail("Invalid release manifest metadata or inventory count.");
  }

  const artifact = manifest.artifact;
  if (
    typeof artifact.name !== "string" ||
    !artifact.name.trim() ||
    path.basename(artifact.name) !== artifact.name ||
    path.win32.basename(artifact.name) !== artifact.name ||
    !Number.isSafeInteger(artifact.size) ||
    artifact.size < 0 ||
    typeof artifact.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(artifact.sha256)
  ) {
    fail("Invalid packaged-artifact metadata in release manifest.");
  }

  const entries = new Map();
  for (const entry of manifest.files) {
    const normalizedPath = typeof entry?.path === "string" ? entry.path.replaceAll("\\", "/") : "";
    const segments = normalizedPath.split("/");
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      !normalizedPath ||
      path.isAbsolute(normalizedPath) ||
      path.win32.isAbsolute(normalizedPath) ||
      normalizedPath.includes(String.fromCharCode(0)) ||
      /[\x01-\x1f\x7f]/.test(normalizedPath) ||
      segments.some((part) => !part || part === "." || part === ".." || /^[a-zA-Z]:/.test(part)) ||
      entries.has(normalizedPath) ||
      !Number.isSafeInteger(entry.size) ||
      entry.size < 0 ||
      typeof entry.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(entry.sha256)
    ) {
      fail("Invalid, unsafe or duplicate manifest inventory entry.");
    }
    entries.set(normalizedPath, { size: entry.size, sha256: entry.sha256 });
  }
  if (
    manifest.releaseIdentity !== undefined &&
    (typeof manifest.releaseIdentity !== "string" ||
      !/^[a-f0-9]{64}$/.test(manifest.releaseIdentity))
  ) {
    fail("Invalid release identity in manifest.");
  }
  return entries;
}

async function inventory(root) {
  const out = [];
  async function walk(dir, prefix = "") {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const e of entries) {
      const abs = path.join(dir, e.name),
        rel = path.posix.join(prefix, e.name),
        st = await lstat(abs);
      if (st.isSymbolicLink()) fail(`Symbolic link not allowed: ${rel}`);
      if (st.isDirectory()) await walk(abs, rel);
      else if (st.isFile()) out.push({ path: rel, size: st.size, sha256: await hash(abs) });
      else fail(`Unsupported package entry: ${rel}`);
    }
  }
  const st = await lstat(root);
  if (!st.isDirectory() || st.isSymbolicLink()) fail("Extracted package must be a real directory.");
  await walk(root);
  return out.sort((a, b) => a.path.localeCompare(b.path, "en"));
}

async function extractVerifiedArchive(archivePath) {
  const stat = await lstat(archivePath);
  if (!stat.isFile() || stat.isSymbolicLink()) fail("Package archive must be a regular file.");

  // Run tar from the archive's directory with a bare file name: GNU tar treats a
  // drive-letter path such as C:/release.tar.gz as a remote host:file archive.
  const tarOptions = {
    cwd: path.dirname(archivePath),
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  };
  const archiveName = path.basename(archivePath);
  let names, details;
  try {
    [{ stdout: names }, { stdout: details }] = await Promise.all([
      execFileAsync("tar", ["-tzf", archiveName], tarOptions),
      execFileAsync("tar", ["-tvzf", archiveName], tarOptions),
    ]);
  } catch {
    fail("Package archive could not be listed safely by the system tar utility.");
  }

  const nameLines = names.split(/\r?\n/).filter(Boolean);
  const detailLines = details.split(/\r?\n/).filter(Boolean);
  if (!nameLines.length || nameLines.length !== detailLines.length) {
    fail("Package archive has an empty or ambiguous member listing.");
  }

  const seen = new Set();
  for (let index = 0; index < nameLines.length; index += 1) {
    const rawName = nameLines[index];
    const detail = detailLines[index];
    if (
      /[\x00-\x1f\x7f]/.test(rawName) ||
      rawName.includes("\\") ||
      !detail ||
      !["-", "d"].includes(detail[0])
    ) {
      fail("Package archive contains an unsupported entry type or control character.");
    }
    let normalized = rawName.replaceAll("\\", "/");
    while (normalized.startsWith("./")) normalized = normalized.slice(2);
    if (normalized === "" || normalized === "/") continue;
    const isDirectory = normalized.endsWith("/");
    if (isDirectory) normalized = normalized.slice(0, -1);
    const segments = normalized.split("/");
    if (
      !normalized ||
      normalized.startsWith("/") ||
      path.posix.isAbsolute(normalized) ||
      path.win32.isAbsolute(normalized) ||
      segments.some((part) => !part || part === "." || part === ".." || /^[a-zA-Z]:/.test(part))
    ) {
      fail("Package archive contains an unsafe member path.");
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) fail("Package archive contains duplicate or case-colliding member paths.");
    seen.add(key);
    if (!isDirectory && detail[0] !== "-") fail("Package archive contains a non-regular file.");
  }

  // Extract beside the archive and pass a relative directory: GNU tar on Windows
  // misparses drive-letter paths given to -C.
  const destination = await mkdtemp(path.join(tarOptions.cwd, ".portfolio-release-"));
  try {
    await execFileAsync(
      "tar",
      [
        "-xzf",
        archiveName,
        "-C",
        path.basename(destination),
        "--no-same-owner",
        "--no-same-permissions",
      ],
      tarOptions,
    );
    return { destination, cleanup: () => rm(destination, { recursive: true, force: true }) };
  } catch {
    await rm(destination, { recursive: true, force: true });
    fail("Package archive extraction failed after member validation.");
  }
}

async function createPolicy(manifestPath, artifactPath, policyPath) {
  activeStage = "POLICY_CREATION";
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  validateReleaseManifest(manifest);
  const st = await lstat(artifactPath);
  if (!st.isFile() || st.isSymbolicLink())
    fail("Cannot create manifest-ignore policy from an invalid package artifact.");
  const artifactHash = await hash(artifactPath);
  if (
    path.basename(artifactPath) !== manifest.artifact.name ||
    st.size !== manifest.artifact.size ||
    artifactHash !== manifest.artifact.sha256
  ) {
    fail("Package artifact does not match the release manifest; policy was not created.");
  }
  const policy = {
    schemaVersion: 1,
    algorithm: "SHA256",
    purpose: "manifest-ignore",
    project: manifest.project,
    source: manifest.source,
    releaseIdentity: manifest.releaseIdentity,
    manifest: { name: path.basename(manifestPath), sha256: await hash(manifestPath) },
    artifact: { name: path.basename(artifactPath), size: st.size, sha256: artifactHash },
  };
  await writeFile(policyPath, JSON.stringify(policy, null, 2) + "\n", { flag: "wx" });
  console.log(
    "Manifest-ignore created. Hash it with artifact-integrity.mjs and distribute that trusted digest separately.",
  );
}

async function verify(
  policyPath,
  policySumPath,
  manifestPath,
  artifactPath,
  trustedHash,
  signaturePath,
  publicKeyPath,
) {
  // 1.
  activeStage = "POLICY_AUTHENTICATION"; // Authenticate the policy before parsing it. Use a trusted digest or an independently trusted Ed25519 public key.
  const trusted = String(trustedHash || "")
    .trim()
    .toLowerCase();
  const signedMode = Boolean(signaturePath || publicKeyPath);
  if (Boolean(signaturePath) !== Boolean(publicKeyPath))
    fail("Both policy signature and trusted public-key paths are required.");
  if (!signedMode && !/^[a-f0-9]{64}$/.test(trusted))
    fail("Trusted manifest-ignore SHA-256 is required unless a signature is supplied.");
  if (signedMode && trusted !== "-" && !/^[a-f0-9]{64}$/.test(trusted))
    fail("Trusted digest must be 64 hex characters or - when signature verification is enabled.");
  const pst = await lstat(policyPath);
  if (!pst.isFile() || pst.isSymbolicLink()) fail("Manifest-ignore must be a regular file.");
  const actualPolicyHash = await hash(policyPath);
  const sum = (await readFile(policySumPath, "utf8")).trim().match(/^([a-f0-9]{64})\s+\*?(.+)$/);
  if (
    !sum ||
    sum[1] !== actualPolicyHash ||
    sum[2] !== path.basename(policyPath) ||
    (trusted !== "-" && actualPolicyHash !== trusted)
  ) {
    fail("Manifest-ignore checksum/trusted-digest verification failed.");
  }
  if (signedMode) {
    const sigStat = await lstat(signaturePath),
      keyStat = await lstat(publicKeyPath);
    if (
      !sigStat.isFile() ||
      sigStat.isSymbolicLink() ||
      !keyStat.isFile() ||
      keyStat.isSymbolicLink()
    )
      fail("Signature and public key must be regular files.");
    const key = createPublicKey(await readFile(publicKeyPath, "utf8"));
    if (key.asymmetricKeyType !== "ed25519") fail("Trusted policy public key must be Ed25519.");
    const signature = Buffer.from((await readFile(signaturePath, "utf8")).trim(), "base64");
    if (
      signature.length !== 64 ||
      !verifySignature(null, await readFile(policyPath), key, signature)
    )
      fail("Manifest-ignore Ed25519 signature verification failed.");
  }
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  if (
    policy.schemaVersion !== 1 ||
    policy.algorithm !== "SHA256" ||
    policy.purpose !== "manifest-ignore" ||
    typeof policy.project !== "string" ||
    !policy.project.trim() ||
    !policy.source ||
    typeof policy.source !== "object" ||
    Array.isArray(policy.source) ||
    typeof policy.source.gitCommit !== "string" ||
    typeof policy.source.buildNumber !== "string" ||
    !policy.manifest ||
    typeof policy.manifest.name !== "string" ||
    path.basename(policy.manifest.name) !== policy.manifest.name ||
    typeof policy.manifest.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(policy.manifest.sha256) ||
    !policy.artifact ||
    typeof policy.artifact.name !== "string" ||
    path.basename(policy.artifact.name) !== policy.artifact.name ||
    !Number.isSafeInteger(policy.artifact.size) ||
    policy.artifact.size < 0 ||
    typeof policy.artifact.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(policy.artifact.sha256)
  ) {
    fail("Invalid manifest-ignore metadata.");
  }
  console.log("Stage 1 PASSED: manifest-ignore verified.");

  // 2. Check manifest bytes against the verified policy before trusting its inventory.
  activeStage = "MANIFEST_VALIDATION";
  if (
    path.basename(manifestPath) !== policy.manifest.name ||
    (await hash(manifestPath)) !== policy.manifest.sha256
  ) {
    fail("Manifest checksum/name mismatch.");
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const expected = validateReleaseManifest(manifest);
  if (
    manifest.project !== policy.project ||
    manifest.source.gitCommit !== policy.source.gitCommit ||
    manifest.source.buildNumber !== policy.source.buildNumber
  ) {
    fail("Release manifest project or source provenance does not match the authenticated policy.");
  }
  if (policy.releaseIdentity !== undefined || manifest.releaseIdentity !== undefined) {
    if (
      typeof policy.releaseIdentity !== "string" ||
      !/^[a-f0-9]{64}$/.test(policy.releaseIdentity) ||
      policy.releaseIdentity !== manifest.releaseIdentity
    ) {
      fail("Release identity does not match the authenticated manifest-ignore policy.");
    }
  }
  console.log("Stage 2 PASSED: manifest and release identity verified.");

  // 3. Verify package bytes, then every file in the authenticated archive.
  activeStage = "PACKAGE_ARCHIVE_VERIFICATION";
  const ast = await lstat(artifactPath);
  if (
    !ast.isFile() ||
    ast.isSymbolicLink() ||
    path.basename(artifactPath) !== policy.artifact.name ||
    ast.size !== policy.artifact.size ||
    (await hash(artifactPath)) !== policy.artifact.sha256 ||
    manifest.artifact.name !== policy.artifact.name ||
    manifest.artifact.size !== policy.artifact.size ||
    manifest.artifact.sha256 !== policy.artifact.sha256
  )
    fail("Package SHA-256 does not match policy and manifest.");

  const extracted = await extractVerifiedArchive(artifactPath);
  try {
    const actualEntries = await inventory(extracted.destination);
    const actual = new Map(actualEntries.map((entry) => [entry.path, entry]));
    const errors = [];
    for (const [name, entry] of expected) {
      const got = actual.get(name);
      if (!got) errors.push("MISSING: " + name);
      else if (got.size !== entry.size || got.sha256 !== entry.sha256)
        errors.push("MISMATCH: " + name);
    }
    for (const name of actual.keys()) if (!expected.has(name)) errors.push("UNEXPECTED: " + name);
    if (errors.length || manifest.fileCount !== expected.size) {
      const preview = errors.slice(0, 50);
      const omitted = errors.length - preview.length;
      const detail =
        preview.join("; ") +
        (omitted > 0 ? `; ... ${omitted} additional discrepancy(s) omitted` : "");
      fail(
        `Package archive inventory failed (${errors.length} discrepancies): ${detail}`,
        "ARCHIVE_INVENTORY_MISMATCH",
      );
    }
    console.log(
      `Stage 3 PASSED: archive SHA-256 and ${actualEntries.length} archive files verified.`,
    );
  } finally {
    await extracted.cleanup();
  }
}

async function main() {
  const [cmd, ...a] = process.argv.slice(2);
  if (cmd === "create" && a.length === 3) return createPolicy(...a);
  if (cmd === "verify" && (a.length === 5 || a.length === 7)) return verify(...a);
  console.error(
    "Usage: customer-release-verifier.mjs create <manifest> <artifact> <manifest-ignore.json>\n" +
      "       customer-release-verifier.mjs verify <manifest-ignore.json> <manifest-ignore.sha256> <manifest> <artifact.tar.gz> <trusted-policy-sha256|-> [<manifest-ignore.sig> <trusted-public-key.pem>]",
  );
  process.exitCode = 2;
}
main().catch(async (error) => {
  const stage = error.stage || activeStage;
  const report = {
    type: "customer-release-verification",
    status: "FAILED",
    stage,
    code: error.code || `${stage}_FAILED`,
    message: error.message || "Unexpected verification failure.",
  };
  const reportPath =
    process.env.CUSTOMER_RELEASE_REPORT_PATH || path.resolve("customer-release-report.json");
  try {
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
    console.error(`Customer release failure report written to: ${reportPath}`);
  } catch (writeError) {
    console.error("Customer release report file could not be written: " + writeError.message);
  }
  console.error("CUSTOMER_RELEASE_REPORT " + JSON.stringify(report));
  process.exitCode = 1;
});
