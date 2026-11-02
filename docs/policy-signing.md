# Ed25519 policy signing

The manifest-ignore policy can be authenticated with an Ed25519 digital signature. This is stronger than distributing a SHA-256 sidecar alone: a customer verifies the policy against a trusted public key, while the private signing key remains only in the release system.

## Generate a key pair (one-time, on a trusted machine)

Use OpenSSL or another approved key-management process to create an Ed25519 private/public key pair. Protect the private key; never commit it to source control or include it in a package. Distribute the public key to customers through an authenticated channel and pin its fingerprint in the customer verification environment.

## Sign and verify

```powershell
node scripts/policy-signature.mjs sign manifest-ignore.json manifest-ignore.sig .\private-key.pem
node scripts/policy-signature.mjs verify manifest-ignore.json manifest-ignore.sig .\trusted-public-key.pem
```

The signature covers the exact bytes of the policy file. Any modification to the policy invalidates the signature. The public key must be obtained independently from the package; a public key bundled only inside the same untrusted package does not establish trust.

SHA-256 sidecars remain useful for accidental-corruption detection and transfer validation, but they are not a substitute for an independently trusted signature. Never store the private key in the repository, build artifact, or logs.
