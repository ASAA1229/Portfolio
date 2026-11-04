import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { collectInventory, compareInventories } from './on-site-change-detection.mjs';

test('inventory hashes files and honors exact directory ignores', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'change-detect-'));
  try {
    await mkdir(path.join(root, 'logs'));
    await writeFile(path.join(root, 'app.txt'), 'release');
    await writeFile(path.join(root, 'logs', 'run.log'), 'ignored');
    const entries = await collectInventory(root, ['logs']);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].path, 'app.txt');
    assert.match(entries[0].sha256, /^[a-f0-9]{64}$/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('comparison classifies modified, missing, unexpected and unchanged paths', () => {
  const entry = (name, content) => ({ path: name, size: content.length, sha256: content });
  const result = compareInventories(
    { schemaVersion: 1, algorithm: 'SHA256', createdAt: 'baseline', files: [entry('same', 'a'), entry('edit', 'b'), entry('gone', 'c')] },
    { schemaVersion: 1, algorithm: 'SHA256', scannedAt: 'current', files: [entry('same', 'a'), entry('edit', 'x'), entry('new', 'd')] },
  );
  assert.deepEqual(result.summary, { unchanged: 1, modified: 1, missing: 1, unexpected: 1, hasChanges: true });
});

test('rejects malformed inventory paths', () => {
  assert.throws(() => compareInventories(
    { schemaVersion: 1, algorithm: 'SHA256', files: [{ path: '../escape' }] },
    { schemaVersion: 1, algorithm: 'SHA256', files: [] },
  ), /Unsafe relative path/);
});
