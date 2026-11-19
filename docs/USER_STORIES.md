# Portfolio — Authoritative User Stories and Remaining Work

**Updated:** 2026-11-13  
**Repository:** `ASAA1229/Portfolio`  
**Working branch:** `new` only  
**Latest observed candidate:** `b30436b3a8f4595b7d9780b849867c353f328b53`  
**Current status source:** [PROJECT_STATUS.md](PROJECT_STATUS.md)  
**Release disposition:** NOT READY / NOT APPROVED
**Note (2026-11-14):** per-story statuses and the CI sentences below predate the local validation recorded in the final reconciliation section of this file; where they differ, the reconciliation section and PROJECT_STATUS.md win.  
**Validation disposition:** ACTIVE on `new` under the ASAA maturity initiative

This file is the current actionable story index. The historical story/roadmap appendix in [REQUIREMENTS.md](REQUIREMENTS.md) is retained for traceability; historical status statements do not override this file's current status. Validation is authorized on `new`; merges, production deployment, Nexus publication and release remain separately gated.

## Status vocabulary

Use only: PLANNED, NOT STARTED, IN DEVELOPMENT, IMPLEMENTED, NEEDS TESTING, TEST FAILED, TEST PASSED, CI VERIFIED, DEVICE VERIFIED, OWNER ACCEPTANCE PENDING, ACCEPTED.

Implementation is not acceptance. ACCEPTED requires evidence for every criterion and required owner approval. Current status source: [PROJECT_STATUS.md](PROJECT_STATUS.md).

## Priority summary

| Priority | Story | Status |
|---|---|---|
| P0 | PORT-US-045 Storage recovery and data integrity | NEEDS TESTING |
| P0 | PORT-US-046 Admin authentication and security | IN DEVELOPMENT |
| P0 | PORT-US-043 Complete CMS coverage | NEEDS TESTING |
| P0 | PORT-US-049 Admin control room and unified navigation | NEEDS TESTING |
| P0 | PORT-US-050 Admin-managed resources drive public profiles | NEEDS TESTING |
| P0 | PORT-US-051 Resource lifecycle integrity | NEEDS TESTING |
| P0 | PORT-US-052 Exact-candidate engineering and E2E acceptance | TEST FAILED — latest CI has 15 type errors; tests skipped |
| P1 | PORT-US-034 / PORT-US-037 JARVIS integration | NEEDS TESTING |
| P1 | PORT-US-044 SEO and discoverability | NEEDS TESTING |
| P1 | PORT-US-047 Visual customization | NEEDS TESTING |
| P1 | PORT-US-048 Four-profile content and asset sign-off | OWNER ACCEPTANCE PENDING |
| P1 | PORT-US-053 Accessibility, responsiveness and performance | NEEDS TESTING |
| P1 | PORT-US-054 CI/CD and artifact assurance | TEST FAILED — artifact verification skipped |
| P1 | PORT-US-055 Production operations and rollback | PLANNED |

---

## P0 — Release blockers

### PORT-US-043 — Complete CMS coverage

**As the portfolio owner,** I want every intended public profile field and managed resource to be editable through Admin, so that normal content updates do not require source-code changes.

**Current status:** NEEDS TESTING — Admin routes and CMS/resource managers exist; complete field-by-field coverage and end-to-end acceptance are not established.

**Acceptance criteria**
- Inventory every public field and collection across Abhishek, Amulya/Ammu, Anjini/Bava and Sai/Darling: profile basics, biography, skills, projects/details, experience, education, certifications, contact/social links, navigation/section visibility, profile imagery, resumes, persona/AI context and approved theme settings.
- Map every field to an authenticated Admin create/read/update/delete or supported lifecycle action; explicitly document fields intentionally immutable or curated.
- Support draft, preview, validation, publish, unpublish, history and rollback where the data type requires them.
- Publish changes to the correct profile without source edits or cross-profile leakage.
- Preserve curated fallback when an override is omitted and preserve intentional empty collections when explicitly cleared.
- Enforce server-side validation, profile scoping, audit history and public/private boundaries.
- Demonstrate representative changes for all four profiles and all field groups after validation resumes.

