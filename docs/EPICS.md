# Portfolio — Epic Register and Delivery Plan

**Branch:** `new`  
**Baseline:** `32ee3bf7b89fabcb33bc8d69848587e8416a4f12`  
**Status:** All epics remain OPEN until evidence-backed exit criteria pass.

See [POC.md](POC.md) for the repository baseline and remaining work, and [USER_STORIES.md](USER_STORIES.md) for testable acceptance criteria.

## Delivery principles

- Preserve one shared design system across all four profiles.
- Treat profile/resume data as untrusted until reviewed and approved.
- Keep API keys and signing keys server-side and out of source control.
- Distinguish code presence, authored tests, CI results and real environment acceptance.
- Validate Jenkins and Nexus against the actual configured services; do not infer success from pipeline definitions.
- Work on `new` only; no automated changes to `main`, no merge and no PR unless explicitly requested.

## Epic summary

| ID | Epic | Priority | Outcome |
|---|---|---:|---|
| PORT-E01 | Shared UI and Four-Profile Experience | P1 | Consistent, responsive experience across Abhishek, Amulya, Anjini and Sai |
| PORT-E02 | Routing, Navigation and Content Integrity | P0 | Every route and profile section loads the correct verified content |
| PORT-E03 | AI Portfolio Assistant | P1 | Server-side, profile-aware answers grounded in current portfolio data |
| PORT-E04 | Admin, Resume and Image Management | P0 | Secure owner-only maintenance with validated uploads and reviewed changes |
| PORT-E05 | CI Quality and Automated Testing | P0 | Exact-head build, lint, unit and browser acceptance |
| PORT-E06 | Build Provenance and Artifact Integrity | P1 | Reproducible package with manifest and SHA-256 verification |
| PORT-E07 | Jenkins and Nexus Delivery | P2 | Authenticated, verified artifact publication and retrieval |
| PORT-E08 | Customer Verification and On-Site Change Detection | P1 | Customer-side verification and trustworthy drift reports |
| PORT-E09 | Production Readiness and Operations | P2 | Secure deployment, observability, rollback and release evidence |

## PORT-E01 — Shared UI and Four-Profile Experience
**Goal:** Ensure all profiles share the same layout, navigation, typography, spacing, responsive rules and reusable components while retaining distinct content and imagery.

**Remaining work**
- Compare all four profile pages and sections against the approved Abhishek baseline.
- Remove unintended duplicate or profile-specific styling overrides.
- Verify image selection, crop, alt text, fallbacks and responsive behavior.
- Validate keyboard, focus, contrast, reduced motion and mobile/tablet/desktop layouts.

**Exit gate:** visual and functional parity checks pass for all four profiles with approved content and no unintended style divergence.

## PORT-E02 — Routing, Navigation and Content Integrity
**Goal:** Ensure all profile, section, project, education, experience, skill, certification and contact routes work on direct navigation and refresh.

**Remaining work**
- Audit route definitions and generated route tree.
- Verify profile slugs, section links, project slugs, 404s and fallback behavior.
- Validate internal/external links and active navigation states.
- Confirm profile data is correct and no profile content leaks into another profile.

**Exit gate:** route matrix passes direct-load, in-app navigation, refresh, invalid route and responsive navigation scenarios.

## PORT-E03 — AI Portfolio Assistant
**Goal:** Provide useful profile-aware introductions and chat responses based on verified portfolio/resume information.

**Remaining work**
- Verify server-only Responses API key handling and request validation.
- Ground retrieval in the selected profile and current approved data.
- Handle missing/invalid keys, timeouts, rate limits and malformed responses.
- Prevent invented credentials, experience, projects or personal facts.
- Test data freshness and privacy boundaries.

**Exit gate:** API tests pass; responses remain grounded; secrets and private resume data never enter the client bundle or public response.

## PORT-E04 — Admin, Resume and Image Management
**Goal:** Provide owner-controlled content maintenance with secure authorization and safe file handling.

**Remaining work**
- Enforce authorization on every admin loader/action/API, not only route visibility.
- Validate session expiry, logout and unauthorized access.
- Validate PDF/DOCX/image type, size, parser behavior and safe storage.
- Require review before resume-derived data is published.
- Provide rollback and actionable failure feedback.

**Exit gate:** security tests prove public/unauthorized users cannot read or mutate admin data; upload and review lifecycle passes.

## PORT-E05 — CI Quality and Automated Testing
**Goal:** Establish reliable exact-commit quality gates.

**Remaining work**
- Run clean dependency installation, build, lint and all Vitest/Node tests.
- Add missing route, admin, upload and AI failure-path coverage.
- Run browser E2E coverage across four profiles and direct URL navigation.
- Fix flaky tests and document test environment assumptions.

**Exit gate:** required CI workflows pass on the exact release candidate and critical flows have regression coverage.

## PORT-E06 — Build Provenance and Artifact Integrity
**Goal:** Produce traceable release artifacts with file inventory, build identity and SHA-256 checks.

**Existing areas:** artifact-integrity scripts and CI workflow are present.

**Remaining work**
- Verify manifest contents and full commit/build provenance.
- Verify package checksum before extraction and file inventory after extraction.
- Test missing, extra, modified and unsafe-path entries.
- Verify signing policy authenticity using an independently trusted public key.

**Exit gate:** tampered or mismatched artifacts fail closed; clean artifacts verify reproducibly.

## PORT-E07 — Jenkins and Nexus Delivery
**Goal:** Publish immutable, traceable artifacts through the configured Jenkins pipeline to Nexus.

**Remaining work**
- Validate Jenkinsfile stages, agent tools, workspace and credential binding.
- Confirm Nexus Raw repository URL and permissions with administrator.
- Test authenticated HEAD preflight, upload, download and post-upload digest comparison.
- Ensure credentials are stored only in Jenkins Credentials and never logged.
- Record actual build number, commit, artifact and manifest identifiers.

**Exit gate:** a real Jenkins run publishes and retrieves the artifact from Nexus with matching digests and no credential exposure.

## PORT-E08 — Customer Verification and On-Site Change Detection
**Goal:** Let a customer validate delivered package authenticity and detect local modifications.

**Remaining work**
- Verify manifest-ignore policy first, then manifest, archive and extracted file inventory.
- Test signature/digest trust distribution independently of the package.
- Test changed, missing, additional, unsafe and ignored files.
- Produce a deterministic report suitable for issue resolution.
- Document safe staging and non-admin execution.

**Exit gate:** tampering is detected accurately; clean packages pass; reports identify affected paths and failure reasons.

## PORT-E09 — Production Readiness and Operations
**Goal:** Release a secure, supportable portfolio and repeatable customer package.

**Remaining work**
- Validate production environment configuration and hosting behavior.
- Verify error pages, logs, privacy, performance, SEO and accessibility.
- Document rollback, signing-key rotation and operational ownership.
- Obtain owner acceptance of known limitations and release evidence.

**Exit gate:** release checklist, rollback procedure and owner approval are recorded.

## Recommended execution order

1. PORT-E02 and PORT-E04 — close route correctness and security-critical admin gaps.
2. PORT-E05 — establish exact-head baseline and regression gates.
3. PORT-E01 — complete four-profile UI parity and accessibility.
4. PORT-E03 — verify grounded AI and privacy boundaries.
5. PORT-E06 and PORT-E08 — complete artifact and customer verification.
6. PORT-E07 — validate actual Jenkins/Nexus integration.
7. PORT-E09 — final production acceptance.
