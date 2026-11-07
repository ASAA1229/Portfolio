# Portfolio POC — Scope, Current State and Remaining Work

**Repository:** `Guda-Abhishek/pixel-perfect-pixel`  
**Branch:** `new`  
**Review date:** 2026-11-05  
**Status:** IN PROGRESS — documentation baseline; release acceptance remains open.

## 1. Product vision

Build a cinematic, Netflix-inspired, multi-person portfolio experience for Abhishek, Amulya, Anjini and Sai. The experience should present each person's verified profile information through a consistent shared design system, with dedicated pages for About, Skills, Projects, Experience, Education, Certifications and Contact.

The product also includes an optional AI portfolio introduction/chat, a video-backed introduction, and a protected owner-only admin workflow for maintaining profile content, resumes and images.

## 2. Product scope

### In scope
- Four separate profile experiences with correct identity, facts, media and routes.
- Shared components, navigation, typography, layout and styling across profiles.
- Responsive cinematic pages and project detail experiences.
- Profile-aware AI introduction/chat grounded in approved portfolio data.
- Optional user-started intro narration/video with accessible controls.
- Protected admin login and resume/image upload, review, publishing and rollback.
- Secure server-side API handling, accessibility, performance and SEO.
- Automated build, lint, unit/integration and browser acceptance checks.

### Out of scope for this portfolio
- Shared DevOps/CMM pipeline configuration tooling.
- Customer environment snapshot utilities and on-site change detection products.
- External customer package validation workflows or CMM-specific Nexus release management.
- Any feature that exposes private resumes, credentials or admin data publicly.

## 3. Current technical baseline

Repository source inspection indicates the application uses:
- React, TypeScript, TanStack Start/Router, Vite and Tailwind CSS.
- Shared profile/page components and profile-specific data modules.
- Route-driven profile pages and project/section routes.
- Server-side chat/API handling using the OpenAI Responses API.
- Admin authentication and resume/image management routes.
- Vitest/Testing Library, ESLint, Prettier and GitHub Actions configuration.

The repository also contains build/artifact-integrity and Jenkins-related automation. Treat these as supporting delivery infrastructure only; they are not the portfolio's customer-facing product scope. A workflow definition or source file does not prove a successful external Jenkins or deployment run.

## 4. Existing capabilities observed

- Four profile identities and profile-specific data structures are present.
- Shared cinematic visual foundations and reusable page components exist.
- Profile, section and project routes are implemented.
- AI chat/introduction components and a server-side API route exist.
- Admin login, resume and image workflows have implementation in the source tree.
- Resume-derived structured content supports review before publication.
- Accessibility and security hardening changes are present in source.
- Automated tests and CI configuration exist.

**Important:** these are implementation observations, not a claim that every workflow is fully tested or accepted. Current runtime behavior, content accuracy, external integrations and production readiness must be verified against the exact branch commit.

## 5. Remaining work — prioritized

### P0 — Establish a trustworthy baseline
- [ ] Run a clean dependency install on branch `new`.
- [ ] Run production build, lint and the complete automated test suite.
- [ ] Capture exact commit SHA and command outputs; fix all failures.
- [ ] Inspect TypeScript errors, route generation, imports/exports and runtime warnings.
- [ ] Review open CI failures and ensure the workflow checks the intended branch/PR events.

### P0 — Security and privacy
- [ ] Verify server-side authentication and authorization for every admin loader, action and API.
- [ ] Verify session expiry, logout, invalid-session handling and unauthorized access.
- [ ] Exercise resume/image upload type, size, content, filename and parser failure cases.
- [ ] Verify private files and review notes cannot be fetched from public routes.
- [ ] Verify AI credentials remain server-side and are absent from client bundles, logs and error responses.
- [ ] Verify request validation, rate limits, error redaction and safe failure behavior.

