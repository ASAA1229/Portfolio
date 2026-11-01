#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ALGORITHM = 'sha256';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');

function usage() {
  console.error(
    'Usage:\n' +
    '  node scripts/artifact-integrity.mjs create <directory> <manifest.json> [artifact.tar.gz]\n' +
    '  node scripts/artifact-integrity.mjs verify <directory> <manifest.json> [artifact.tar.gz]\n' +
    '  node scripts/artifact-integrity.mjs hash <file> <checksum-file>\n' +
    '  node scripts/artifact-integrity.mjs verify-hash <file> <checksum-file>'
  );
  process.exit(2);
}

async function hashFile(filePath) {
  const hash = createHash(ALGORITHM);
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function inventory(directory) {
  const base = path.resolve(directory);
  const files = [];

  async function walk(current, relative = '') {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
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
    throw new Error('Artifact target must be a real directory.');
  }
  await walk(base);
  return files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

function safeManifestPath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.includes(String.fromCharCode(0)) ||
      path.isAbsolute(value) || path.win32.isAbsolute(value) || /^[a-zA-Z]:/.test(value)) {
    throw new Error('Manifest contains an invalid relative file path.');
  }
  const normalized = value.replaceAll('\\', '/');
  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || /^[a-zA-Z]:$/.test(segment))) {
    throw new Error(`Manifest contains an unsafe path: ${value}`);
  }
  return normalized;
}

async function createManifest(directory, manifestPath, artifactPath) {
  const sourceCommit = process.env.GIT_COMMIT || process.env.GIT_COMMIT_SHA || '';
  const buildNumber = process.env.BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER || '';
  if (process.env.REQUIRE_BUILD_PROVENANCE === 'true' &&
      (!/^[a-f0-9]{40,64}$/i.test(sourceCommit) || !buildNumber.trim())) {
    throw new Error('Release provenance requires a full Git commit SHA and build number.');
  }
  const target = path.resolve(directory);
  const output = path.resolve(manifestPath);
  if (output === target || output.startsWith(target + path.sep)) {
    throw new Error('Store the manifest outside the artifact directory to avoid self-referencing hashes.');
  }

  const files = await inventory(target);
  const manifest = {
    schemaVersion: 1,
    project: process.env.PROJECT_NAME || 'unnamed-project',
    algorithm: ALGORITHM.toUpperCase(),
    source: {
      gitCommit: process.env.GIT_COMMIT || process.env.GIT_COMMIT_SHA || 'UNKNOWN',
      buildNumber: process.env.BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER || 'LOCAL',
    },
    createdAt: new Date().toISOString(),
    fileCount: files.length,
    files,
  };

  if (artifactPath) {
    const artifact = path.resolve(artifactPath);
    const stat = await lstat(artifact);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error('Packaged artifact must be a regular file.');
    }
    manifest.artifact = {
      name: path.basename(artifact),
      size: stat.size,
      sha256: await hashFile(artifact),
    };
  }

  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  console.log(`Manifest created: ${output} (${files.length} files)`);
}

