#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function describe(file) {
  const absolute = path.resolve(file);
  const stat = await lstat(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Release input must be a regular file: ${file}`);
  }
  return { name: path.basename(absolute), size: stat.size, sha256: await sha256(absolute) };
}

async function main() {
  const [artifactPath, manifestPath, checksumPath, sbomPath, policyPath, policyChecksumPath, outputPath] = process.argv.slice(2);
  if (![artifactPath, manifestPath, checksumPath, sbomPath, policyPath, policyChecksumPath, outputPath].every(Boolean)) {
    throw new Error('Usage: node scripts/release-index.mjs <artifact> <manifest> <checksum> <sbom> <policy> <policy-checksum> <output>');
  }

  const files = {
    artifact: await describe(artifactPath),
    manifest: await describe(manifestPath),
    checksum: await describe(checksumPath),
    sbom: await describe(sbomPath),
    manifestIgnorePolicy: await describe(policyPath),
    manifestIgnorePolicyChecksum: await describe(policyChecksumPath),
  };
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!manifest.artifact || manifest.artifact.name !== files.artifact.name ||
      manifest.artifact.size !== files.artifact.size || manifest.artifact.sha256 !== files.artifact.sha256) {
    throw new Error('Packaged artifact does not match the artifact manifest.');
  }

  const checksum = (await readFile(checksumPath, 'utf8')).trim().match(/^([a-f0-9]{64})\\s+\\*?(.+)$/);
  if (checksumParts.length !== 2 || checksumParts[0] !== files.artifact.sha256 || checksumParts[1] !== files.artifact.name) {
    throw new Error('Artifact SHA-256 sidecar does not match the packaged artifact.');
  }
  const policyChecksum = (await readFile(policyChecksumPath, 'utf8')).trim().match(/^([a-f0-9]{64})\\s+\\*?(.+)$/);
  if (policyChecksumParts.length !== 2 || policyChecksumParts[0] !== files.manifestIgnorePolicy.sha256 ||
      policyChecksumParts[1] !== files.manifestIgnorePolicy.name) {
    throw new Error('Manifest-ignore policy SHA-256 sidecar does not match the policy file.');
  }
  if (!manifest.source || !manifest.ci || !manifest.project) {
    throw new Error('Artifact manifest is missing project or build provenance metadata.');
  }

  const index = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    project: manifest.project,
    source: manifest.source,
    ci: manifest.ci,
    files,
  };
  const output = path.resolve(outputPath);
  const inputPaths = [artifactPath, manifestPath, checksumPath, sbomPath, policyPath, policyChecksumPath]
    .map((file) => path.resolve(file));
  if (inputPaths.includes(output)) {
    throw new Error('Release index output must be a separate file.');
  }
  await writeFile(output, `${JSON.stringify(index, null, 2)}\\n`, { flag: 'wx' });
  console.log(`Release index created: ${output}`);
}

main().catch((error) => {
  console.error(`Release index error: ${error.message}`);
  process.exitCode = 1;
});
