#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SCHEMA_VERSION = 1;
const sha256 = async (file) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};
const fail = (message) => { throw new Error(message); };

function normalizeRelative(input) {
  if (typeof input !== 'string' || !input || input.includes('\0')) fail('Invalid relative path.');
  const normalized = input.replaceAll('\\', '/');
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized) ||
      normalized.split('/').some((part) => !part || part === '.' || part === '..')) {
    fail('Unsafe relative path: ' + input);
  }
  return normalized;
}

async function readIgnore(ignorePath) {
  if (!ignorePath) return [];
  const parsed = JSON.parse(await readFile(ignorePath, 'utf8'));
  if (parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.paths) ||
      parsed.paths.some((entry) => typeof entry !== 'string')) fail('Ignore file must contain schemaVersion: 1 and a paths array.');
  return parsed.paths.map(normalizeRelative);
}

function isIgnored(relative, patterns) {
  return patterns.some((pattern) => relative === pattern || relative.startsWith(pattern.endsWith('/') ? pattern : pattern + '/'));
}

export async function collectInventory(root, ignorePatterns = []) {
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('Scan root must be a real directory.');
  const entries = [];
  const errors = [];
  async function walk(directory, prefix = '') {
    let children;
    try { children = await readdir(directory, { withFileTypes: true }); }
    catch (error) { errors.push({ path: prefix || '.', error: error.code || 'READ_FAILED' }); return; }
    children.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const child of children) {
      const relative = normalizeRelative(prefix ? prefix + '/' + child.name : child.name);
      if (isIgnored(relative, ignorePatterns)) continue;
      const absolute = path.join(directory, child.name);
      let stat;
      try { stat = await lstat(absolute); }
      catch (error) { errors.push({ path: relative, error: error.code || 'STAT_FAILED' }); continue; }
      if (stat.isSymbolicLink()) {
        errors.push({ path: relative, error: 'SYMLINK_NOT_ALLOWED' });
      } else if (stat.isDirectory()) {
        await walk(absolute, relative);
      } else if (stat.isFile()) {
        try {
          entries.push({ path: relative, size: stat.size, sha256: await sha256(absolute) });
        } catch (error) {
          errors.push({ path: relative, error: error.code || 'HASH_FAILED' });
        }
      } else {
        errors.push({ path: relative, error: 'UNSUPPORTED_FILE_TYPE' });
      }
    }
  }
  await walk(root);
  if (errors.length) fail('Scan incomplete; no baseline/report written: ' + JSON.stringify(errors));
  return entries.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

async function writeJsonAtomic(destination, value) {
  const target = path.resolve(destination);
  const temp = target + '.tmp-' + process.pid;
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  await rename(temp, target);
}

export async function createBaseline(root, destination, ignorePath) {
  const ignore = await readIgnore(ignorePath);
  const files = await collectInventory(root, ignore);
  const baseline = {
    schemaVersion: SCHEMA_VERSION,
    algorithm: 'SHA256',
    createdAt: new Date().toISOString(),
    rootLabel: path.basename(path.resolve(root)),
    ignoredPaths: ignore,
    fileCount: files.length,
    files,
  };
  await writeJsonAtomic(destination, baseline);
  return baseline;
}

export async function createSnapshot(root, destination, ignorePath) {
  const ignore = await readIgnore(ignorePath);
  const files = await collectInventory(root, ignore);
  const snapshot = {
    schemaVersion: SCHEMA_VERSION,
    algorithm: 'SHA256',
    scannedAt: new Date().toISOString(),
    rootLabel: path.basename(path.resolve(root)),
    ignoredPaths: ignore,
    fileCount: files.length,
    files,
  };
  await writeJsonAtomic(destination, snapshot);
  return snapshot;
}

