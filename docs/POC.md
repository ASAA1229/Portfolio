# Portfolio POC — Project Overview, Implementation Status and Remaining Work

**Repository:** `ASAA1229/pixel-perfect-pixel`  
**Active documentation/development branch:** `new`  
**Status snapshot:** 2026-11-07  
**Overall status:** IN PROGRESS — substantial portfolio and DevOps source implementation exists; runtime verification, quality acceptance and production release are incomplete.

## Documentation status checkpoint — 2026-11-07 (authoritative)

- **Development:** STOPPED by owner instruction. Only project documentation is being updated.
- **Testing/validation:** PAUSED. No tests, build, lint, browser checks, CI/Jenkins runs, artifact verification or deployment were performed for this refresh.
- **Implemented in source, not verified:** four-profile portfolio foundations; shared profile/section rendering; profile-aware AI context/chat and stream cancellation; published-resume normalization and selected section precedence; asset/profile integrity checks; admin resume/image upload foundations and improved multipart handling/diagnostics; provenance, SHA-256, archive/customer verification, SBOM/signing and release-disposition utilities.
- **Partially implemented:** complete route/content consistency, admin security and resume/image lifecycle, AI provider/runtime behavior, responsive/accessibility behavior, and operational CI/artifact workflows.
- **Known open issue:** the previously reported `/admin/images` 404 has not been confirmed resolved. Recent upload-related source fixes do not substitute for a browser/API check.
- **Not complete:** full route matrix and four-profile content acceptance, secure admin publish/unpublish/rollback lifecycle, complete accessibility/performance/SEO review, exact-head CI and artifact acceptance, and production release.
- No story is accepted until its criteria are evidenced on the exact branch revision. Test files and source changes alone are not acceptance evidence.

## Current documentation and development control — 2026-11-07

**Current activity: DOCUMENTATION ONLY.** Feature development is stopped at the owner's request. Do not start another epic or modify application behavior during this documentation phase.

### What this product is

A multi-profile personal portfolio website designed to present four people — Abhishek, Amulya, Anjini and Sai — through one shared cinematic interface. Visitors can select a profile and explore biography, skills, projects, experience, education, certifications and contact information. The product also contains profile-aware AI introduction/chat foundations and an owner-only admin area intended to manage resumes and profile images through controlled review and publishing.

The repository additionally contains portfolio-focused CI/artifact-integrity tooling (provenance, manifests, SHA-256 verification, SBOM/signing foundations and release disposition records). This is not the separate CMM configuration-tool project.

### Current source implementation inventory

| Capability | What is present in source | Classification |
|---|---|---|
| Four-profile portfolio | Shared application, profile data, profile media and profile-specific content foundations for Abhishek, Amulya, Anjini and Sai | PARTIALLY IMPLEMENTED — NOT VERIFIED |
| Shared visual experience | Cinematic layout, shared components, profile selection and responsive styling foundations | PARTIALLY IMPLEMENTED — NOT VERIFIED |
| Profile sections | About, Skills, Projects, Experience, Education, Certifications and Contact page/content foundations | PARTIALLY IMPLEMENTED — NOT VERIFIED |
| Published resume content | Shared profile-scoped normalization/rendering path; Abhishek's five section pages prefer valid published resume data and fall back to curated content; other profiles use the shared profile-aware renderer | IMPLEMENTED IN SOURCE — NOT VERIFIED |
| AI introduction/chat | Server-side OpenAI integration, approved profile-scoped resume context, streaming/cancellation safeguards and offline fallback foundations | IMPLEMENTED IN SOURCE — NOT VERIFIED |
| Voice/video introduction | Optional narration/video and interaction foundations | PARTIALLY IMPLEMENTED — NOT VERIFIED |
| Admin access and management | Admin route/auth, resume/image upload and management foundations | PARTIALLY IMPLEMENTED — NOT VERIFIED; latest upload 500s remain open |
| Automated quality checks | Test files, regression checks, build/lint/test scripts and CI definitions | AUTHORED / CONFIGURED; EXECUTION PAUSED |
| Artifact integrity | Provenance manifest, SHA-256 checks, archive-backed verification, customer reports, SBOM/signing foundations and quarantine/recovery records | IMPLEMENTED IN SOURCE — NOT VERIFIED |
| Accessibility, performance and SEO | Some foundations and metadata exist | INCOMPLETE — systematic implementation/review remains |
| Production release | Release controls and documentation foundations | NOT RELEASE-READY; no deployment authorization |

### Latest admin upload incident

