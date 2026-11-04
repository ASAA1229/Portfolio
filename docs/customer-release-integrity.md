# Customer release integrity verification

The customer verification order is intentionally strict:

1. Verify `manifest-ignore.json` using its SHA-256 sidecar and either an independently trusted SHA-256 digest or an Ed25519 signature verified with an independently trusted public key.
2. Verify the manifest's filename and SHA-256 against the already-authenticated policy.
3. Verify the package archive's name, size and SHA-256 against both policy and manifest.
4. Compare every extracted package file against the manifest inventory; missing, changed, extra or unsafe-path files fail closed.

## Build the policy

```powershell
node scripts/customer-release-verifier.mjs create portfolio-manifest.json portfolio-build.tar.gz portfolio-manifest-ignore.json
node scripts/artifact-integrity.mjs hash portfolio-manifest-ignore.json portfolio-manifest-ignore.json.sha256
node scripts/policy-signature.mjs sign portfolio-manifest-ignore.json portfolio-manifest-ignore.sig .\private-key.pem
```

Keep the Ed25519 private key in a protected secret store; never commit it or place it in the artifact. Distribute the public key independently through an authenticated channel and pin it at the customer. The policy signature covers the exact policy bytes.

## Verify at the customer

Signature-based verification (recommended for automated distribution):

```powershell
node scripts/policy-signature.mjs verify portfolio-manifest-ignore.json portfolio-manifest-ignore.sig .\trusted-public-key.pem
node scripts/customer-release-verifier.mjs verify portfolio-manifest-ignore.json portfolio-manifest-ignore.json.sha256 portfolio-manifest.json portfolio-build.tar.gz .\staging - portfolio-manifest-ignore.sig .\trusted-public-key.pem
```

If a trusted policy digest is delivered through a separate authenticated channel, the digest-only mode remains available:

```powershell
$trustedPolicyHash = '<64-hex-character digest obtained separately>'
node scripts/customer-release-verifier.mjs verify portfolio-manifest-ignore.json portfolio-manifest-ignore.json.sha256 portfolio-manifest.json portfolio-build.tar.gz .\staging $trustedPolicyHash
```

After safely extracting the archive into a staging directory (do not extract untrusted archives as an administrator), keep the directory isolated until all stages pass. The verifier rejects symbolic links in the extracted tree and fails on any missing, unexpected, modified, or unsafe-path file.

**Security note:** a checksum sidecar stored beside the file it protects can be replaced together with that file. A signature only establishes authenticity when the public key is obtained independently from the package and trusted by the customer.