function validatedInventory(value, label) {
  if (value?.schemaVersion !== SCHEMA_VERSION || value?.algorithm !== 'SHA256' ||
      !Array.isArray(value.files) || !Number.isSafeInteger(value.fileCount) ||
      value.fileCount < 0 || value.fileCount !== value.files.length ||
      !Array.isArray(value.ignoredPaths) || value.ignoredPaths.some((entry) => typeof entry !== 'string')) {
    fail('Invalid ' + label + ' schema or file count.');
  }
  const entries = new Map();
  for (const entry of value.files) {
    if (!entry || typeof entry !== 'object') fail('Invalid file entry in ' + label + '.');
    const relative = normalizeRelative(entry.path);
    if (entries.has(relative) || !Number.isSafeInteger(entry.size) || entry.size < 0 ||
        typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      fail('Invalid or duplicate file entry in ' + label + ': ' + relative);
    }
    entries.set(relative, entry);
  }
  const ignored = value.ignoredPaths.map(normalizeRelative);
  if (new Set(ignored).size !== ignored.length) fail('Duplicate ignored path in ' + label + '.');
  return { entries, ignored };
}

export function compareInventories(baseline, current) {
  const beforeInventory = validatedInventory(baseline, 'baseline');
  const afterInventory = validatedInventory(current, 'snapshot');
  if (JSON.stringify(beforeInventory.ignored) !== JSON.stringify(afterInventory.ignored)) {
    fail('Baseline and snapshot use different ignored-path policies; create a new baseline or use the matching ignore file.');
  }
  const before = beforeInventory.entries;
  const after = afterInventory.entries;
  const modified = [], missing = [], unexpected = [], unchanged = [];
  for (const [name, oldEntry] of before) {
    const newEntry = after.get(name);
    if (!newEntry) missing.push(name);
    else if (oldEntry.size !== newEntry.size || oldEntry.sha256 !== newEntry.sha256) modified.push({
      path: name, baselineSize: oldEntry.size, currentSize: newEntry.size,
      baselineSha256: oldEntry.sha256, currentSha256: newEntry.sha256,
    });
    else unchanged.push(name);
  }
  for (const name of after.keys()) if (!before.has(name)) unexpected.push(name);
  const sort = (a, b) => (typeof a === 'string' ? a : a.path).localeCompare(typeof b === 'string' ? b : b.path, 'en');
  modified.sort(sort); missing.sort(sort); unexpected.sort(sort); unchanged.sort(sort);
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    baselineCreatedAt: baseline.createdAt || null,
    snapshotScannedAt: current.scannedAt || null,
    summary: {
      unchanged: unchanged.length, modified: modified.length,
      missing: missing.length, unexpected: unexpected.length,
      hasChanges: Boolean(modified.length || missing.length || unexpected.length),
    },
    changes: { modified, missing, unexpected },
  };
}

export async function compareFiles(baselinePath, snapshotPath, reportPath) {
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  const current = JSON.parse(await readFile(snapshotPath, 'utf8'));
  const report = compareInventories(baseline, current);
  await writeJsonAtomic(reportPath, report);
  return report;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'baseline' && (args.length === 2 || args.length === 3)) {
    const result = await createBaseline(...args);
    console.log('Baseline created: ' + result.fileCount + ' files.');
  } else if (command === 'scan' && (args.length === 2 || args.length === 3)) {
    const result = await createSnapshot(...args);
    console.log('Snapshot created: ' + result.fileCount + ' files.');
  } else if (command === 'compare' && args.length === 3) {
    const result = await compareFiles(...args);
    console.log(JSON.stringify(result.summary, null, 2));
    if (result.summary.hasChanges) process.exitCode = 2;
  } else {
    console.error('Usage:\n  node scripts/on-site-change-detection.mjs baseline <root> <baseline.json> [ignore.json]\n  node scripts/on-site-change-detection.mjs scan <root> <snapshot.json> [ignore.json]\n  node scripts/on-site-change-detection.mjs compare <baseline.json> <snapshot.json> <report.json>');
    process.exitCode = 64;
  }
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch((error) => { console.error('On-site change detection failed: ' + error.message); process.exitCode = 1; });
}
