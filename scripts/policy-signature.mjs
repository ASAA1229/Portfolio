#!/usr/bin/env node
import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";

const fail = (message) => {
  throw new Error(message);
};
async function regularFile(file, label) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${label} must be a regular file.`);
}
async function createSignature(policyPath, signaturePath, privateKeyPath) {
  await regularFile(policyPath, "Policy");
  await regularFile(privateKeyPath, "Private key");
  const key = createPrivateKey(await readFile(privateKeyPath, "utf8"));
  if (key.asymmetricKeyType !== "ed25519") fail("Policy signing key must be Ed25519.");
  await writeFile(
    signaturePath,
    sign(null, await readFile(policyPath), key).toString("base64") + "\n",
    { flag: "wx", mode: 0o600 },
  );
  console.log("Ed25519 policy signature created.");
}
async function verifySignature(policyPath, signaturePath, publicKeyPath) {
  await regularFile(policyPath, "Policy");
  await regularFile(signaturePath, "Signature");
  await regularFile(publicKeyPath, "Public key");
  const key = createPublicKey(await readFile(publicKeyPath, "utf8"));
  if (key.asymmetricKeyType !== "ed25519") fail("Policy verification key must be Ed25519.");
  const signature = Buffer.from((await readFile(signaturePath, "utf8")).trim(), "base64");
  if (signature.length !== 64 || !verify(null, await readFile(policyPath), key, signature))
    fail("Manifest-ignore Ed25519 signature verification failed.");
  console.log("Ed25519 manifest-ignore signature verified.");
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "sign" && args.length === 3) return createSignature(...args);
  if (command === "verify" && args.length === 3) return verifySignature(...args);
  console.error(
    "Usage: policy-signature.mjs sign <policy.json> <signature-file> <private-key.pem>\n" +
      "       policy-signature.mjs verify <policy.json> <signature-file> <public-key.pem>",
  );
  process.exitCode = 2;
}
main().catch((error) => {
  console.error("Policy signature FAILED: " + error.message);
  process.exitCode = 1;
});