Latest reported browser errors:
- `POST /api/admin/images` — HTTP 500.
- `POST /api/admin/resumes` — HTTP 500.

Source changes now validate multipart resume files without relying solely on cross-runtime `instanceof File` and return structured server diagnostics. The admin image and resume screens display optional server diagnostic details. The underlying storage, bucket, database or indexing failure has not been identified from a successful retry. Both upload stories remain OPEN and must not be marked fixed.

Related commits on `new`: `4b185ffa1e913472606685da8750d673e80d57c7`, `d3f39d94f412f7e246d94cec0c3b23b786d52ae1`, `f9d3e58151cf4869cc9b9b9d3b20f268c2d9c456`.

### What is developed versus what is not

**Implemented in source, but not tested/accepted:** profile-aware portfolio foundations; selected published-resume integration; AI context and streaming safeguards; asset-integrity checks; artifact provenance, manifest/checksum/archive verification and release-disposition tooling.

**Partially implemented:** all-profile content/visual consistency; complete route/legacy compatibility; voice/video behavior; secure admin lifecycle; resume/image review and publishing; responsive/accessibility/SEO/performance work.

**Not complete / not yet implemented as an accepted capability:** full end-to-end admin authorization and upload lifecycle; reliable image/resume storage and publish/unpublish/rollback; complete browser acceptance for every profile and route; full accessibility/performance/SEO acceptance; production release and deployment.

**Testing state:** tests, builds, lint, browser checks, audits and CI/Jenkins runs remain paused by owner instruction. No current-head pass is claimed. Existing test files are evidence that checks were authored, not that they passed.

## Read this first — what this project is

This project is a cinematic, Netflix-inspired multi-person portfolio website for four profiles: Abhishek, Amulya, Anjini and Sai. It provides a shared visual system with profile-specific identity, biography, skills, projects, experience, education, certifications and contact information.

It also includes an optional profile-aware AI introduction/chat experience, optional narration/video, and a protected owner-only administration workflow intended to manage profile resumes and images through review and publishing.

**The portfolio's purpose is to present accurate, approved profile information.** AI responses and resume-derived information must remain grounded in the selected profile's approved data. Private resume originals, review notes, admin records and API credentials must never become public.

## Status vocabulary used in this POC

| Status | Meaning |
|---|---|
| **IMPLEMENTED — NOT VERIFIED** | Source implementation is present, but relevant tests, browser checks or operational acceptance have not been run on the current branch head. |
| **PARTIALLY IMPLEMENTED — NOT VERIFIED** | Some pages, data paths or foundations exist; important integration, security, consistency or acceptance remains incomplete. |
| **NOT IMPLEMENTED** | No complete implementation is currently evidenced; it remains development work. |
| **VERIFIED** | The exact current branch revision has passed the relevant checks and acceptance evidence is recorded. No new item is marked VERIFIED by this documentation refresh. |

A route/component or test file existing does not prove the page works in a browser. A successful build alone does not prove profile correctness, admin security or release readiness.

## Current status at a glance

| Area | What exists in source | Current status / what remains |
|---|---|---|
| Product and four profiles | Shared portfolio application and profile-specific content/media for Abhishek, Amulya, Anjini and Sai | Partially implemented; full four-profile content and visual consistency review remains |
| Design system and responsive UI | Cinematic shared layout, profile selector, section pages, reusable components and responsive styling foundations | Partially implemented; desktop/tablet/mobile and accessibility acceptance not run |
| Routes and content | Profile/section routes, project content, shared profile renderer and published-resume section precedence | Partially implemented; route matrix, direct refresh, legacy links and all-profile correctness remain unverified |
| AI introduction and chat | Server-side AI integration foundations, profile-scoped approved-resume context, streaming/cancellation handling and offline fallback | Implemented in source in key paths; provider, privacy and all-profile runtime behavior not verified |
| Admin, resume and images | Admin route/auth foundations, resume/image management components, resume/image upload handlers and published-resume workflow foundations | Partially implemented; latest image and resume upload attempts returned HTTP 500. Diagnostic response handling was improved in source, but the underlying storage/persistence failure is not confirmed fixed; full authorization and upload-to-publish acceptance remain open |
| Quality engineering | Regression tests and CI definitions exist; some asset, profile and AI checks are authored | Testing is paused; no current exact-head test/build/lint/browser/CI pass is claimed |
| Accessibility, performance and SEO | Some responsive/accessibility and metadata foundations | Not fully implemented or accepted; systematic audits/reviews remain |
| Shared DevOps and artifact integrity | Provenance manifest, SHA-256 checks, SBOM/signing foundations, archive-backed customer verification and release quarantine/recovery records | Source implementation present; exact-head workflow/package acceptance is pending; Nexus publishing disabled |

