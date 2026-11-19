import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts", "policy-signature.mjs");
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("Ed25519 policy signatures", () => {
  it("authenticates policy bytes and rejects tampering", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "policy-signature-"));
    dirs.push(dir);
    const policy = path.join(dir, "manifest-ignore.json");
    const signature = path.join(dir, "manifest-ignore.sig");
    const privatePath = path.join(dir, "private.pem");
    const publicPath = path.join(dir, "public.pem");
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    writeFileSync(policy, JSON.stringify({ purpose: "manifest-ignore", value: 1 }));
    writeFileSync(privatePath, privateKey.export({ type: "pkcs8", format: "pem" }));
    writeFileSync(publicPath, publicKey.export({ type: "spki", format: "pem" }));
    const run = (args: string[]) =>
      spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
    expect(run(["sign", policy, signature, privatePath]).status).toBe(0);
    expect(run(["verify", policy, signature, publicPath]).status).toBe(0);
    writeFileSync(policy, JSON.stringify({ purpose: "manifest-ignore", value: 2 }));
    expect(run(["verify", policy, signature, publicPath]).status).not.toBe(0);
  });
});