### PORT-US-045 — Storage recovery and data integrity

**As the portfolio owner,** I want stored content and media to remain consistent and recoverable through partial failures, so that uploads, publishing, rollback and restore cannot silently corrupt or lose portfolio data.

**Current status:** PARTIAL — storage adapters, recovery helpers, backup workflows, validation and resource lifecycle code exist; hosted storage and failure-recovery acceptance remain open.

**Acceptance criteria**
- Define and document guarantees and limitations for local disk, in-memory development/test storage and hosted R2/object storage.
- Verify path canonicalization, symlink handling, content type/signature/size checks, index validation and private/public key separation.
- Exercise failures between binary writes, index updates, publication, unpublication, deletion and history updates; reconcile partial state without silently dropping originals.
- Prove backup completeness includes all referenced private/public binaries, indexes, metadata, histories and integrity records.
- Restore into an isolated destination; reject incomplete, corrupt, conflicting or unsafe backup content without partial destructive writes.
- Validate immutable image-version byte/metadata pairs and resume original/history consistency.
- Verify concurrent operations and multi-instance behavior using storage-native conditional writes/CAS or an explicitly documented safe strategy; in-process/per-isolate serialization alone is insufficient.
- Record a recovery report and owner acceptance for all four profiles.

### PORT-US-046 — Admin authentication and security

**As the portfolio owner,** I want all administrative operations protected by robust owner authentication and authorization, so that private content, files and publishing controls cannot be accessed or changed by unauthorized visitors.

**Current status:** PARTIAL — authentication/session and multiple hardening controls exist; production-like security acceptance remains outstanding.

**Acceptance criteria**
- Every Admin page, loader, action and API rejects unauthenticated and unauthorized requests, including direct URL/API calls.
- Verify session creation, secure HttpOnly cookie attributes, SameSite policy, expiry, revocation, secret rotation and fail-closed behavior for missing/malformed configuration.
- Enforce same-origin/CSRF protections, request-size limits, upload validation and canonical path handling.
- Use shared/distributed rate limiting suitable for multiple instances; process-local throttling alone is not a production control.
- Prevent access to private originals, drafts, backups, audit data and other profiles' records.
- Apply and verify security headers on every Admin/API response.
- Verify production configuration has no development bypass, default secret or client-exposed credential.
- Record a threat/abuse-case review and exact-candidate security evidence.

### PORT-US-051 — Resource lifecycle integrity

**As the portfolio owner,** I want an authenticated, read-only integrity inspector for resume and image resources, so that missing, orphaned, stale or inconsistent resources are visible before remediation.

**Current status:** NEEDS TESTING — inspector and test source exist; current CI fails before test execution.

**Acceptance criteria**
- Compare private originals, indexes, public approved copies, published feeds, histories and immutable image versions.
- Report missing originals, orphaned files, stale/missing public copies, invalid feed references, incomplete version pairs and unreadable indexes.
- Inspection is read-only and never silently deletes, republishes or rewrites data.
- Verify findings against actual storage and exercise the corresponding owner-approved recovery paths.
- Confirm no private file or metadata is exposed in public reports.
- Obtain owner acceptance for all four profiles.

### PORT-US-052 — Exact-candidate engineering and end-to-end acceptance

**As the product owner,** I want repeatable engineering and end-to-end evidence for one exact release candidate, so that release decisions are based on verified behavior rather than source inspection or historical test results.

**Current status:** TEST FAILED — exact-head run #617 failed typecheck; 89 diagnostics across 10 files. See [TESTING.md](TESTING.md).

