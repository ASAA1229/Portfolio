# Portfolio — Epic Register and Delivery Plan

**Repository:** `ASAA1229/Portfolio`  
**Branch:** `new`  
**Status:** OPEN until acceptance criteria have evidence. **Current per-epic status (Done / Needs testing / Pending development, 2026-11-07) is maintained in [POC.md §2](POC.md#2-status-at-a-glance); epic-level status lines below are historical.**

See [POC.md](POC.md) for product scope/current state and [USER_STORIES.md](USER_STORIES.md) for detailed user stories.

## Delivery principles
- One shared design system across Abhishek, Amulya, Anjini and Sai.
- Profile facts and resume-derived content must be accurate, profile-scoped and reviewed.
- Admin data and API credentials remain private/server-side.
- Distinguish implementation from executed test and owner acceptance.
- No merge, PR or deployment without explicit approval.

## Epic overview

| ID | Epic | Priority | Outcome |
|---|---|---:|---|
| PORT-E01 | Shared Design System and Four-Profile UI | P1 | Consistent cinematic experience across all four profiles |
| PORT-E02 | Routes, Navigation and Portfolio Content | P0 | Correct, complete and reliable profile/section navigation |
| PORT-E03 | AI Introduction and Portfolio Chat | P1 | Grounded, profile-aware assistant with safe failure behavior |
| PORT-E04 | Admin, Resume and Image Management | P0 | Secure owner-managed content lifecycle |
| PORT-E05 | Quality Engineering and Automated Testing | P0 | Repeatable build, lint, unit and browser quality gates |
| PORT-E06 | Accessibility and Responsive Experience | P1 | Inclusive and usable experience across devices |
| PORT-E07 | Performance, SEO and Production Readiness | P2 | Fast, discoverable and supportable portfolio release |

## PORT-E01 — Shared Design System and Four-Profile UI
**Goal:** Deliver a cohesive Netflix-inspired portfolio while preserving each person's distinct identity and approved content.

**Remaining work**
- Compare all four profiles across Home, About, Skills, Projects, Experience, Education, Certifications and Contact.
- Standardize shared CSS/tokens, layout, typography, spacing, cards, buttons and responsive behavior.
- Remove unintended profile-specific visual overrides and duplicated components.
- Verify supplied images, crop/focal point, alt text, fallback and licensing/attribution where applicable.

**Exit criteria**
- All four profiles use the same shared layout and visual rules.
- Differences are limited to intentional profile content/media.
- Desktop/tablet/mobile visual review is recorded and accepted.



## 2026-11-09 development update — PORT-E02

**Status:** IMPLEMENTED IN SOURCE — TESTING PAUSED. `src/routes/people.$person.projects.$slug.tsx` now throws the route-level `notFound()` result when a syntactically valid project slug is absent from the merged profile data. This changes the missing-project path from an unavailable component rendered under HTTP 200 to the configured route not-found boundary. Exact HTTP 404 behavior, including CMS-published project slugs and all four profile routes, still requires verification after testing resumes.

## PORT-E02 — Routes, Navigation and Portfolio Content
**Goal:** Ensure all portfolio content is reachable, correct and isolated by profile.

**2026-11-12 implementation update — PORT-US-043:** root About/Home/Skills/Projects now consume the corresponding published CMS fields, including custom skill groups, new/archived projects, contact/location, experience and education. Person-profile basics now include location and safe social destinations. Explicit empty CMS arrays clear managed collections. CMS-created root project slugs render detail pages; archived/unknown slugs reach the not-found boundary. Automated coverage is authored; validation remains paused.

**Remaining work**
- Audit route definitions, generated route tree, loaders/actions and direct URL behavior.
- Verify profile slugs, section routes, project detail slugs and legacy route compatibility.
- Verify navigation active states, mobile menu, footer, internal links and external destinations.
- Check every profile's facts, social links, resume actions and empty/fallback states.

**Exit criteria**
- Route matrix passes direct load, refresh, in-app navigation, invalid route and mobile navigation scenarios.
- No broken links, wrong-profile content or unintended cross-profile data exposure.

### PORT-E02 implementation note — published-resume content precedence (2026-11-07)

**Status:** IMPLEMENTED IN SOURCE / RUNTIME VERIFICATION PENDING

- The shared published-resume section panel now receives the already-normalized, profile-scoped resume from its caller, avoiding a second fetch for the same page.
- Abhishek's Skills, Projects, Experience, Education and Certifications routes now show the latest published section as the primary content when that section contains valid published data; static portfolio content remains the fallback when no corresponding published section exists.
- The other three profile section routes continue to use the shared `PersonContent` renderer and the same profile-scoped resume normalizer, with static profile facts retained as fallback.
- Published content is not mixed with stale static lists for the same section. The hero and page framing remain unchanged.

No build, lint, unit test, browser check or route-matrix run was performed; testing remains paused. Exact-head route acceptance is pending.

## PORT-E03 — AI Introduction and Portfolio Chat
**Goal:** Provide optional introductions and useful chat responses grounded in the selected profile's approved information.

**2026-11-12 implementation update — PORT-US-034/037:** the Worker now attaches only the selected profile’s published CMS document, approved resume and published persona to chat requests. The chat route revalidates CMS content and merges it into profile knowledge; Abhishek’s root prompt receives published CMS basics/sections too. JARVIS remains primary and OpenAI fallback requires explicit `PORTFOLIO_AI_ALLOW_PAID_FALLBACK=true`. Provider response bodies are excluded from application logs. Regression tests cover root and person-profile CMS grounding. Tunnel, hosted integration, provider failure, privacy and cancellation acceptance remain open; no tests were run.

**Remaining work**
- Verify the server-side JARVIS gateway integration, profile scope and server-only key handling; test OpenAI only as an explicit opt-in fallback.
- Ground responses in current, approved profile data; update context when the selected profile changes.
- Prevent invented skills, experience, education, projects or personal details.
- Test missing/invalid key, timeout, rate limit, malformed response, cancellation and offline fallback.
- Verify voice permissions, explicit playback controls, transcript and privacy behavior.

**Exit criteria**
- Assistant answers are profile-aware and fact-grounded.
- Secret and private resume data never enter client bundles or public responses.
- All provider failure states have safe, understandable user feedback.

## PORT-E04 — Admin, Resume and Image Management
**Goal:** Allow the owner to maintain portfolio content through a secure review-and-publish workflow.

**Remaining work**
- Enforce server-side authentication and authorization on every admin route/API/mutation.
- Verify session expiry, logout, CSRF/origin controls and unauthorized behavior.
- Exercise upload validation for supported formats, size, content, filename and parser failures.
- Verify profile assignment, extraction/review, draft, publish, unpublish and rollback.
- Keep original resume files and review notes private; expose only explicitly approved metadata/content.
- Verify image replacement, storage boundaries, partial-failure cleanup and public fallback.

**Exit criteria**
- Unauthorized access and mutation are rejected.
- Resume/image lifecycle passes with correct profile scoping and rollback.
- No private file or secret is accessible from public pages.

## PORT-E05 — Quality Engineering and Automated Testing
**Goal:** Establish reliable, repeatable validation for each candidate commit.

**Remaining work**
- Run clean dependency install, production build, lint and all configured tests.
- Fix TypeScript, route generation, import/export and runtime errors.
- Add regression coverage for profile isolation, routes, admin authorization, uploads and AI failure paths.
- Run browser E2E checks for key journeys and all four profiles.
- Link results to exact commit SHA and resolve CI failures.

**Exit criteria**
- Required CI checks pass on the exact candidate commit.
- Critical user journeys have automated and browser-level evidence.

## PORT-E06 — Accessibility and Responsive Experience
**Goal:** Make all profile and admin experiences usable across devices and assistive technologies.

**Remaining work**
- Verify keyboard navigation, focus visibility, dialog focus trap/restore and Escape behavior.
- Audit semantic headings, labels, accessible names, alt text and color contrast.
- Test reduced-motion behavior and user-controlled audio/video.
- Review desktop, tablet and mobile breakpoints, overflow and touch targets.

**Exit criteria**
- Critical journeys are keyboard-operable and have no known blocking accessibility defects.
- Responsive review passes at agreed device sizes; reduced-motion behavior is respected.

## PORT-E07 — Performance, SEO and Production Readiness
**Goal:** Prepare a secure, fast and discoverable portfolio for an approved production release.

**Remaining work**
- Review bundle size, route loading, image optimization, caching and runtime performance.
- Verify page metadata, social previews, canonical URLs, sitemap/robots and error pages.
- Confirm production environment variables and hosting configuration.
- Document release evidence, known limitations and rollback/recovery steps.
- Obtain explicit owner approval before production deployment.

**Exit criteria**
- Performance/SEO review is recorded, production configuration is verified, rollback is documented and owner approval is obtained.

## Recommended execution order
1. PORT-E05 baseline checks and PORT-E02 route/content correctness.
2. PORT-E04 security and admin lifecycle.
3. PORT-E01 four-profile visual consistency.
4. PORT-E03 AI introduction/chat and voice behavior.
5. PORT-E06 responsive/accessibility acceptance.
6. PORT-E07 performance, SEO and production release readiness.

## Development increment — Amulya primary image consistency

**Implementation commit:** `a5193395e9ed971e8b52c4028dcf021035f3b886`  
**Status:** IMPLEMENTED / TEST-AUTHORED / CI PENDING

- Updated Amulya's profile-selector avatar and portfolio hero portrait to use the approved `amulya_main.webp` asset consistently.
- Added regression checks for the four unique profile identifiers, matching Amulya selector/portfolio portrait paths, and unique project slugs within each profile.
- Confirmed the referenced image filename exists in the inspected `new` branch asset tree.
- Exact-head CI and browser visual acceptance have not yet been verified.

## PORT-E01 / PORT-E02 implementation note — profile asset integrity

Automated checks now cover committed avatar, portrait and gallery asset references, plus supported profile-route data alignment. See PORT-US-023. Tests are authored; execution and exact-head CI remain pending.


## PORT-E04 implementation note — published resume payload validation

A pure normalizer and regression tests were added for profile-scoped published-resume highlight data. The UI component has not yet been wired to the normalizer; this is an incomplete hardening increment, not a completed acceptance item. See `src/lib/published-resume.ts` and `src/test/portfolio-rules.test.ts`.


## Additional implementation notes — current development increments

### PORT-E03 — AI profile context and streaming reliability

The Worker now enriches portfolio chat requests from the approved published-resume feed for the requested profile only. The API validates the profile match and treats resume data as untrusted context; private drafts and review notes are not part of the public assistant context. Request-size limits remain enforced. Streaming fixes flush final UTF-8 decoder bytes and process a final buffered SSE event. Request cancellation and overlap handling prevent stale assistant responses from overwriting newer state. Offline fallback answers are now rendered in the conversation.

**Status:** IMPLEMENTED / RUNTIME VERIFICATION PENDING. Related commits: `1a082657`, `4c8e7823`, `27a3dc2f`, `4ac17edf`, `119d514b`, `c05a13b`, `390c757e`, `d714c7c3`, `b87b1143`.

### PORT-E05 — Release integrity and snapshot comparison safeguards

CI provenance helpers now align GitHub Actions and Jenkins source-commit/build-number inputs. Release verification rejects unsafe Windows drive-relative manifest paths. Snapshot inventory comparison validates entries and file counts, enforces matching ignore policies, and canonicalizes ignore paths to avoid order-based mismatches.

**Status:** IMPLEMENTED / TEST EXECUTION PAUSED. Related commits: `b8d760f7`, `6503eebb`, `0d35110f`, `f18b1cb2`, `7f573f53`.

Do not mark either increment TEST-PASSED or ACCEPTED until checks run against the exact branch head. CMM-specific pipeline and Nexus configuration remain outside this portfolio epic register.

## PORT-E08 — Shared DevOps Pipeline, Provenance & Artifact Integrity

**Status:** IN PROGRESS — source implementation present; validation paused; Nexus publishing paused.

**Goal:** Align portfolio artifact production with JARVIS so builds are traceable, verifiable and consistently packaged across GitHub Actions and Jenkins.

**Implemented source scope**
- Build provenance manifest with project, CI and source identity plus deterministic release identity.
- SHA-256 manifest/checksum verification and customer-package verification policy.
- CycloneDX dependency SBOM generation and artifact packaging.
- CI signing/checksum foundations, scoped signing credentials, temporary-key cleanup and fail-fast command handling.

**Remaining development scope**
- Improve archive verifier portability/diagnostics and document the system `tar` prerequisite.
- Complete customer verification stage reporting and failure diagnostics.
- Document CI configuration, secret names, artifact retention and release/rollback handling without storing secrets.
- Retain structured customer-verification failure reports and preserve verified release bundles with traceable build fingerprints.
- Add operator-invoked rejection/quarantine records and known-good recovery-candidate records; keep rollback manual and owner-approved.
- Preserve project-specific workflow differences while keeping shared manifest and verifier contracts aligned with JARVIS.

**Exit criteria**
- Invalid manifests and inconsistent inventories fail closed.
- Archive content matches the declared inventory.
- Customer package verification follows the policy → manifest → package sequence and provides actionable results.
- Exact-head GitHub Actions and Jenkins runs provide artifact, signature, checksum and SBOM evidence.
- Nexus remains disabled unless separately approved; production deployment requires explicit owner approval.

### PORT-E08 implementation note — provenance, signing and strict manifest validation (2026-11-05)

The portfolio artifact-integrity implementation enforces explicit project identity, recognized CI provider, source commit/build metadata and current-environment consistency. Customer package verification now validates manifest schema, timestamp, exact inventory count, safe unique paths, per-file size/SHA-256, artifact metadata and optional release identity before package inventory comparison. Authenticated policy project/source identity must match the manifest. Policy creation refuses package inputs that do not match the manifest filename, size and digest. Windows path separators are normalized correctly before validation.

**Latest implementation commits:** `636562c8`, `99632acb`, `ab7d56ce`, `4e5f4fcf`, `7e3ffeb1`, `5bf78bd7` (archive-backed verification and CI integration).

The customer verifier now inspects `.tar.gz` member names and entry types before extraction, rejects unsafe paths and non-regular entries (including symbolic/hard links), extracts into an isolated temporary directory, and compares the resulting inventory with manifest file paths, sizes and SHA-256 values. GitHub Actions and Jenkins now pass the archive directly to the verifier. This implementation requires the system `tar` utility on the CI agent. Stage-specific failures now emit a machine-readable `CUSTOMER_RELEASE_REPORT` JSON record with status, stage, stable code and diagnostic message; archive inventory mismatches include a bounded discrepancy preview and total count. CI/rollback documentation and exact-head acceptance remain open; pipeline execution and artifact acceptance are pending because testing is paused.


### PORT-E08 implementation note — release disposition and recovery controls

**Status:** IMPLEMENTED IN SOURCE / RUNTIME VERIFICATION PENDING

- Added `scripts/release-index.mjs` checksum-sidecar parsing and validation fixes. The index now records the manifest release identity when present and writes a real newline-terminated JSON document.
- Added `scripts/release-disposition.mjs` with operator-invoked `quarantine` and `recover` commands. Both validate the required release evidence fingerprints before recording a disposition.
- Quarantine records capture the reason, operator, project/release identity, source/CI metadata and evidence hashes. Promotion, deployment and Nexus publication are explicitly blocked; the artifact is not moved.
- Recovery records require a different, same-project known-good release, verify its indexed evidence, link the quarantine record by SHA-256 and explicitly require owner approval. No rollback, branch change, deployment or publication is executed.
- Added [release rejection, quarantine and recovery procedure](release-rejection-quarantine-recovery.md).

Tests, builds, CI/Jenkins runs and operational rollback remain paused/not performed. Do not mark PORT-US-033 accepted until validation is explicitly resumed and evidence is recorded.


## Owner-directed execution update — 2026-11-09 12:22 IST

Inspected `new` head: `3605e922ef469d821e19dde8b5f079799ccedab4`. Development is ACTIVE; testing/validation is PAUSED. Continue the existing epic scope on `new`; do not start tests, builds, typecheck, lint, audits, browser/accessibility checks, CI/Jenkins or release operations. The immediate development focus is resume publication consistency and partial-failure reconciliation, followed by production admin/session and storage boundaries, profile-scoped JARVIS integration, and remaining manager/accessibility gaps.

Maintain four-profile isolation and public/private data separation. JARVIS remains the primary AI provider; paid OpenAI fallback requires explicit opt-in and server-only credentials. Keep zero-cost defaults and secrets out of Git/logs. No PR, merge, push to `dev`/`main`, deployment, production secret changes, artifact publication or Nexus enablement without explicit approval. Nexus remains disabled. Source-only implementation does not close an epic; validation evidence is deferred until testing resumes.


## PORT-US-013 development note — 2026-11-09

The publish-history validator now checks nested contact fields, structured section keys/entries, skill bounds, timestamps, profile ownership and rollback metadata before persisted history is accepted. Targeted malformed-record regression cases have been authored. **Testing remains paused; these tests have not been executed**, and runtime/object-storage partial-failure reconciliation remains open.



## PORT-E04 resume lifecycle increment — 2026-11-09 13:30 IST

The admin experience now includes per-profile append-only publish history and confirmed rollback, plus an authenticated consistency report comparing the public resume feed with the private index. An owner-confirmed reconciliation action can rebuild the public feed from the private index and report missing private original files. This is a recovery aid, not a full multi-store transaction: missing originals are not recreated and partial failures across index/file/feed writes still need compensation/recovery design. PORT-US-013 therefore remains PARTIAL. Regression tests are authored but unexecuted; testing remains paused.


## Test-branch evidence refresh — 2026-11-09

At `test` head `0f90a96c47a1a36826306ca5bd26a1f7b263acfe`, Antigravity's local report records 137/137 runnable tests passing, with one additional Win32 symlink-policy case skipped (22 suites, 138 cases; 100% runnable pass rate, 99.3% executed).

Exact-head [GitHub Actions run #42591418653](https://github.com/ASAA1229/pixel-perfect-pixel/actions/runs/42591418653) passed build, typecheck and SBOM generation but failed ESLint/Prettier in five files; CI consequently skipped automated tests and SBOM upload.

**Epic implications**
- E01–E03 and E05 have useful local automated coverage, but still need exact-head CI and browser acceptance where their exit criteria require it.
- E04 admin/resume/image lifecycle remains OPEN; PORT-US-013 is PARTIAL until cross-store compensation and missing-original recovery are implemented and tested.
- E06 accessibility/responsive work still needs screen-reader, keyboard and device acceptance.
- E07 production readiness remains OPEN pending performance/SEO, production configuration and release/rollback evidence.
- E08 provenance/integrity remains OPEN until exact-head CI completes all gates and produces retained release evidence.

Do not equate local test pass percentage with overall epic completion or mark any epic ACCEPTED while its exit criteria remain unmet.


## Test-branch evidence refresh — 2026-11-09

At `test` head `0f90a96c47a1a36826306ca5bd26a1f7b263acfe`, Antigravity's local report records 137/137 runnable tests passing, with one additional Win32 symlink-policy case skipped (22 suites, 138 cases; 100% runnable pass rate, 99.3% executed).

Exact-head [GitHub Actions run #42591418653](https://github.com/ASAA1229/pixel-perfect-pixel/actions/runs/42591418653) passed build, typecheck and SBOM generation but failed ESLint/Prettier in five files; CI consequently skipped automated tests and SBOM upload.

**Epic implications**
- E01–E03 and E05 have useful local automated coverage, but still need exact-head CI and browser acceptance where their exit criteria require it.
- E04 admin/resume/image lifecycle remains OPEN; PORT-US-013 is PARTIAL until cross-store compensation and missing-original recovery are implemented and tested.
- E06 accessibility/responsive work still needs screen-reader, keyboard and device acceptance.
- E07 production readiness remains OPEN pending performance/SEO, production configuration and release/rollback evidence.
- E08 provenance/integrity remains OPEN until exact-head CI completes all gates and produces retained release evidence.

Do not equate local test pass percentage with overall epic completion or mark any epic ACCEPTED while its exit criteria remain unmet.


## PORT-E04 implementation note — backup binary completeness (2026-11-12)

**Status:** IMPLEMENTED IN SOURCE / TESTS AUTHORED / NOT RUN

- Version-2 backup export now fails rather than silently omitting a resume or image binary referenced by a persisted index.
- Backup validation rejects missing referenced binaries before restore can write any key; the restore function also has a defensive no-write guard for incomplete payloads.
- Storage migration now stops before touching the destination when the source backup is incomplete.
- Added regression coverage for missing resume files, missing private/public image copies, digest-verified complete backups, no-write restore behavior, export failure and migration failure.

**Evidence:** commits `de45fe42` and `7fce418d` on `new`. Tests are authored but have not been executed. Runtime storage, rollback and hosted R2 behavior remain unverified.


## PORT-US-035 implementation note — root CMS coverage (2026-11-12)

**Status:** IMPLEMENTED IN SOURCE / TESTS AUTHORED / NOT RUN

- CMS contact overrides now flow into Abhishek's homepage social links, shared site footer and contact surfaces, with approved resume contact fields taking precedence.
- CMS now validates and stores skill groups; the admin content editor exposes them; root and person-profile skill views consume them.
- Social destinations are restricted to HTTPS URLs on the expected LinkedIn/GitHub domains, with curated fallbacks.
- Regression coverage added for CMS skill validation, shared-profile merging, contact fallback and social URL validation.

**Evidence:** commits `db89a602`, `69b12c29`, `e04e9a72`, `df001ad5`, `b9f52cef`, `e48d361c`, `2cea3c09`, `7014a3a3`, `316f9c03`, `7ed70aab`, `479e26e8`, `353255ad`, `836943ec` and `a333b3b5` on `new`. All test changes are unexecuted. Published SEO metadata propagation and acceptance validation remain open.


## Resume lifecycle safety note — reconciliation with missing originals (2026-11-12)

**Status:** IMPLEMENTED IN SOURCE / REGRESSION TEST AUTHORED / NOT RUN

- Admin reconciliation now blocks with `409 RESUME_ORIGINALS_MISSING` when the private resume index references a missing original file.
- The handler returns the affected IDs and leaves the existing public approved-resume feed unchanged.
- Added route-level failure-path coverage for publish → remove original → reconcile rejection → unchanged feed.

**Evidence:** commits `48cf41da` and `25e578a2` on `new`. Test execution and R2 verification remain pending.


## PORT-E04 implementation increment — image lifecycle compensation (2026-11-12)

**Status:** IMPLEMENTED IN SOURCE / FAILURE TESTS AUTHORED / NOT RUN

- Image upload, publish-on-upload, replacement, publish, unpublish and delete now use a shared compensating storage-write helper.
- The helper snapshots affected keys before mutation and restores attempted writes in reverse order, including ambiguous provider writes that persist and then reject.
- Failure responses distinguish complete compensation from incomplete rollback.
- Added failure-injection coverage for all five image lifecycle paths in `src/test/image-failure-paths.test.ts`.
- Resume publish/feed/history compensation exists, but durable recovery when compensation fails and concurrency across multiple server instances remain open. PORT-US-013 / PORT-US-045 are not closed.

No tests, builds, typecheck, lint, browser checks, CI or R2 verification were run; validation remains paused.


## PORT-E07 implementation increment — admin control room and navigation (2026-11-12)

**Status:** IMPLEMENTED IN SOURCE / NEEDS TESTING / OWNER ACCEPTANCE PENDING

- Added shared admin navigation across the content, AI persona, resume, image, backup/restore and audit managers.
- Replaced the simple admin landing page with a read-only control room covering all four profiles, content/persona publication state, resume/image queues, storage availability and recent audit activity.
- Added unavailable-source disclosure, profile/public-page shortcuts, refresh and session sign-out actions.
- Mapped the increment to PORT-US-049. This does not close authentication, storage recovery, content precedence, visual preview or production acceptance gaps.
- No tests/build/typecheck/lint/browser/accessibility/CI were run; validation remains paused.

## PORT-E07 implementation increment — dynamic admin inventory and preview (2026-11-12)

**Status:** IMPLEMENTED IN SOURCE / NEEDS TESTING / OWNER ACCEPTANCE PENDING

- Resume inventory: search, status and profile filters.
- Image inventory: search, profile and publication-status filters.
- Audit history: search and outcome filters.
- Content manager: live unpublished draft preview covering key profile sections and SEO data.
- Existing API-backed workflows remain in place for persona versioning, structured resume editing, image operations, backup/restore and storage migration.
- No tests/build/typecheck/lint/browser/accessibility/CI were run; validation remains paused.


## PORT-E04 / PORT-US-050 — Admin-managed public profile resources (2026-11-12)

**Status:** SOURCE IMPLEMENTED IN PART / VALIDATION PENDING / OWNER ACCEPTANCE OPEN

- Added shared profile-scoped published-image normalization and loading; Abhishek's homepage portrait and About hero/gallery, plus the shared person-profile portrait/gallery surfaces, now consume published image records. Published galleries replace curated gallery sets when present; curated assets remain fallback content.
- Added a public resume binary endpoint that checks the private index and serves only a currently approved resume record. Shared resume download actions resolve the active published resume ID for Abhishek and each person profile.
- Defined PORT-US-050 acceptance for profile isolation, draft privacy, publish/replace/unpublish/restore behavior, resource placement and no-code-change public updates.

Still open: inspect every profile route and every media placement; verify runtime cache behavior on publish/replace/unpublish/rollback (source now sends max-age=0, must-revalidate); ensure active-resource state and version controls are clear in Admin; prove storage failure and missing-original behavior; test the complete four-profile lifecycle. No tests, build, typecheck, lint, browser, accessibility or CI checks were run because validation remains paused. Do not mark PORT-US-050 or PORT-E04 accepted.


### PORT-US-050 — Admin active-resource visibility increment (2026-11-12)

**Status:** IMPLEMENTED IN SOURCE / VALIDATION PENDING

- Image inventory reads both private admin records and the public published-image feed.
- Admin distinguishes the currently selected portrait/gallery resources from approved-but-not-selected records.
- Filtered inventory now has a deliberate no-results state.
- Public feed errors remain an unknown state; they are not presented as successful publication.

Remaining work: verify all placement rules and profile surfaces; provide explicit version restore for images where supported; surface active published resume/version in the resume inventory; validate publish/unpublish/replacement and storage recovery when validation resumes.


### PORT-US-050 — Admin active resume visibility (2026-11-12)

**Status:** IMPLEMENTED IN SOURCE / VALIDATION PENDING

- Resume inventory compares private records with `GET /api/published-resumes` and identifies the exact active resume ID.
- Approved records not present in the public feed are not presented as live; feed errors produce an explicit unknown state.
- Publish and unpublish refresh the inventory/public-feed comparison after confirmed API success.

Remaining work: add safe image-version restoration with version metadata, extend image placement support for project-specific media, audit every public media slot/profile route, and validate complete publish/replace/unpublish/rollback behavior. No tests, builds, typecheck, lint, browser, accessibility or CI checks were run; validation remains paused.


### PORT-E04 / PORT-US-050 — safe image version restoration (2026-11-12)

**Status:** IMPLEMENTED IN SOURCE / VALIDATION PENDING

- Image replacements now create private version snapshots with a metadata sidecar containing filename, content type, size and upload timestamp.
- Added an authenticated version-list endpoint that only exposes snapshots with valid metadata and matching stored bytes.
- Added a restore endpoint that validates the version ID, metadata, exact byte length and image file signature; snapshots the current image before restoring; and uses compensating storage writes for private bytes, public bytes (when approved), index and snapshot metadata.
- Admin UI now exposes per-image version history and restore controls, refreshes the preview and history after restore, and warns that cleanup removes old versions.
- Legacy byte-only snapshots are not offered because their original metadata cannot be safely reconstructed.

Still open: validate lifecycle and injected storage failures when validation resumes; add durable recovery for compensation failure/concurrent writers; verify R2 and local-disk listing semantics. No tests/build/typecheck/lint/browser/accessibility/CI were run; do not mark acceptance complete.

### PORT-E04 / PORT-US-050 — project-specific image placements (2026-11-12)

**Status:** IMPLEMENTED IN SOURCE / VALIDATION PENDING

- Added project image placement metadata scoped by profile ID and project URL slug.
- Admin upload captures the exact slug and inventory labels the project assignment.
- Public feed includes project metadata; public normalization filters by profile and validates the slug.
- Abhishek's root project-detail route and shared person-project detail pages render approved images assigned to that exact profile/project pair.
- Published project images are included in active-resource visibility.

Remaining: inspect Abhishek's project route family and every project detail route; validate all four profiles, publication/unpublication/delete/restore lifecycle, slug changes and storage/cache behavior. No checks were run because validation remains paused. Do not mark PORT-US-050 or PORT-E04 accepted.

### PORT-E04 / PORT-US-051 — four-profile public resource lifecycle and image placement audit (2026-11-12)

**Status:** IMPLEMENTED IN SOURCE / AUTOMATED COVERAGE AUTHORED / VALIDATION PENDING

- Audited portrait/gallery/project image usage in the profile selector, all profile home/About views, Abhishek's homepage/About/AI introduction and all project card/showcase/detail views.
- Routed all personal image placements through validated profile-scoped published image data; project media is scoped by exact profile ID + project slug.
- Kept bundled portrait/gallery files as explicit fallback assets and classified series billboards/backdrops/logo as static brand art.
- Removed a duplicate static About-page profile image with inaccurate alt text.
- Added four-profile image lifecycle integration coverage and four-profile resume lifecycle integration coverage, plus stricter public image feed normalization tests.

Remaining: execute the new tests after validation is resumed; verify every route in browser, direct navigation and refresh; verify R2/local storage, caching, restore and compensation; verify pending/private isolation and no cross-profile leakage. Do not mark this epic accepted before successful validation.

## PORT-E04 / PORT-US-045 — durable storage recovery increment (2026-11-12)

**Status:** PARTIAL — SOURCE IMPLEMENTED / TESTS AUTHORED / VALIDATION PENDING

- Multi-object resume, image and backup restore/migration writes now persist snapshots and a write-ahead journal before applying target mutations.
- Pending applying journals can replay snapshots after a failed compensation or interrupted request.
- Admin → Backup & Restore exposes recovery status and a confirmation-gated recovery action.
- Journaled write phases are serialized per bucket object within one isolate. However, handlers can prepare stale read-modify-write snapshots before entering the queue, so lost-update protection is not complete.
- Distributed Worker concurrency, remaining non-journaled paths and hosted R2 semantics remain open. The local queue is not a distributed lock/CAS primitive.

## PORT-E04 / PORT-US-046 — admin authentication/session hardening increment (2026-11-12)

**Status:** PARTIAL — SOURCE HARDENING / TESTS AUTHORED / VALIDATION PENDING

- Strong session-signing secret minimum, fail-closed session epoch reads and missing-storage authorization behavior.
- Production builds cannot use the runtime development auth bypass.
- Same-origin authenticated session renewal endpoint and Admin navigation control.
- Regression test source covers weak secrets, route protection, CSRF rejection, renewal and malformed epoch handling.
- Distributed login throttling, production secret rotation/configuration and production-like acceptance remain open.

No tests/build/typecheck/lint/security scan/browser/CI/R2 validation was run. These increments do not close PORT-US-045, PORT-US-046 or PORT-E04.


### PORT-E04 / PORT-US-045 follow-up — resume binary lifecycle (2026-11-12)

Resume upload now journals original-file creation and index insertion together. Resume deletion now includes private index, public feed, history redaction and original-file deletion in one recoverable transaction. Failure-injection test source covers ambiguous upload-index persistence and ambiguous original deletion. No tests or hosted R2 checks were run.
