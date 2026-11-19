import { createHash, generateKeyPairSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const integrity = path.join(root, "scripts", "artifact-integrity.mjs");
const verifier = path.join(root, "scripts", "customer-release-verifier.mjs");
const signer = path.join(root, "scripts", "policy-signature.mjs");
const tempDirs: string[] = [];

function run(script: string, args: string[], ok = true, cwd = root) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      PROJECT_NAME: "portfolio-customer-test",
      REQUIRE_BUILD_PROVENANCE: "false",
      // Keep failure reports out of the repository working tree.
      CUSTOMER_RELEASE_REPORT_PATH: path.join(cwd, "customer-release-report.json"),
    },
  });
  if (ok) expect(result.status, result.stderr || result.stdout).toBe(0);
  else expect(result.status, "Expected command to fail.").not.toBe(0);
  return result;
}

/** Package a directory exactly like CI: a gzip tarball of the directory contents. */
function packDirectory(source: string, archive: string) {
  // Relative paths keep GNU tar on Windows from parsing "C:" as a remote host.
  const result = spawnSync(
    "tar",
    ["-czf", path.basename(archive), "-C", path.relative(path.dirname(archive), source), "."],
    {
      cwd: path.dirname(archive),
      encoding: "utf8",
    },
  );
  expect(result.status, result.stderr).toBe(0);
}

/**
 * Create a release whose manifest inventory describes `manifestContent`,
 * while the delivered archive contains `archiveContent`.
 */
function createRelease(manifestContent: string, archiveContent = manifestContent) {
  const temp = mkdtempSync(path.join(os.tmpdir(), "portfolio-customer-release-"));
  tempDirs.push(temp);
  const dist = path.join(temp, "dist");
  mkdirSync(dist);
  const artifact = path.join(temp, "portfolio.tar.gz");
  writeFileSync(path.join(dist, "index.html"), archiveContent);
  packDirectory(dist, artifact);
  writeFileSync(path.join(dist, "index.html"), manifestContent);
  const manifest = path.join(temp, "manifest.json");
  const policy = path.join(temp, "manifest-ignore.json");
  const policySum = path.join(temp, "manifest-ignore.json.sha256");
  run(integrity, ["create", dist, manifest, artifact]);
  run(verifier, ["create", manifest, artifact, policy]);
  run(integrity, ["hash", policy, policySum]);
  const trusted = createHash("sha256").update(readFileSync(policy)).digest("hex");
  return { temp, artifact, manifest, policy, policySum, trusted };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("customer release verifier", { timeout: 30_000 }, () => {
  // Spawns ~12 node/tar subprocesses; the default 5 s is too tight on a loaded machine.
  it("checks manifest-ignore, manifest, and package archive in order", () => {
    const release = createRelease("<main>release</main>");
    const { temp, artifact, manifest, policy, policySum, trusted } = release;
    const verify = (extra: string[], ok = true) =>
      run(verifier, ["verify", policy, policySum, manifest, artifact, ...extra], ok, temp);

    const success = verify([trusted]);
    expect(success.stdout).toMatch(/Stage 1 PASSED:[\s\S]*Stage 2 PASSED:[\s\S]*Stage 3 PASSED/);

    // A swapped package is rejected before its contents are trusted.
    const original = readFileSync(artifact);
    writeFileSync(artifact, Buffer.concat([original, Buffer.from("tampered")]));
    expect(verify([trusted], false).stderr).toContain(
      "Package SHA-256 does not match policy and manifest",
    );
    writeFileSync(artifact, original);

    // Signed manifest-ignore policies are accepted with a trusted Ed25519 key.
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const privatePath = path.join(temp, "policy-private.pem");
    const publicPath = path.join(temp, "policy-public.pem");
    const signaturePath = path.join(temp, "manifest-ignore.sig");
    writeFileSync(privatePath, privateKey.export({ type: "pkcs8", format: "pem" }));
    writeFileSync(publicPath, publicKey.export({ type: "spki", format: "pem" }));
    run(signer, ["sign", policy, signaturePath, privatePath]);
    const signedGood = verify(["-", signaturePath, publicPath]);
    expect(signedGood.stdout).toMatch(/Stage 1 PASSED:[\s\S]*Stage 2 PASSED:[\s\S]*Stage 3 PASSED/);

    // Any change to a signed policy invalidates the signature even if its checksum is regenerated.
    const originalPolicy = readFileSync(policy);
    writeFileSync(policy, Buffer.concat([originalPolicy, Buffer.from(" ")]));
    rmSync(policySum, { force: true });
    run(integrity, ["hash", policy, policySum]);
    expect(verify(["-", signaturePath, publicPath], false).stderr).toContain(
      "Ed25519 signature verification failed",
    );
    writeFileSync(policy, originalPolicy);
    rmSync(policySum, { force: true });
    run(integrity, ["hash", policy, policySum]);

    expect(verify(["0".repeat(64)], false).stderr).toContain("trusted-digest verification failed");
  });

  it("rejects an archive whose contents differ from the authenticated manifest inventory", () => {
    const { temp, artifact, manifest, policy, policySum, trusted } = createRelease(
      "<main>release</main>",
      "<main>tampered</main>",
    );
    const result = run(
      verifier,
      ["verify", policy, policySum, manifest, artifact, trusted],
      false,
      temp,
    );
    expect(result.stderr).toContain("Package archive inventory failed");
    expect(result.stderr).toContain("MISMATCH: index.html");
    const report = JSON.parse(
      readFileSync(path.join(temp, "customer-release-report.json"), "utf8"),
    );
    expect(report).toMatchObject({
      status: "FAILED",
      stage: "PACKAGE_ARCHIVE_VERIFICATION",
      code: "ARCHIVE_INVENTORY_MISMATCH",
    });
  });
});