**Acceptance criteria**
- After explicit validation resumption, record the exact candidate SHA and environment.
- Run locked dependency installation, typecheck, lint, production build, all automated tests and configured CI checks.
- Cover unit, integration, API, UI/component, end-to-end, security and regression suites.
- Test critical Admin journeys: login/logout, content edit/preview/publish/unpublish/rollback, image upload/review/publish/unpublish/version restore, resume upload/extraction/review/publish/rollback, backup/restore and audit inspection.
- Test public journeys and error/empty/offline states across all four profiles.
- Record pass/fail/skipped counts, logs/artifacts, defects and remediation; no historical result substitutes for exact-head evidence.
- Require green required CI checks and owner acceptance of unresolved exceptions.

---

## P1 — Product and release quality

### PORT-US-034 / PORT-US-037 — JARVIS integration boundaries

**As a visitor and portfolio owner,** I want the portfolio AI experience to use only approved, profile-scoped context through a controlled optional JARVIS gateway, so that answers are useful without exposing private data or requiring the full JARVIS platform.

**Current status:** NEEDS TESTING — source integration exists; gateway/runtime/privacy acceptance is outstanding.

**Acceptance criteria**
- JARVIS is an optional server-side provider; public pages remain functional when it is unavailable.
- Keep gateway URL/key server-side; require approved HTTPS access and authentication.
- Supply only the selected profile's approved published context and approved resume/persona data.
- Treat user content and retrieved profile text as untrusted data, not instructions.
- Verify timeout, cancellation, rate limiting, safe errors, audit behavior and no leakage of provider bodies, prompts, credentials or private context.
- Verify streaming and non-streaming behavior, honest offline fallback and clear UI availability states.
- Paid OpenAI fallback remains disabled unless the owner explicitly enables it.
- Demonstrate profile switching cannot reuse another profile's AI context.

### PORT-US-044 — SEO and discoverability

**As a visitor or search engine,** I want every public profile and published page to expose accurate metadata and indexability, so that the correct content is discoverable and private or unpublished content remains hidden.

**Current status:** PARTIAL — metadata, sitemap and robots foundations exist; exact route and production verification remain open.

**Acceptance criteria**
- Verify server-rendered title, description, canonical URL, Open Graph and social card data for root, each profile, section and project route.
- Verify profile-specific image/alt text and safe defaults.
- Sitemap and robots include only intended public routes.
- Unknown/invalid routes return HTTP 404 and do not emit misleading canonical/indexable metadata.
- Draft, private and unpublished content/assets never appear in metadata or sitemap.
- Publish, unpublish and rollback update public metadata consistently.

### PORT-US-047 — Owner-approved visual customization

**As the portfolio owner,** I want supported visual settings configurable per profile, so that each profile can be personalized without unsafe markup or inconsistent accessibility.

**Current status:** NEEDS TESTING — theme preview and profile-scoped styling foundations exist; full setting coverage and validation remain open.

**Acceptance criteria**
- Configure only approved themes/tokens, typography, accent, section visibility/order and supported layout modules.
- Preview drafts without publishing; publish only after explicit owner action.
- Keep theme variables scoped to the selected profile.
- Validate versioning, history and rollback of visual settings.
- Invalid settings fall back safely to the shared accessible theme.
- Reject arbitrary scripts, unsafe HTML and untrusted external resources.
- Verify all four profiles across supported screen sizes and accessibility preferences.

### PORT-US-048 — Four-profile content and asset sign-off

**As the portfolio owner,** I want to review and sign off each profile's facts, links and imagery against its exact published version, so that the public experience is accurate and complete.

**Current status:** OWNER ACCEPTANCE PENDING — a version-bound sign-off workflow exists; actual owner review remains open.

**Acceptance criteria**
- Review biography, skills, projects, experience, education, certifications, contact/social links and resume highlights for each profile.
- Confirm every image is approved, correctly assigned, appropriately attributed and has meaningful alt text.
- Replace or explicitly approve generic/placeholder hero imagery.
- Confirm no profile contains another person's private or incorrect content.
- Record reviewer, timestamp, published content version and accepted exceptions.
- Invalidate stale sign-off after publish/rollback and require re-review.
- Obtain explicit sign-off for Abhishek, Amulya/Ammu, Anjini/Bava and Sai/Darling.

