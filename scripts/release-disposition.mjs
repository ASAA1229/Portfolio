#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const HASH = /^[a-f0-9]{64}$/;
const REQUIRED_FILES = [
  'artifact',
  'manifest',
  'checksum',
  'sbom',
  'manifestIgnorePolicy',
  'manifestIgnorePolicyChecksum',
];

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function fail(message) {
  throw new Error(message);
}

function safeReason(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000 ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) {
    fail(`${label} must be a non-empty string of at most 2,000 safe characters.`);
  }
  return value.trim();
}

function parseChecksum(text, expectedName, expectedHash, label) {
  const match = text.trim().match(/^([a-f0-9]{64})\s+\*?(.+)$/);
  if (!match || match[1] !== expectedHash || match[2] !== expectedName) {
    fail(`${label} SHA-256 sidecar does not match its file.`);
  }
}

function releaseIdentity(manifest) {
  const identity = [
    manifest.project,
    manifest.ci?.repository || 'UNKNOWN',
    manifest.ci?.branch || 'UNKNOWN',
    manifest.source?.gitCommit || 'UNKNOWN',
    manifest.source?.buildNumber || 'LOCAL',
  ];
  return createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}

async function regularFile(root, descriptor, label) {
  if (!descriptor || typeof descriptor !== 'object' ||
      typeof descriptor.name !== 'string' || !descriptor.name ||
      path.basename(descriptor.name) !== descriptor.name ||
      !Number.isSafeInteger(descriptor.size) || descriptor.size < 0 ||
      typeof descriptor.sha256 !== 'string' || !HASH.test(descriptor.sha256)) {
    fail(`Release index contains an invalid ${label} descriptor.`);
  }

  const file = path.resolve(root, descriptor.name);
  if (path.dirname(file) !== path.resolve(root)) {
    fail(`Release evidence path escapes the release root: ${descriptor.name}`);
  }
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== descriptor.size) {
    fail(`Release evidence is missing, not a regular file, or has an unexpected size: ${descriptor.name}`);
  }
  const actualHash = await sha256(file);
  if (actualHash !== descriptor.sha256) {
    fail(`Release evidence SHA-256 mismatch: ${descriptor.name}`);
  }
  return { path: descriptor.name, size: stat.size, sha256: actualHash };
}

async function verifyRelease(indexPath, rootPath) {
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  if (!index || typeof index !== 'object' || Array.isArray(index) ||
      index.schemaVersion !== 1 || !index.project || !index.source || !index.ci ||
      !index.files || typeof index.files !== 'object' || Array.isArray(index.files)) {
    fail('Release index schema or provenance metadata is invalid.');
  }
  const root = path.resolve(rootPath);
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    fail('Release root must be an existing, non-symlink directory.');
  }

  const evidence = {};
  const usedNames = new Set();
  for (const key of REQUIRED_FILES) {
    const descriptor = index.files[key];
    if (usedNames.has(descriptor?.name)) fail('Release index reuses an evidence filename.');
    const verified = await regularFile(root, descriptor, key);
    usedNames.add(descriptor.name);
    evidence[key] = verified;
  }

  const manifest = JSON.parse(await readFile(path.join(root, evidence.manifest.path), 'utf8'));
  if (!manifest || manifest.project !== index.project ||
      JSON.stringify(manifest.source) !== JSON.stringify(index.source) ||
      JSON.stringify(manifest.ci) !== JSON.stringify(index.ci) ||
      !manifest.artifact ||
      manifest.artifact.name !== evidence.artifact.path ||
      manifest.artifact.size !== evidence.artifact.size ||
      manifest.artifact.sha256 !== evidence.artifact.sha256) {
    fail('Release manifest provenance or artifact metadata does not match the release index.');
  }

  parseChecksum(
    await readFile(path.join(root, evidence.checksum.path), 'utf8'),
    evidence.artifact.path,
    evidence.artifact.sha256,
    'Artifact',
  );
  parseChecksum(
    await readFile(path.join(root, evidence.manifestIgnorePolicyChecksum.path), 'utf8'),
    evidence.manifestIgnorePolicy.path,
    evidence.manifestIgnorePolicy.sha256,
    'Manifest-ignore policy',
  );

  const identity = releaseIdentity(manifest);
  if ((manifest.releaseIdentity !== undefined && manifest.releaseIdentity !== identity) ||
      (index.releaseIdentity !== undefined && index.releaseIdentity !== null && index.releaseIdentity !== identity)) {
    fail('Manifest release identity does not match its provenance.');
  }
  return {
    index,
    project: manifest.project,
    releaseIdentity: identity,
    source: manifest.source,
    ci: manifest.ci,
    artifact: evidence.artifact,
    evidence,
  };
}

