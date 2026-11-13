# Operations Guide

## Environment and deployment
Keep local development, CI, staging and production separate. Configure public origin, storage bindings and AI secrets in the hosting environment. JARVIS must be reachable only through an owner-approved HTTPS gateway; keep the primary personal JARVIS port private. Deployment requires explicit owner approval and successful exact-head gates.

## Backup, restore and recovery
- Backups include every private/public binary referenced by persisted indexes plus metadata and integrity data.
- Incomplete backups fail closed; restore/migration must not write destination keys from incomplete payloads.
- Recovery journals preserve pre-mutation snapshots and support replay of interrupted operations where implemented.
- Admin recovery requires authenticated owner confirmation.
- Per-isolate serialization is not distributed locking; multi-instance concurrency and hosted R2 semantics remain open.
- Rehearse backup → restore → integrity comparison before production acceptance.

## CI/CD and artifact integrity
Jenkins packages the application, generates a SHA-256 inventory manifest, verifies manifest/package checksums and archives outputs. Required provenance binds project, repository, normalized branch, full source SHA, build number and CI metadata. Optional Nexus Raw publication requires configuration and Jenkins credentials; never embed credentials in URLs.
1. Build from approved full commit SHA.
2. Generate provenance and SBOM.
3. Verify manifest inventory and package checksum.
4. Verify customer policy authenticity and package contents.
5. Preflight target paths to prevent accidental overwrite.
6. Read back publication and compare SHA-256.
7. Record artifact, manifest, checksum, source SHA and CI run.

Nexus preflight expects authenticated HEAD requests and HTTP 404 for absent paths. This is not an atomic immutability guarantee; enforce repository-side controls.

## Customer verification
Authenticate the policy using its SHA-256 sidecar plus an independently trusted digest or Ed25519 signature. Then verify manifest identity, archive name/size/hash and every extracted file. Reject missing, modified, extra, unsafe-path and symlink entries. Extract untrusted archives as an unprivileged user into isolated staging.

## On-site change detection
The utility is read-only: create a baseline from a verified release, transfer it through an authenticated channel, scan the customer directory and compare snapshots. It classifies unchanged, modified, missing and unexpected files. Symlinks, special files, unreadable paths and incomplete scans fail closed. Reports contain paths/hashes and must be reviewed before sharing.

## Release quarantine and recovery
Quarantine/recovery commands create evidence records only. They do not move/delete artifacts, change branches, deploy, promote, publish or roll back. Preserve evidence, record operator/reason/fingerprints, validate a different known-good candidate, obtain explicit owner approval, then follow the separate manual rollback procedure. Record approval reference, operator, target identity, execution time and outcome.

## Evidence
A commit/PR does not prove deployment readiness. Record exact SHA, CI/Jenkins run, build/test/typecheck/lint results, artifact identity, environment, storage checks, backup/restore evidence and owner approval. Validation is currently paused; historical reports are traceability only.


## Current release disposition — 2026-11-13

**Disposition: NOT READY FOR PRODUCTION RELEASE.** No production deployment or release is authorized by this status update.

Release remains blocked until all items in [Release Readiness](RELEASE_READINESS.md) are evidenced against one exact candidate SHA. At minimum:

- Exact-head dependency install, typecheck, lint, production build, unit/integration/API/UI/E2E and security checks pass in authorized CI.
- Four-profile public journeys, CMS administration, image/resume publication, unpublish, rollback and recovery pass browser acceptance.
- Hosted storage backup/restore, data-integrity reconciliation and failure-injection rehearsals pass.
- Production-like Admin authentication, authorization, session expiry/revocation, rate limiting and secret configuration pass.
- JARVIS gateway and paid-fallback policy are verified without exposing credentials or private profile context.
- SEO, sitemap/robots, 404 behavior, WCAG 2.2 AA, responsive behavior and performance budgets are accepted.
- Artifact provenance, SBOM, checksums, policy authenticity, package verification and rollback instructions are recorded.
- Owner completes four-profile content/asset sign-off and separately approves release.

Validation is authorized on `new` for this maturity initiative. This does not authorize production probing, deployment, Nexus publication or release. Latest exact-head run #617 failed typecheck; see [TESTING.md](TESTING.md) and [PROJECT_STATUS.md](PROJECT_STATUS.md).