### PORT-US-053 — Accessibility, responsive behavior and performance

**As a visitor using different devices and assistive technologies,** I want the portfolio to remain usable, readable and performant, so that the experience is inclusive and reliable.

**Current status:** NEEDS TESTING — accessibility and responsive implementation exists; complete manual and measured acceptance is missing.

**Acceptance criteria**
- Meet WCAG 2.2 AA for public and Admin experiences.
- Verify semantic structure, accessible names, alt text, keyboard navigation, visible focus, focus order, dialogs, forms, contrast, zoom/reflow and reduced motion.
- Complete screen-reader and keyboard-only review; automated checks alone do not close the story.
- Verify desktop, tablet and mobile layouts, touch targets and orientation changes.
- Record LCP, INP, CLS, route bundle sizes and image payloads on representative devices/network conditions.
- Define and meet agreed performance budgets without weakening privacy or content freshness.

### PORT-US-054 — CI/CD and artifact assurance

**As the product owner,** I want each candidate artifact traceable and independently verifiable, so that a release can be tied to its source and checked for tampering.

**Current status:** TEST FAILED — GitHub Actions run #617 fails typecheck; Jenkins execution is not evidenced.

**Acceptance criteria**
- Run CI from an approved exact source SHA and record repository, branch, workflow/run ID and environment.
- Produce a dependency SBOM and resolve/triage relevant dependency vulnerabilities.
- Generate artifact inventory, provenance and SHA-256 checksums.
- Verify package contents, paths, symlinks, missing/extra/modified files and policy authenticity.
- Verify Ed25519 signatures using an independently trusted public key when signing is enabled.
- Record successful read-back verification for any approved artifact publication.
- Keep Nexus disabled and publication gated unless separately approved.
- A source workflow definition or successful historical run does not close this story.

### PORT-US-055 — Production operations, monitoring and rollback

**As the product owner,** I want a controlled operational plan for deployment, monitoring, recovery and rollback, so that production incidents can be detected and handled safely.

**Current status:** PLANNED — operational documentation and quarantine/recovery tooling exist; production rehearsal and acceptance are outstanding.

**Acceptance criteria**
- Define supported production environment, required variables/secrets, storage bindings, AI gateway configuration and health checks.
- Provide actionable logs/monitoring for application, Admin, storage, AI gateway and deployment failures without leaking private data.
- Define incident severity, operator steps, escalation and recovery decision records.
- Rehearse backup, restore and integrity comparison in an isolated environment.
- Rehearse rollback to a verified known-good artifact and verify post-rollback health/data consistency.
- Keep quarantine/recovery evidence generation separate from automated mutation/deployment.
- Require explicit owner approval before production provisioning, deployment, publication or release.

---

## Execution order

1. PORT-US-045 — storage recovery and data integrity.
2. PORT-US-046 — Admin authentication and security.
3. PORT-US-043 — complete CMS coverage.
4. PORT-US-051 — resource lifecycle integrity acceptance.
5. PORT-US-034 / PORT-US-037 — JARVIS integration boundaries.
6. PORT-US-044 — SEO and discoverability.
7. PORT-US-047 / PORT-US-048 — visual customization and profile sign-off.
8. PORT-US-052 / PORT-US-053 — engineering, end-to-end, accessibility and performance acceptance.
9. PORT-US-054 / PORT-US-055 — CI/CD, artifact assurance and production operations.

The order is a planning sequence, not authorization to run validation. During the validation pause, only documentation/source work explicitly authorized by the owner may proceed.

## Definition of done

A story closes only when every acceptance criterion has exact-candidate evidence and any required owner sign-off. A source change, authored test, historical CI result or documentation statement alone is insufficient. Production release additionally requires every release gate in [RELEASE_READINESS.md](RELEASE_READINESS.md) and separate explicit owner approval.


