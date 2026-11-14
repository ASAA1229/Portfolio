import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const disposition = path.join(root, "scripts", "release-disposition.mjs");
const releaseIndex = path.join(root, "scripts", "release-index.mjs");
const temps: string[] = [];

const sha = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");

function run(script: string, args: string[]) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
}

/** A minimal but fully consistent release: artifact, manifest, checksums, SBOM, policy, index. */
function createRelease(buildNumber = "7") {
  const dir = mkdtempSync(path.join(os.tmpdir(), "portfolio-disposition-"));
  temps.push(dir);
  const artifact = Buffer.from(`release-${buildNumber}`);
  writeFileSync(path.join(dir, "portfolio.tar.gz"), artifact);
  writeFileSync(path.join(dir, "portfolio.tar.gz.sha256"), `${sha(artifact)}  portfolio.tar.gz\n`);
  const manifest = {
    project: "portfolio",
    createdAt: new Date().toISOString(),
    source: { gitCommit: "a".repeat(40), buildNumber },
    ci: {
      provider: "github-actions",
      repository: "owner/portfolio",
      branch: "new",
      workflow: "ci",
      runId: buildNumber,
      runUrl: `https://github.com/owner/portfolio/actions/runs/${buildNumber}`,
    },
    artifact: { name: "portfolio.tar.gz", size: artifact.length, sha256: sha(artifact) },
  };
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest));
  writeFileSync(path.join(dir, "sbom.json"), JSON.stringify({ bomFormat: "CycloneDX" }));
  const policy = JSON.stringify({ purpose: "manifest-ignore" });
  writeFileSync(path.join(dir, "manifest-ignore.json"), policy);
  writeFileSync(
    path.join(dir, "manifest-ignore.json.sha256"),
    `${sha(policy)}  manifest-ignore.json\n`,
  );
  const index = path.join(dir, "..", `${path.basename(dir)}-index.json`);
  temps.push(index);
  const created = run(releaseIndex, [
    ...[
      "portfolio.tar.gz",
      "manifest.json",
      "portfolio.tar.gz.sha256",
      "sbom.json",
      "manifest-ignore.json",
      "manifest-ignore.json.sha256",
    ].map((name) => path.join(dir, name)),
    index,
  ]);
  expect(created.status, created.stderr).toBe(0);
  return { dir, index };
}

afterEach(() => {
  for (const item of temps.splice(0)) rmSync(item, { recursive: true, force: true });
});

describe("release promotion gate", { timeout: 30_000 }, () => {
  it("requires staging before production and an exact-release approval at the gate", () => {
    const { dir, index } = createRelease();
    const records = path.join(dir, "records");

    expect(run(disposition, ["gate", index, dir, "staging", records]).status).not.toBe(0);
    expect(
      run(disposition, ["approve", index, dir, "production", "OWNER-1", "ops", records]).stderr,
    ).toContain("prior staging approval");

    const staged = run(disposition, ["approve", index, dir, "staging", "OWNER-1", "ops", records]);
    expect(staged.status, staged.stderr).toBe(0);
    const gate = run(disposition, ["gate", index, dir, "staging", records]);
    expect(gate.status, gate.stderr).toBe(0);
    expect(gate.stdout).toContain("Promotion gate PASSED for staging");
    expect(run(disposition, ["gate", index, dir, "production", records]).status).not.toBe(0);

    const record = JSON.parse(
      readFileSync(path.join(records, readdirSync(records)[0]!), "utf8"),
    ) as Record<string, unknown>;
    expect(record).toMatchObject({
      event: "PROMOTION_APPROVED",
      environment: "staging",
      controls: { deploymentPerformed: false, nexusPublicationPerformed: false },
    });
  });

  it("blocks quarantined releases and tampered artifacts", () => {
    const { dir, index } = createRelease();
    const records = path.join(dir, "records");
    expect(
      run(disposition, ["approve", index, dir, "staging", "OWNER-1", "ops", records]).status,
    ).toBe(0);
    const quarantined = run(disposition, ["quarantine", index, dir, "bad smoke", "ops", records]);
    expect(quarantined.status, quarantined.stderr).toBe(0);
    expect(run(disposition, ["gate", index, dir, "staging", records]).stderr).toContain(
      "quarantined",
    );

    const fresh = createRelease("8");
    const freshRecords = path.join(fresh.dir, "records");
    expect(
      run(disposition, [
        "approve",
        fresh.index,
        fresh.dir,
        "staging",
        "OWNER-2",
        "ops",
        freshRecords,
      ]).status,
    ).toBe(0);
    writeFileSync(path.join(fresh.dir, "portfolio.tar.gz"), "swapped");
    expect(
      run(disposition, ["gate", fresh.index, fresh.dir, "staging", freshRecords]).status,
    ).not.toBe(0);
  });
});
