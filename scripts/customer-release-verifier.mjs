#!/usr/bin/env node
import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const hash = async (file) => {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(file)) h.update(chunk);
  return h.digest('hex');
};
const fail = (message) => { throw new Error(message); };

function validateReleaseManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) ||
      manifest.schemaVersion !== 1 || manifest.algorithm !== 'SHA256' ||
      typeof manifest.project !== 'string' || !manifest.project.trim() ||
      !manifest.source || typeof manifest.source !== 'object' || Array.isArray(manifest.source) ||
      typeof manifest.source.gitCommit !== 'string' || !manifest.source.gitCommit.trim() ||
      typeof manifest.source.buildNumber !== 'string' || !manifest.source.buildNumber.trim() ||
      typeof manifest.createdAt !== 'string' || !Number.isFinite(Date.parse(manifest.createdAt)) ||
      !Array.isArray(manifest.files) || !Number.isSafeInteger(manifest.fileCount) ||
      manifest.fileCount < 0 || manifest.fileCount !== manifest.files.length ||
      !manifest.artifact || typeof manifest.artifact !== 'object' || Array.isArray(manifest.artifact)) {
    fail('Invalid release manifest metadata or inventory count.');
  }

  const artifact = manifest.artifact;
  if (typeof artifact.name !== 'string' || !artifact.name.trim() ||
      path.basename(artifact.name) !== artifact.name || path.win32.basename(artifact.name) !== artifact.name ||
      !Number.isSafeInteger(artifact.size) || artifact.size < 0 ||
      typeof artifact.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(artifact.sha256)) {
    fail('Invalid packaged-artifact metadata in release manifest.');
  }

  const entries = new Map();
  for (const entry of manifest.files) {
    const normalizedPath = typeof entry?.path === 'string' ? entry.path.replaceAll('\\\\', '/') : '';
    const segments = normalizedPath.split('/');
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !normalizedPath ||
        path.isAbsolute(normalizedPath) || path.win32.isAbsolute(normalizedPath) ||
        normalizedPath.includes(String.fromCharCode(0)) ||
        segments.some((part) => !part || part === '.' || part === '..' || /^[a-zA-Z]:/.test(part)) ||
        entries.has(normalizedPath) || !Number.isSafeInteger(entry.size) || entry.size < 0 ||
        typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      fail('Invalid, unsafe or duplicate manifest inventory entry.');
    }
    entries.set(normalizedPath, { size: entry.size, sha256: entry.sha256 });
  }
  if (manifest.releaseIdentity !== undefined &&
      (typeof manifest.releaseIdentity !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.releaseIdentity))) {
    fail('Invalid release identity in manifest.');
  }
  return entries;
}

async function inventory(root) {
  const out = [];
  async function walk(dir, prefix = '') {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const e of entries) {
      const abs = path.join(dir, e.name), rel = path.posix.join(prefix, e.name), st = await lstat(abs);
      if (st.isSymbolicLink()) fail(`Symbolic link not allowed: ${rel}`);
      if (st.isDirectory()) await walk(abs, rel);
      else if (st.isFile()) out.push({ path: rel, size: st.size, sha256: await hash(abs) });
      else fail(`Unsupported package entry: ${rel}`);
    }
  }
  const st = await lstat(root);
  if (!st.isDirectory() || st.isSymbolicLink()) fail('Extracted package must be a real directory.');
  await walk(root);
  return out.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