async function writeRecord(recordsDir, record) {
  await mkdir(recordsDir, { recursive: true });
  const filename = `${record.createdAt.replace(/[:.]/g, '-')}-${record.event.toLowerCase()}-${record.releaseIdentity.slice(0, 12)}.json`;
  const destination = path.join(path.resolve(recordsDir), filename);
  await writeFile(destination, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(`Disposition record created: ${destination}`);
}

async function quarantine([indexPath, rootPath, reasonArg, operatorArg, recordsDir]) {
  if (![indexPath, rootPath, reasonArg, operatorArg, recordsDir].every(Boolean)) {
    fail('Usage: node scripts/release-disposition.mjs quarantine <release-index.json> <release-root> <reason> <operator> <records-dir>');
  }
  const verified = await verifyRelease(indexPath, rootPath);
  const record = {
    schemaVersion: 1,
    event: 'QUARANTINED',
    createdAt: new Date().toISOString(),
    operator: safeReason(operatorArg, 'Operator'),
    reason: safeReason(reasonArg, 'Reason'),
    project: verified.project,
    releaseIdentity: verified.releaseIdentity,
    source: verified.source,
    ci: verified.ci,
    artifact: verified.artifact,
    evidence: verified.evidence,
    controls: {
      promotionAllowed: false,
      deploymentAllowed: false,
      nexusPublicationAllowed: false,
      artifactMoved: false,
    },
    nextAction: 'Investigate the recorded reason. A separate owner-approved recovery decision is required.',
  };
  await writeRecord(recordsDir, record);
}

async function recover([quarantinePath, knownGoodIndexPath, knownGoodRoot, reasonArg, operatorArg, recordsDir]) {
  if (![quarantinePath, knownGoodIndexPath, knownGoodRoot, reasonArg, operatorArg, recordsDir].every(Boolean)) {
    fail('Usage: node scripts/release-disposition.mjs recover <quarantine-record.json> <known-good-release-index.json> <known-good-release-root> <reason> <operator> <records-dir>');
  }
  const quarantineRecord = JSON.parse(await readFile(quarantinePath, 'utf8'));
  if (!quarantineRecord || quarantineRecord.schemaVersion !== 1 ||
      quarantineRecord.event !== 'QUARANTINED' ||
      !HASH.test(quarantineRecord.releaseIdentity || '') ||
      quarantineRecord.controls?.promotionAllowed !== false ||
      quarantineRecord.controls?.deploymentAllowed !== false ||
      quarantineRecord.controls?.nexusPublicationAllowed !== false) {
    fail('The supplied quarantine record is invalid or does not represent a blocked release.');
  }

  const knownGood = await verifyRelease(knownGoodIndexPath, knownGoodRoot);
  if (knownGood.project !== quarantineRecord.project) {
    fail('Recovery target must belong to the same project as the quarantined release.');
  }
  if (knownGood.releaseIdentity === quarantineRecord.releaseIdentity) {
    fail('Recovery target must be a different release identity.');
  }

  const record = {
    schemaVersion: 1,
    event: 'RECOVERY_RECORDED',
    createdAt: new Date().toISOString(),
    operator: safeReason(operatorArg, 'Operator'),
    reason: safeReason(reasonArg, 'Recovery reason'),
    project: knownGood.project,
    quarantinedReleaseIdentity: quarantineRecord.releaseIdentity,
    knownGoodReleaseIdentity: knownGood.releaseIdentity,
    knownGoodArtifact: knownGood.artifact,
    quarantineRecordSha256: await sha256(quarantinePath),
    controls: {
      deploymentPerformed: false,
      productionBranchChanged: false,
      nexusPublicationPerformed: false,
      ownerApprovalRequired: true,
    },
    nextAction: 'Obtain explicit owner approval, then follow the documented manual rollback procedure. This record does not perform rollback or deployment.',
  };
  await writeRecord(recordsDir, record);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'quarantine') return quarantine(args);
  if (command === 'recover') return recover(args);
  fail('Commands: quarantine, recover');
}

main().catch((error) => {
  console.error(`Release disposition error: ${error.message}`);
  process.exitCode = 1;
});