### PORT-US-049 — Admin control room and unified workspace navigation

**As the portfolio owner,** I want one authenticated Admin control room with clear navigation and accurate operational summaries, so that I can manage all four profiles and resources from one workspace.

**Current status:** NEEDS TESTING — dashboard and navigation source exists; complete workflow and direct-route authorization acceptance remain outstanding.

**Acceptance criteria**
- Provide authenticated navigation to content, resumes, images, personas, backup/restore and audit.
- Display accurate per-profile content/persona versions, pending/approved resources, storage availability and recent audit outcomes.
- Handle partial API failures and unavailable storage without displaying a false healthy state.
- Enforce authorization on every dashboard data API, not only the UI route.
- Verify navigation and workflow state for all four profiles and supported viewports.

### PORT-US-050 — Admin-managed resources drive public profiles

**As the portfolio owner,** I want approved Admin-managed images and resumes to flow into the correct public profile and project placements, so that updates do not require manual source edits.

**Current status:** NEEDS TESTING — public resource feeds, profile/project placement and resume/image managers exist; end-to-end acceptance remains outstanding.

**Acceptance criteria**
- Bind each resource to the correct profile and exact project slug/placement slot where applicable.
- Pending resources remain private; only approved/published resources appear publicly.
- Publish, unpublish, replace and restore update the correct public feed without cross-profile leakage.
- Preserve curated fallback when no override exists and intentional removal when a placement is cleared.
- Verify original download/privacy policy, alt text, version history and rollback.
- Demonstrate all four profile journeys using Admin-managed resources.

## Evidence and dependency register

| Story | Priority | Evidence / required outcome | Dependencies | Verification | Status |
|---|---|---|---|---|---|
| PORT-US-043 | P0 | CMS schema/Admin route exist; complete field coverage unproven | PORT-GAP-001/003 | Four-profile CRUD/publish matrix | NEEDS TESTING |
| PORT-US-045 | P0 | Storage/recovery source exists; adapter typing fails and R2 unverified | PORT-GAP-001; R2 access | Failure injection, concurrency, backup/restore | NEEDS TESTING |
| PORT-US-046 | P0 | HMAC sessions/tests exist; throttle process-local | PORT-GAP-001; shared limiter | API bypass, CSRF, expiry, revocation, multi-instance throttle | IN DEVELOPMENT |
| PORT-US-049 | P0 | Dashboard/navigation source exists | PORT-GAP-001/003 | API/UI workflow tests for all profiles | NEEDS TESTING |
| PORT-US-050 | P0 | Public feeds and image/resume manager source exist | PORT-GAP-001/002/003 | Publish/unpublish/restore matrix | NEEDS TESTING |
| PORT-US-051 | P0 | Read-only inspector/test source exists | PORT-GAP-001/002 | Isolated storage audit and privacy review | NEEDS TESTING |
| PORT-US-052 | P0 | Run #617 build passed; typecheck failed; tests skipped | PORT-GAP-001 | Exact-SHA CI and E2E acceptance | TEST FAILED |
| PORT-US-034/037 | P1 | Provider resolver/chat integration exists | PORT-GAP-001/003 | Gateway/auth/privacy/timeout/cancellation tests | NEEDS TESTING |
| PORT-US-044 | P1 | SEO helpers/routes/tests exist | PORT-GAP-001/004 | HTTP/metadata/sitemap/robots matrix | NEEDS TESTING |
| PORT-US-047 | P1 | Theme/preview foundations exist | PORT-GAP-001/004 | Draft/publish/rollback and viewport tests | NEEDS TESTING |
| PORT-US-048 | P1 | Version-bound sign-off workflow exists | PORT-US-043/047/050 | Owner review bound to published version | OWNER ACCEPTANCE PENDING |
| PORT-US-053 | P1 | Responsive/accessibility foundations exist | Stable UI | Automated and manual WCAG/device/performance tests | NEEDS TESTING |
| PORT-US-054 | P1 | Actions/Jenkins/artifact tooling exist; run #617 fails | PORT-GAP-001; Jenkins agent | Exact GitHub run and actual Jenkins/read-back | TEST FAILED |
| PORT-US-055 | P1 | Ops and recovery docs/tooling exist | PORT-GAP-002/010/011 | Staging and DR/rollback rehearsal | PLANNED |