## What is developed but not yet tested

The current `new` branch contains source implementation for the four-profile experience, shared section rendering, profile-aware AI context, streaming and cancellation safeguards, published-resume content precedence, profile asset integrity checks, and shared DevOps/artifact-integrity utilities.

The latest recorded portfolio increment (2026-11-07) makes Abhishek's Skills, Projects, Experience, Education and Certifications pages prefer valid published resume sections, while retaining curated static content as fallback. Recent same-day source increments also align section navigation with published content and harden admin resume/image multipart upload handling with clearer diagnostics; these changes remain runtime-unverified. The shared published-resume panel receives normalized profile-scoped data from its caller. Other profiles continue through the shared profile-aware renderer with static fallback.

The DevOps implementation includes provenance and release identity, manifest and SHA-256 validation, archive-backed `.tar.gz` verification, structured customer verification reports, SBOM/signing foundations, and operator-invoked quarantine/recovery evidence records. These are source-level implementation claims, not evidence of successful pipeline execution.

**No tests, build, lint, browser checks, route matrix, CI/Jenkins run, artifact acceptance or deployment were performed for this documentation refresh. Testing remains paused.**

## Known issue intentionally paused

Historical issue: the owner previously reported `GET /admin/images` returning HTTP 404. Later upload attempts produced `POST /api/admin/images` and `POST /api/admin/resumes` HTTP 500 responses. Diagnostic/error-handling changes were committed on `new` (see the current upload incident section above). These changes improve error visibility and address a possible multipart File validation issue; they do not prove the storage/persistence root cause is fixed. The upload issue remains OPEN pending a user retry and the resulting server diagnostic.

## Not yet developed or not complete

- Complete, verified route coverage for all profiles, section pages, project details, direct URL loads, refreshes, legacy routes and mobile navigation.
- Full visual consistency and content accuracy review across all four profiles.
- Complete secure admin lifecycle: authentication/authorization on every operation, upload validation, profile assignment, review, publish, unpublish, rollback and failure recovery.
- Resolution and browser verification of the paused `/admin/images` 404.
- Complete AI provider failure-path acceptance, profile-switch behavior and privacy review.
- Full keyboard/screen-reader, reduced-motion, responsive, performance and SEO acceptance.
- Exact-head clean install/build/lint/unit/browser/CI evidence. Testing is paused by owner instruction.
- Operational Jenkins/GitHub Actions artifact acceptance, release rollback/recovery exercise and production readiness.
- Nexus publication or production deployment. Both remain disabled unless separately approved.

## Scope boundaries

This repository is the portfolio product. CMM-specific shared pipeline configuration tooling, customer environment snapshot utilities and on-site change-detection products are separate DevOps workstreams, not portfolio application features. The portfolio's own artifact-integrity/CI implementation is included under PORT-E08.

## Verification policy and current pause

**Development is currently stopped at the owner's request while the POC and user-story documentation is refreshed. Testing remains paused.** Do not run tests, builds, lint, audits, browser checks, CI/Jenkins workflows, deployment or Nexus operations until explicitly resumed. Do not describe unexecuted checks as passed.

## Branch and safety rules

- `main` is production-protected and is never updated automatically.
- `dev` is the integration branch; approved pull requests from development branches target `dev`.
- `new` is the current feature/development branch; `fix` is for authorized fixes; `test` is for testing/audit work.
- No PR, merge, deployment, Nexus publication or production change without explicit authorization.
- Secrets and API keys stay in local/server environment configuration and must not be committed.

---

## Historical implementation notes

The historical notes below are retained as supporting implementation history. The current project overview, status classification, remaining work and verification pause at the beginning of this document take precedence over older snapshots.

---

## Development increment — Amulya primary image consistency

**Implementation commit:** `a5193395e9ed971e8b52c4028dcf021035f3b886`  
**Status:** IMPLEMENTED / TEST-AUTHORED / CI PENDING

- Updated Amulya's profile-selector avatar and portfolio hero portrait to use the approved `amulya_main.webp` asset consistently.
- Added regression checks for the four unique profile identifiers, matching Amulya selector/portfolio portrait paths, and unique project slugs within each profile.
- Confirmed the referenced image filename exists in the inspected `new` branch asset tree.
- Exact-head CI and browser visual acceptance have not yet been verified.

