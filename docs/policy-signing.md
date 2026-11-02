# Ed25519 policy signing

The manifest-ignore policy is authenticated with an Ed25519 digital signature when signing keys are configured. SHA-256 sidecars remain useful for corruption detection, but do not independently prove who produced a release.

## Key management

On a trusted machine with OpenSSL installed, generate a key pair once:

```powershell
openssl genpkey -algorithm ED25519 -out manifest-ignore-private.pem
openssl pkey -in manifest-ignore-private.pem -pubout -out manifest-ignore-public.pem
```

Protect the private key and never commit it, print it to logs, or place it in a release package. Distribute the public key independently through an authenticated channel and pin it at the customer. Do not generate a fresh key on every CI run.

## GitHub Actions setup

Add these repository Actions secrets to enable signing in CI:

- `MANIFEST_IGNORE_PRIVATE_KEY`: the complete PEM-encoded Ed25519 private key.
- `MANIFEST_IGNORE_PUBLIC_KEY`: the matching PEM-encoded Ed25519 public key.

When both secrets are present, CI signs `manifest-ignore.json`, verifies the signature and customer package, and uploads the `.sig` file as a separate artifact. Without them, CI deliberately runs digest-only self-checks and prints a configuration reminder; this is not an independent authenticity guarantee.

## Jenkins setup

Create Jenkins **Secret text** credentials with these exact IDs:

- `manifest-ignore-private-key`
- `manifest-ignore-public-key`

Enable the `ENABLE_POLICY_SIGNING` build parameter to sign the policy. The pipeline verifies the signature before publication and validates the signature again after Nexus read-back. Keep the Nexus credential separate (`nexus-credentials`).

## Local sign and verify

```powershell
node scripts/policy-signature.mjs sign manifest-ignore.json manifest-ignore.sig .\manifest-ignore-private.pem
node scripts/policy-signature.mjs verify manifest-ignore.json manifest-ignore.sig .\manifest-ignore-public.pem
```

The signature covers the exact policy bytes. A public key bundled only inside the same untrusted package does not establish trust.
