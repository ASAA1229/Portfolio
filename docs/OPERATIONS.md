# Operations Guide

## Environment and deployment
Keep local development, CI, staging and production separate. Configure public origin, storage bindings and AI secrets in the hosting environment. JARVIS must be reachable only through an owner-approved HTTPS gateway; keep the primary personal JARVIS port private. Deployment requires explicit owner approval and successful exact-head gates.

## Backup, restore and recovery
- Backups include every private/public binary referenced by persisted indexes plus metadata and integrity data.
- Incomplete backups fail closed; restore/migration must not write destination keys from incomplete payloads.
- Recovery journals preserve pre-mutation snapshots and support replay of interrupted operations where implemented.
- Admin recovery requires authenticated owner confirmation.
- Multi-object writes take a conditional-write storage lease (private-admin/recovery/lease.json). If an isolate dies mid-operation its lease expires after 120 seconds; until then writes fail with a retryable "another storage operation is in progress" error. Hosted R2 conditional-write behaviour has not been rehearsed.
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
A commit/PR does not prove deployment readiness. Record exact SHA, CI/Jenkins run, build/test/typecheck/lint results, artifact identity, environment, storage checks, backup/restore evidence and owner approval. Validation is authorized on `new` under the ASAA maturity initiative; production operations, deployment, Nexus publication and release remain separately gated.


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

Validation is authorized on `new` for this maturity initiative. This does not authorize production probing, deployment, Nexus publication or release. Latest observed candidate run [#43420111801](https://github.com/ASAA1229/Portfolio/actions/runs/43420111801) failed typecheck with 15 diagnostics in 5 files; build and SBOM passed, lint/tests/artifact verification skipped. See [TESTING.md](TESTING.md) and [PROJECT_STATUS.md](PROJECT_STATUS.md).


## External configuration still required before staging or production (2026-11-14)

None of the following has been created, bound or verified; they require the owner and a Cloudflare environment. This initiative did not deploy, provision or probe any hosted resource.

| Item | Needed value |
|---|---|
| Worker deployment | Owner-approved Cloudflare account, route/domain and a staging Worker (wrangler.jsonc currently names `pixel-perfect-pixel` with an R2 binding only) |
| R2 bucket | `RESUME_BUCKET` bound to a private bucket (`portfolio-private-resumes` in wrangler.jsonc); separate staging and production buckets |
| Secrets | `PORTFOLIO_ADMIN_PASSWORD` (12+ characters), `PORTFOLIO_ADMIN_SESSION_SECRET` (32+ bytes); rotation procedure and owner custody |
| Shared throttle (optional, recommended) | Workers KV namespace bound as `LOGIN_RATE_LIMIT_KV` for cross-region login and chat throttling; R2 is used when absent |
| AI gateway (optional) | `JARVIS_AI_URL` (HTTPS) and `JARVIS_AI_KEY` as secrets; `PORTFOLIO_AI_ALLOW_PAID_FALLBACK=true` with `OPENAI_API_KEY` only with explicit owner opt-in |
| Public origin | `VITE_SITE_URL` at build time for canonical URLs and sitemap |
| Runtime flag | Worker compatibility date with `nodejs_compat` so `process.env` carries the AI secrets (current date 2026-10-31 qualifies) |
| CI | Observed GitHub Actions run of the pushed SHA; a Jenkins Windows agent run; Nexus only with approval |
| DR | Restore drill into an isolated bucket with measured RPO/RTO; monitoring and alert destinations |
| Branch governance | Branch protection and required checks (owner action) |

Local rehearsal commands: `npm run verify`; `NITRO_PRESET=node-server npm run build` then `PORT=4173 node .output/server/index.mjs` and `npm run check:browser -- http://localhost:4173`.