## CI failure triage — build fix present, rerun pending

The latest surfaced portfolio CI runs (`41890590523` and `41890590434`) are for an earlier commit, not the current `new` head. The build failed with an adjacent-JSX-elements parse error in `src/components/PersonPortfolio.tsx`; the existing branch history includes a fragment-wrapping correction (`7ca96540009994a65215917bd7353ddd5aa5e63e`).

The current development increment also aligns Amulya's selector avatar and hero portrait to `amulya_main.webp`, and adds profile identity/project-slug regression coverage.

**Not yet verified:** no successful Actions run has been observed for the current `new` head. Run build, lint, Vitest, Node integrity tests and artifact verification on the exact current commit before calling this epic accepted.

## Development increment — profile asset integrity

**Implementation:** `src/test/portfolio-rules.test.ts`  
**Status:** TEST-AUTHORED / EXECUTION PENDING

- Added a local filesystem regression test that enumerates avatar, portrait and gallery references across the profile directory and portfolio records.
- Missing files fail with their public asset paths, without requiring network access.
- Added route-data alignment coverage for supported profile IDs and unknown profile handling.
- Test execution and exact-head CI remain pending.

## Development increment — published resume payload normalization utility

**Implementation:** `src/lib/published-resume.ts`, `src/test/portfolio-rules.test.ts`  
**Status:** UTILITY IMPLEMENTED / TEST-AUTHORED / UI INTEGRATION PENDING

- Added a pure normalizer for the published-resume API payload. It accepts only records for the requested profile and validates bounded IDs, display names, headlines, summaries and skill strings.
- Limits skills to 20 entries and 80 characters each; malformed records and unexpected payload shapes are ignored.
- Added regression coverage for cross-profile leakage, malformed fields, non-string skills, oversized skills and unexpected API responses.
- The existing profile UI consumer has not yet been switched to this helper; do not treat this increment as fully integrated until that wiring and exact-head test execution are complete.


## Development increment — AI profile context and streaming reliability

**Branch:** `new`  
**Status:** IMPLEMENTED / RUNTIME VERIFICATION PENDING

- The Worker attaches only the latest matching profile record from the approved published-resume feed to portfolio chat requests. Client-supplied resume context is not trusted; private drafts and review notes are excluded.
- The chat API uses the approved resume context only when its profile ID matches the selected profile. Prompt guidance treats resume content as untrusted data and prohibits invented facts.
- Request-size limits are preserved when approved context is attached; oversized enriched requests fail safely.
- AI chat, profile assistant and introduction streaming now flush trailing UTF-8 decoder bytes so final partial characters are not silently lost.
- The chat server processes a final buffered server-sent event even when the stream ends without a newline.
- Assistant request cancellation and overlapping-request handling were hardened so stale requests cannot overwrite newer chat state or continue speaking after cancellation.
- The offline assistant fallback is now displayed in the conversation rather than leaving the UI in a thinking state.

Relevant implementation commits include `1a082657`, `4c8e7823`, `27a3dc2f`, `4ac17edf`, `119d514b`, `c05a13b`, `390c757e`, `d714c7c3` and `b87b1143`.

## Development increment — release integrity and on-site snapshot safeguards

**Branch:** `new`  
**Status:** IMPLEMENTED / TEST AND BUILD EXECUTION PAUSED

- CI branch, source-commit and build-number metadata handling was aligned across supported GitHub Actions and Jenkins variables.
- Customer release verification now uses the shared provenance helpers and rejects drive-relative or drive-prefixed manifest inventory paths in addition to unsafe paths, duplicate entries and invalid SHA-256 values.
- On-Site Change Detection validates inventory schema, file counts, safe paths, unique file entries, safe sizes and SHA-256 checksums before comparison.
- Snapshot comparison rejects mismatched ignore policies. Ignore paths are now deduplicated and sorted, so equivalent policies compare consistently regardless of input order.
- These scripts are supporting integrity utilities in the repository; CMM-specific customer pipeline/Nexus configuration remains outside the portfolio product scope.

Relevant latest commits: `b8d760f7`, `6503eebb`, `0d35110f`, `f18b1cb2` and `7f573f53`.

**Verification note:** automated tests, lint and production build remain unexecuted because verification was paused. Do not mark these increments TEST-PASSED or ACCEPTED until they are run against the exact branch head.

## Shared DevOps pipeline and artifact integrity — 2026-11-05

**Status: IMPLEMENTED IN SOURCE / PIPELINE AND RELEASE ACCEPTANCE PENDING**

