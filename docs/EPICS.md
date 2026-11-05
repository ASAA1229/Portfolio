# Portfolio — Epic Register and Delivery Plan

**Repository:** `Guda-Abhishek/pixel-perfect-pixel`  
**Branch:** `new`  
**Status:** OPEN until acceptance criteria have evidence.

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

## PORT-E02 — Routes, Navigation and Portfolio Content
**Goal:** Ensure all portfolio content is reachable, correct and isolated by profile.

**Remaining work**
- Audit route definitions, generated route tree, loaders/actions and direct URL behavior.
- Verify profile slugs, section routes, project detail slugs and legacy route compatibility.
- Verify navigation active states, mobile menu, footer, internal links and external destinations.
- Check every profile's facts, social links, resume actions and empty/fallback states.

**Exit criteria**
- Route matrix passes direct load, refresh, in-app navigation, invalid route and mobile navigation scenarios.
- No broken links, wrong-profile content or unintended cross-profile data exposure.

## PORT-E03 — AI Introduction and Portfolio Chat
**Goal:** Provide optional introductions and useful chat responses grounded in the selected profile's approved information.

**Remaining work**
- Verify the server-side OpenAI Responses API integration and server-only key handling.
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