async function verifyManifest(directory, manifestPath, artifactPath) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.algorithm !== 'SHA256' || !Array.isArray(manifest.files) ||
      !Number.isSafeInteger(manifest.fileCount) || manifest.fileCount < 0 ||
      typeof manifest.project !== 'string' || manifest.project.length === 0 ||
      !manifest.source || typeof manifest.source.gitCommit !== 'string' ||
      typeof manifest.source.buildNumber !== 'string' ||
      typeof manifest.createdAt !== 'string' || Number.isNaN(Date.parse(manifest.createdAt))) {
    throw new Error('Unsupported or invalid artifact manifest metadata.');
  }

  if (process.env.REQUIRE_BUILD_PROVENANCE === 'true' &&
      (!/^[a-f0-9]{40,64}$/i.test(manifest.source.gitCommit) ||
       !manifest.source.buildNumber.trim() || manifest.source.gitCommit === 'UNKNOWN' ||
       manifest.source.buildNumber === 'LOCAL')) {
    throw new Error('Artifact manifest is missing trustworthy build provenance.');
  }

  const expected = new Map();
  for (const entry of manifest.files) {
    if (!entry || typeof entry !== 'object') throw new Error('Manifest contains an invalid file entry.');
    const rel = safeManifestPath(entry.path);
    if (expected.has(rel) || !Number.isSafeInteger(entry.size) || entry.size < 0 ||
        !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw new Error(`Invalid or duplicate manifest entry: ${rel}`);
    }
    expected.set(rel, entry);
  }

  if (manifest.artifact !== undefined) {
    const artifact = manifest.artifact;
    if (!artifact || typeof artifact.name !== 'string' || artifact.name.length === 0 ||
        path.basename(artifact.name) !== artifact.name || !Number.isSafeInteger(artifact.size) ||
        artifact.size < 0 || !/^[a-f0-9]{64}$/.test(artifact.sha256)) {
      throw new Error('Manifest contains invalid packaged-artifact metadata.');
    }
  }

  const actualFiles = await inventory(directory);
  const actual = new Map(actualFiles.map((entry) => [entry.path, entry]));
  const problems = [];

  for (const [rel, entry] of expected) {
    const found = actual.get(rel);
    if (!found) problems.push(`MISSING: ${rel}`);
    else if (found.size !== entry.size || found.sha256 !== entry.sha256) problems.push(`MISMATCH: ${rel}`);
  }
  for (const rel of actual.keys()) {
    if (!expected.has(rel)) problems.push(`UNEXPECTED: ${rel}`);
  }

  if (manifest.fileCount !== expected.size) problems.push('Manifest fileCount does not match its inventory.');
  if (artifactPath) {
    if (!manifest.artifact) {
      problems.push('Manifest has no packaged-artifact metadata.');
    } else {
      const artifact = path.resolve(artifactPath);
      try {
        const stat = await lstat(artifact);
        if (!stat.isFile() || stat.isSymbolicLink()) {
          problems.push('Packaged artifact is not a regular file.');
        } else if (path.basename(artifact) !== manifest.artifact.name || stat.size !== manifest.artifact.size ||
                   await hashFile(artifact) !== manifest.artifact.sha256) {
          problems.push('Packaged artifact name, checksum, or size mismatch.');
        }
      } catch {
        problems.push('Packaged artifact is missing.');
      }
    }
  }

  if (problems.length) {
    console.error('Artifact verification FAILED:');
    for (const problem of problems) console.error(` - ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Artifact verification PASSED: ${actualFiles.length} files verified.`);
}
async function writeHash(filePath, checksumPath) {
  const file = path.resolve(filePath);
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Hash target must be a regular file.');
  const digest = await hashFile(file);
  await writeFile(checksumPath, `${digest}  ${path.basename(file)}\n`, { flag: 'wx' });
  console.log(`SHA-256 written: ${checksumPath}`);
}

async function verifyHash(filePath, checksumPath) {
  const file = path.resolve(filePath);
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Hash target must be a regular file.');
  const content = (await readFile(checksumPath, 'utf8')).trim();
  const match = content.match(/^([a-f0-9]{64})\s+\*?(.+)$/);
  if (!match || match[2] !== path.basename(file) || match[1] !== await hashFile(file)) {
    throw new Error('SHA-256 verification failed.');
  }
  console.log(`SHA-256 verification PASSED: ${path.basename(file)}`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'create' && args.length >= 2 && args.length <= 3) {
    await createManifest(args[0], args[1], args[2]);
  } else if (command === 'verify' && args.length >= 2 && args.length <= 3) {
    await verifyManifest(args[0], args[1], args[2]);
  } else if (command === 'hash' && args.length === 2) {
    await writeHash(args[0], args[1]);
  } else if (command === 'verify-hash' && args.length === 2) {
    await verifyHash(args[0], args[1]);
  } else {
    usage();
  }
}

main().catch((error) => {
  console.error(`Artifact integrity error: ${error.message}`);
  process.exitCode = 1;
});