The `new` branch includes the portfolio side of the shared DevOps baseline:
- Build provenance manifest and deterministic release identity, including project, repository, branch, commit, build number and CI provider/run metadata.
- SHA-256 manifest/checksum verification and customer-package verification policy.
- CycloneDX dependency SBOM generation and artifact packaging in GitHub Actions/Jenkins pipeline foundations.
- Scoped signing credentials, temporary signing-key cleanup, and fail-fast pipeline command handling.
- Strict validation of project identity, recognized CI provider and source/build metadata against current environment values.

**Completed in the current development increment:** the customer verifier now validates release-manifest metadata before trusting inventory entries. It checks schema/algorithm, project identity, source metadata, timestamp, exact file count, artifact filename/size/SHA-256, unique safe inventory paths, per-file sizes and digests, and optional release-identity format. The authenticated policy's project and source commit/build identity must match the manifest. Policy creation also refuses to proceed if the supplied package's filename, size or SHA-256 differs from the manifest.

**Completed in the latest source increment:** customer verification now inspects the actual `.tar.gz` archive, rejects unsafe member paths and unsupported entry types (including links), extracts into an isolated temporary directory, and compares the extracted archive inventory with the authenticated manifest using per-file size and SHA-256. GitHub Actions and Jenkins verification calls now pass the archive itself; the verifier no longer trusts an independently supplied extracted directory. The implementation relies on the system `tar` utility being available on the agent.

**Completed in the latest increment:** failures now emit a machine-readable `CUSTOMER_RELEASE_REPORT` JSON record with status, validation stage, stable failure code and a safe diagnostic message. Archive inventory mismatches include a bounded discrepancy preview and total count. The CLI persists the report as `customer-release-report.json`; GitHub Actions retains it on failure for 14 days, while Jenkins archives it when present. Successful GitHub release artifacts are retained for 14 days; Jenkins archives the verified bundle with fingerprints and keeps the latest 20 builds according to its build discarder. Failed verification prevents the successful-bundle archive stage from running. **Remaining:** document operator rejection/quarantine and rollback/recovery procedures, and execute exact-head pipeline/package acceptance when validation resumes. Nexus publishing remains explicitly paused and disabled. No tests, builds, CI runs, audits, or Nexus publishing were performed for this snapshot.

**Latest implementation commits:** `636562c8`, `99632acb`, `ab7d56ce`, `4e5f4fcf`, `7e3ffeb1`, `5bf78bd7`.

See [docs/EPICS.md](EPICS.md) and [docs/USER_STORIES.md](USER_STORIES.md) for the DevOps delivery backlog.


## PORT-E08 development increment — release rejection, quarantine and recovery

**Branch:** `new`  
**Status:** IMPLEMENTED IN SOURCE / RUNTIME VERIFICATION PENDING

- Fixed release-index checksum sidecar parsing: artifact and manifest-ignore policy checksums are now parsed and compared against the indexed file name and SHA-256.
- Corrected release-index JSON newline output and included the optional deterministic release identity.
- Added an operator-invoked disposition CLI. `quarantine` validates the release index, all six evidence files, manifest provenance, artifact metadata and checksum sidecars before writing an create-only JSON event record.
- `recover` validates a quarantine record and a distinct known-good release for the same project, verifies the known-good evidence, and records its artifact fingerprint plus the quarantine-record hash.
- Both commands fail closed. They do not move artifacts, promote releases, change branches, deploy, roll back environments or publish to Nexus. Recovery explicitly requires separate owner approval.
- Procedure: [Release rejection, quarantine and recovery](release-rejection-quarantine-recovery.md).

No tests, builds, CI/Jenkins executions or rollback actions were performed; validation remains paused.


## PORT-E02 development increment — published resume content precedence (2026-11-07)

**Branch:** `new`  
**Status:** IMPLEMENTED IN SOURCE / RUNTIME VERIFICATION PENDING

- Updated the shared `PublishedResumePanel` to receive the normalized resume from its page instead of issuing a duplicate request.
- Abhishek's Skills, Projects, Experience, Education and Certifications pages now prefer the latest published resume section when valid entries exist. Curated portfolio content remains the fallback when no published section is available.
- This avoids displaying a new published section alongside an outdated static list for the same section.
- Amulya, Anjini and Sai continue to use the shared profile-aware `PersonContent` renderer, with profile matching and static fallback behavior.

No tests, builds, lint, browser checks or route-matrix verification were performed; validation remains paused.
