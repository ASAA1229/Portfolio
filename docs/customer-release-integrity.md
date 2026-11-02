# Customer release integrity verification

The customer verification order is intentionally strict:

1. Verify `manifest-ignore.json` against its SHA-256 sidecar and a trusted SHA-256 value received through a separate trusted channel. Do not obtain the trusted value from the same untrusted package.
2. Verify the manifest's filename and SHA-256 against the already-verified policy.
3. Verify the package archive's name, size and SHA-256 against both policy and manifest.
4. Compare every extracted package file against the manifest inventory; missing, changed, extra or unsafe-path files fail closed.

## Build the policy

After producing `manifest.json` and the release archive:

```powershell
node scripts/customer-release-verifier.mjs create manifest.json release.tar.gz manifest-ignore.json
node scripts/artifact-integrity.mjs hash manifest-ignore.json manifest-ignore.json.sha256
```

Distribute `manifest-ignore.json`, its sidecar, the manifest, the archive, and the extracted package. Separately communicate the SHA-256 digest of `manifest-ignore.json` through a trusted channel (for example, an authenticated release record). The local CI invocation uses the sidecar's digest to exercise the validation path; that local self-check is not an independent authenticity guarantee.

## Verify at the customer

After safely extracting the archive into a staging directory (do not extract untrusted archives as an administrator):

```powershell
$trustedPolicyHash = '<64-hex-character digest obtained separately>'
node scripts/customer-release-verifier.mjs verify manifest-ignore.json manifest-ignore.json.sha256 manifest.json release.tar.gz .\staging $trustedPolicyHash
```

The verifier rejects symbolic links in the extracted tree and fails on any missing, unexpected, modified, or unsafe-path file. Keep the extracted directory isolated until all stages pass.

**Security note:** SHA-256 detects changes only when the expected digest is trusted. A checksum sidecar stored beside the file it protects can be replaced together with that file. For automated customer distribution, the trusted digest must come from an authenticated channel; a future signed policy (Ed25519 or another approved signature scheme) can make that trust distribution easier to automate.