### P1 — Four-profile consistency
- [ ] Compare Abhishek, Amulya, Anjini and Sai page-by-page against the approved shared design.
- [ ] Keep one shared styling system; remove unintended profile-specific CSS/layout drift.
- [ ] Verify profile facts, social links, project links, resume actions and images.
- [ ] Confirm profile switching never leaks data or assistant context between people.
- [ ] Verify missing media and optional data use graceful fallbacks.

### P1 — Routes and navigation
- [ ] Test every profile and section route with direct URL load, in-app navigation and refresh.
- [ ] Verify project detail slugs, education routes, 404 handling and legacy route compatibility.
- [ ] Verify active navigation, mobile menu, footer and all internal/external destinations.
- [ ] Fix dead links, route mismatches and inconsistent page metadata.

### P1 — AI introduction, chat and video
- [ ] Verify AI responses use only the selected profile's approved/current data.
- [ ] Verify unknown facts are acknowledged and never fabricated.
- [ ] Test missing/invalid API key, timeout, provider errors, cancellation and rate limiting.
- [ ] Test voice permissions, unsupported browser fallback and explicit user-started playback.
- [ ] Verify video play/pause/replay, cleanup, mobile fallback and reduced-motion behavior.
- [ ] Confirm the intro never starts audio unexpectedly.

### P1 — Admin content lifecycle
- [ ] Verify resume upload → extraction → manual review → draft → publish → unpublish/rollback.
- [ ] Verify image upload → review → publish → unpublish/rollback.
- [ ] Confirm profile assignment is mandatory and all public content is filtered by profile.
- [ ] Verify partial failures do not leave inconsistent public/private state.
- [ ] Confirm existing verified portfolio facts are not silently overwritten by extracted resume data.

### P1 — Responsive design and accessibility
- [ ] Check desktop, tablet and mobile layouts for all four profiles.
- [ ] Verify keyboard-only navigation, visible focus, dialog focus management and Escape behavior.
- [ ] Check semantic headings, labels, accessible names, alt text and color contrast.
- [ ] Verify reduced-motion preference and avoid forced autoplay.
- [ ] Check image loading, overflow, typography, spacing and long-content behavior.

### P2 — Performance, SEO and release
- [ ] Review route-level loading, image optimization, bundle size and runtime performance.
- [ ] Verify page titles, descriptions, canonical URLs, sitemap/robots and social previews.
- [ ] Validate production environment configuration without exposing secrets.
- [ ] Run browser-based end-to-end acceptance for all critical journeys.
- [ ] Record known limitations and obtain explicit owner approval before production release.

## 6. Acceptance evidence rules

Use these distinct statuses:
- **IMPLEMENTED** — source implementation exists.
- **TEST-AUTHORED** — automated test exists.
- **TEST-PASSED** — test executed successfully against the stated commit.
- **BROWSER-VERIFIED** — real-browser scenario passed and evidence is recorded.
- **ACCEPTED** — owner-approved behavior and release criteria are satisfied.
- **BLOCKED** — dependency or missing input prevents completion; record the owner and next action.

Do not mark a task complete merely because code or a test file exists. Record commit SHA, command/workflow, result and any limitation.

## 7. Working rules

- All work for this task is limited to branch `new`.
- Do not merge, raise PRs, push to other branches or deploy unless separately authorized.
- Do not commit API keys, credentials, private resumes or personal source documents.
- Keep shared layout/styling consistent across all four profiles.
- Treat extracted resume content as untrusted until reviewed and explicitly approved.
- Preserve user-provided facts; do not invent profile details or media assets.

## 8. Definition of done

The portfolio is ready for owner acceptance when P0 security and baseline checks pass, all four profiles and their routes work consistently, AI/admin workflows respect profile and privacy boundaries, responsive/accessibility checks pass, and the exact release candidate has successful CI and browser evidence. Production release still requires explicit owner approval.

See [EPICS.md](EPICS.md) for delivery workstreams and [USER_STORIES.md](USER_STORIES.md) for testable acceptance criteria.

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
