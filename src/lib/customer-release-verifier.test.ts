import { createHash, generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const integrity = path.join(root, 'scripts', 'artifact-integrity.mjs');
const verifier = path.join(root, 'scripts', 'customer-release-verifier.mjs');
const signer = path.join(root, 'scripts', 'policy-signature.mjs');
const tempDirs: string[] = [];
function run(script: string, args: string[], ok = true) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root, encoding: 'utf8',
    env: { ...process.env, PROJECT_NAME: 'portfolio-customer-test', REQUIRE_BUILD_PROVENANCE: 'false' },
  });
  if (ok) expect(result.status, result.stderr || result.stdout).toBe(0);
  else expect(result.status, 'Expected command to fail.').not.toBe(0);
  return result;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('customer release verifier', () => {
  it('checks manifest-ignore, manifest, and package inventory in order', () => {
    const temp = mkdtempSync(path.join(os.tmpdir(), 'portfolio-customer-release-'));
    tempDirs.push(temp);
    const dist = path.join(temp, 'dist');
    mkdirSync(dist);
    writeFileSync(path.join(dist, 'index.html'), '<main>release</main>');
    const artifact = path.join(temp, 'portfolio.tar.gz');
    writeFileSync(artifact, 'package bytes');
    const manifest = path.join(temp, 'manifest.json');
    const policy = path.join(temp, 'manifest-ignore.json');
    const policySum = path.join(temp, 'manifest-ignore.json.sha256');
    run(integrity, ['create', dist, manifest, artifact]);
    run(verifier, ['create', manifest, artifact, policy]);
    run(integrity, ['hash', policy, policySum]);
    const trusted = createHash('sha256').update(readFileSync(policy)).digest('hex');
    const success = run(verifier, ['verify', policy, policySum, manifest, artifact, dist, trusted]);
    expect(success.stdout).toMatch(/Stage 1 PASSED:[\s\S]*Stage 2 PASSED:[\s\S]*Stage 3 PASSED/);
    writeFileSync(path.join(dist, 'index.html'), '<main>tampered</main>');
    expect(run(verifier, ['verify', policy, policySum, manifest, artifact, dist, trusted], false).stderr).toContain('Package inventory failed');
    writeFileSync(path.join(dist, 'index.html'), '<main>release</main>');
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const privatePath = path.join(temp, 'policy-private.pem'), publicPath = path.join(temp, 'policy-public.pem');
    const signaturePath = path.join(temp, 'manifest-ignore.sig');
    writeFileSync(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
    writeFileSync(publicPath, publicKey.export({ type: 'spki', format: 'pem' }));
    run(signer, ['sign', policy, signaturePath, privatePath]);
    const signedGood = run(verifier, ['verify', policy, policySum, manifest, artifact, dist, '-', signaturePath, publicPath]);
    expect(signedGood.stdout).toMatch(/Stage 1 PASSED:[\s\S]*Stage 2 PASSED:[\s\S]*Stage 3 PASSED/);
    const originalPolicy = readFileSync(policy);
    writeFileSync(policy, Buffer.concat([originalPolicy, Buffer.from(' ')]));
    run(integrity, ['hash', policy, policySum]);
    expect(run(verifier, ['verify', policy, policySum, manifest, artifact, dist, '-', signaturePath, publicPath], false).stderr).toContain('Ed25519 signature verification failed');
    writeFileSync(policy, originalPolicy);
    run(integrity, ['hash', policy, policySum]);
    expect(run(verifier, ['verify', policy, policySum, manifest, artifact, dist, '0'.repeat(64)], false).stderr).toContain('trusted-digest verification failed');
  });
});