Latest candidate CI: [run #43420111801](https://github.com/ASAA1229/Portfolio/actions/runs/43420111801), 15 TypeScript diagnostics in 5 files; build and SBOM pass, tests/lint/artifact checks skipped. Fix the remaining Admin route literal and backup/recovery test contracts before accepting PORT-US-052. Current statuses and maturity scores are authoritative in [PROJECT_STATUS.md](PROJECT_STATUS.md). Historical dated implementation records remain in [REQUIREMENTS.md](REQUIREMENTS.md).


## Status reconciliation — 2026-11-14

Local validation on branch new (see PROJECT_STATUS.md for commands and counts). Story statuses use this file's vocabulary; none is CI VERIFIED because no hosted CI run was observed.

| Story | Status | Evidence |
|---|---|---|
| PORT-US-043 Complete CMS coverage | TEST PASSED (local) | Strengths, leadership and training added; PERSON_FIELD_COVERAGE; four-profile lifecycle matrix; concurrency 409. Owner field sign-off pending |
| PORT-US-045 Storage recovery | NEEDS TESTING (hosted) | Failure injection at every operation, lease, CAS, crashed-isolate recovery, backup round trip all pass against an R2 model |
| PORT-US-046 Admin security | NEEDS TESTING (production-like) | Shared limiter, central CSRF, 104-case route/session matrix pass locally |
| PORT-US-049 Admin control room | TEST PASSED (local) | All admin pages and APIs covered by the unauthenticated/CSRF matrix and axe; nested main landmarks and unlabeled file input fixed |
| PORT-US-050 Resources drive public profiles | TEST PASSED (local) | Four-profile resume/image lifecycle suites |
| PORT-US-051 Resource lifecycle integrity | NEEDS TESTING (hosted) | Inspector suites pass locally; real storage not exercised |
| PORT-US-052 Engineering acceptance | TEST PASSED (local) | 0 typecheck errors, 0 lint problems, 472 Vitest (flaky: timeouts in 2 of 4 reruns), 17/17 Playwright Admin/accessibility E2E |
| PORT-US-034/037 JARVIS | NEEDS TESTING (gateway) | 29 contract tests, cancellation bug fixed, chat throttle added |
| PORT-US-044 SEO | TEST PASSED (local) | Published-only sitemap, real 404 for root and person project pages |
| PORT-US-047 Visual customization | NEEDS TESTING | Theme validation and merge covered; no new visual regression suite |
| PORT-US-048 Owner sign-off | OWNER ACCEPTANCE PENDING | Unchanged |
| PORT-US-053 Accessibility/performance | NEEDS TESTING | axe clean; skip link added; Playwright keyboard/zoom/reflow/target-size checks pass; CLS fixed (0.005); INP 216 to 344 ms, over the 200 ms target; manual review absent |
| PORT-US-054 CI/CD | IMPLEMENTED | Stage order, audit gate, budget, package-manager guard; runs unobserved |
| PORT-US-055 Operations and rollback | PLANNED | External configuration list in OPERATIONS.md |

### Stories newly implemented from the scan of this file and REQUIREMENTS.md

- Complete CMS coverage of person strengths, leadership and training (PORT-US-043 acceptance: every public field mapped to Admin or declared curated).
- Real 404 for unknown/archived root project pages and a published-only sitemap (PORT-US-044).
- Skip link and landmark repair (PORT-US-053 keyboard and structure criteria).
- Public chat rate limiting (PORT-US-034/037 acceptance names rate limiting).