async function createPolicy(manifestPath, artifactPath, policyPath) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  validateReleaseManifest(manifest);
  const st = await lstat(artifactPath);
  if (!st.isFile() || st.isSymbolicLink() || manifest?.schemaVersion !== 1 ||
      manifest?.algorithm !== 'SHA256' || !Array.isArray(manifest.files) || !manifest.artifact) {
    fail('Cannot create manifest-ignore policy from invalid release inputs.');
  }
  const policy = {
    schemaVersion: 1, algorithm: 'SHA256', purpose: 'manifest-ignore',
    project: manifest.project, source: manifest.source,
    releaseIdentity: manifest.releaseIdentity,
    manifest: { name: path.basename(manifestPath), sha256: await hash(manifestPath) },
    artifact: { name: path.basename(artifactPath), size: st.size, sha256: await hash(artifactPath) },
  };
  await writeFile(policyPath, JSON.stringify(policy, null, 2) + '\n', { flag: 'wx' });
  console.log('Manifest-ignore created. Hash it with artifact-integrity.mjs and distribute that trusted digest separately.');
}

async function verify(policyPath, policySumPath, manifestPath, artifactPath, extractedDir, trustedHash, signaturePath, publicKeyPath) {
  // 1. Authenticate the policy before parsing it. Use a trusted digest or an independently trusted Ed25519 public key.
  const trusted = String(trustedHash || '').trim().toLowerCase();
  const signedMode = Boolean(signaturePath || publicKeyPath);
  if (Boolean(signaturePath) !== Boolean(publicKeyPath)) fail('Both policy signature and trusted public-key paths are required.');
  if (!signedMode && !/^[a-f0-9]{64}$/.test(trusted)) fail('Trusted manifest-ignore SHA-256 is required unless a signature is supplied.');
  if (signedMode && trusted !== '-' && !/^[a-f0-9]{64}$/.test(trusted)) fail('Trusted digest must be 64 hex characters or - when signature verification is enabled.');
  const pst = await lstat(policyPath);
  if (!pst.isFile() || pst.isSymbolicLink()) fail('Manifest-ignore must be a regular file.');
  const actualPolicyHash = await hash(policyPath);
  const sum = (await readFile(policySumPath, 'utf8')).trim().match(/^([a-f0-9]{64})\s+\*?(.+)$/);
  if (!sum || sum[1] !== actualPolicyHash || sum[2] !== path.basename(policyPath) || (trusted !== '-' && actualPolicyHash !== trusted)) {
    fail('Manifest-ignore checksum/trusted-digest verification failed.');
  }
  if (signedMode) {
    const sigStat = await lstat(signaturePath), keyStat = await lstat(publicKeyPath);
    if (!sigStat.isFile() || sigStat.isSymbolicLink() || !keyStat.isFile() || keyStat.isSymbolicLink()) fail('Signature and public key must be regular files.');
    const key = createPublicKey(await readFile(publicKeyPath, 'utf8'));
    if (key.asymmetricKeyType !== 'ed25519') fail('Trusted policy public key must be Ed25519.');
    const signature = Buffer.from((await readFile(signaturePath, 'utf8')).trim(), 'base64');
    if (signature.length !== 64 || !verifySignature(null, await readFile(policyPath), key, signature)) fail('Manifest-ignore Ed25519 signature verification failed.');
  }
  const policy = JSON.parse(await readFile(policyPath, 'utf8'));
  if (policy.schemaVersion !== 1 || policy.algorithm !== 'SHA256' || policy.purpose !== 'manifest-ignore' ||
      typeof policy.project !== 'string' || !policy.project.trim() ||
      !policy.source || typeof policy.source !== 'object' || Array.isArray(policy.source) ||
      typeof policy.source.gitCommit !== 'string' || typeof policy.source.buildNumber !== 'string' ||
      !policy.manifest || typeof policy.manifest.name !== 'string' ||
      path.basename(policy.manifest.name) !== policy.manifest.name ||
      typeof policy.manifest.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(policy.manifest.sha256) ||
      !policy.artifact || typeof policy.artifact.name !== 'string' ||
      path.basename(policy.artifact.name) !== policy.artifact.name ||
      !Number.isSafeInteger(policy.artifact.size) || policy.artifact.size < 0 ||
      typeof policy.artifact.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(policy.artifact.sha256)) {
    fail('Invalid manifest-ignore metadata.');
  }
  console.log('Stage 1 PASSED: manifest-ignore verified.');

  // 2. Check manifest bytes against the verified policy before trusting its inventory.
  if (path.basename(manifestPath) !== policy.manifest.name || await hash(manifestPath) !== policy.manifest.sha256) {
    fail('Manifest checksum/name mismatch.');
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const expected = validateReleaseManifest(manifest);
  if (manifest.project !== policy.project ||
      manifest.source.gitCommit !== policy.source.gitCommit ||
      manifest.source.buildNumber !== policy.source.buildNumber) {
    fail('Release manifest project or source provenance does not match the authenticated policy.');
  }
  if (policy.releaseIdentity !== undefined || manifest.releaseIdentity !== undefined) {
    if (typeof policy.releaseIdentity !== 'string' || !/^[a-f0-9]{64}$/.test(policy.releaseIdentity) ||
        policy.releaseIdentity !== manifest.releaseIdentity) {
      fail('Release identity does not match the authenticated manifest-ignore policy.');
    }
  }
  console.log('Stage 2 PASSED: manifest and release identity verified.');

  // 3. Verify package bytes, then every file in the extracted package directory.
  const ast = await lstat(artifactPath);
  if (!ast.isFile() || ast.isSymbolicLink() || path.basename(artifactPath) !== policy.artifact.name ||
      ast.size !== policy.artifact.size || await hash(artifactPath) !== policy.artifact.sha256 ||
      manifest.artifact.name !== policy.artifact.name || manifest.artifact.size !== policy.artifact.size ||
      manifest.artifact.sha256 !== policy.artifact.sha256) fail('Package SHA-256 does not match policy and manifest.');

    const normalizedPath = typeof e?.path === 'string' ? e.path.replaceAll('\\', '/') : '';
    const pathParts = normalizedPath.split('/');
    if (!e || typeof e.path !== 'string' || !normalizedPath || path.isAbsolute(normalizedPath) ||
        path.win32.isAbsolute(normalizedPath) || normalizedPath.includes(String.fromCharCode(0)) ||
        pathParts.some((part) => !part || part === '.' || part === '..' || /^[a-zA-Z]:/.test(part)) ||
        expected.has(normalizedPath) || !Number.isSafeInteger(e.size) || e.size < 0 ||
        typeof e.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(e.sha256)) fail('Invalid or unsafe manifest inventory entry.');
  const actualEntries = await inventory(extractedDir), actual = new Map(actualEntries.map(e => [e.path, e])), errors = [];
  for (const [name, e] of expected) {
    const got = actual.get(name);
    if (!got) errors.push('MISSING: ' + name);
    else if (got.size !== e.size || got.sha256 !== e.sha256) errors.push('MISMATCH: ' + name);
  }
  for (const name of actual.keys()) if (!expected.has(name)) errors.push('UNEXPECTED: ' + name);
  if (errors.length || manifest.fileCount !== expected.size) fail('Package inventory failed: ' + errors.join('; '));
  console.log(`Stage 3 PASSED: package SHA-256 and ${actualEntries.length} files verified.`);
}

async function main() {
  const [cmd, ...a] = process.argv.slice(2);
  if (cmd === 'create' && a.length === 3) return createPolicy(...a);
  if (cmd === 'verify' && (a.length === 6 || a.length === 8)) return verify(...a);
  console.error('Usage: customer-release-verifier.mjs create <manifest> <artifact> <manifest-ignore.json>\n' +
    '       customer-release-verifier.mjs verify <manifest-ignore.json> <manifest-ignore.sha256> <manifest> <artifact> <extracted-dir> <trusted-policy-sha256|-> [<manifest-ignore.sig> <trusted-public-key.pem>]');
  process.exitCode = 2;
}
main().catch(e => { console.error('Customer release verification FAILED: ' + e.message); process.exitCode = 1; });
