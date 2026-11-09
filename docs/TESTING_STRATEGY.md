# Portfolio — Comprehensive Testing Strategy

**Target branch:** `test`  
**Purpose:** Validate the current Portfolio product from isolated functions through admin workflows, public profiles, storage recovery and release acceptance.  
**Status:** Test cases are being authored. This document does not claim that any new test has passed.

## 1. Test levels and techniques

| Level / technique | Scope | Method | Evidence |
|---|---|---|---|
| Static analysis | TypeScript, React, server routes, config | Typecheck, ESLint, secret/config scans | Exact-head logs |
| Unit | Auth, content, persona, resume history, storage, AI routing | Vitest, deterministic fixtures | Pass/fail + coverage |
| Component | Admin panels, profile cards, publishing controls | React Testing Library, mocked API | DOM assertions |
| Integration | Server APIs, storage adapters, resume lifecycle | In-process request tests, isolated bucket | Request/response and storage state |
| Contract | HTTP method/path/body/status/auth requirements | API contract matrix | Assertions per route |
| Security | Auth, CSRF, access control, profile isolation, XSS | Negative tests, fuzzing, SAST/SCA/DAST | Findings and severity |
| Regression | Prior admin upload, 404/500, hydration and resume defects | Focused fixtures and exact reproduction | Regression test ID |
| E2E | Admin login → upload → review → approve → publish → public view → rollback | Browser automation | Screenshots, traces, API logs |
| Visual / responsive | Four profile personas and public pages | Screenshot comparison at target viewports | Visual diff |
| Accessibility | Keyboard, screen reader, contrast, forms, dialogs | axe/WCAG review + manual assistive tech | Violations and manual notes |
| Performance | Public route rendering, image delivery, AI chat, large resume | Load/soak and browser metrics | p50/p95/p99 and Core Web Vitals |
| Reliability | R2/local disk failure, partial writes, restart, backup restore | Fault injection | Reconciliation and recovery evidence |
| Compatibility | Desktop/mobile browsers, Cloudflare runtime, Node | Browser/device/runtime matrix | Versioned matrix |
| Release / supply chain | Build provenance, SBOM, artifact checksums/signatures | CI/Jenkins artifact verification | SBOM, manifest and run link |

## 2. Automated commands

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run audit:images`

The current Vitest config uses jsdom and includes `src/**/*.{test,spec}.{ts,tsx}`. Node-specific suites should declare `// @vitest-environment node`.

## 3. Functional and integration test matrix

### Public routes and profile isolation
- Verify root portfolio and all four personas: Abhishek, Ammu, Bava and Sai.
- Every navigation link, section, project slug, legacy slug and contact route resolves correctly.
- Unknown profile/project routes return 404; no route leaks another persona's resume, contact details, AI context or admin draft.
- Responsive layouts at mobile, tablet, laptop and wide desktop breakpoints.
- Browser back/forward, refresh, deep links, trailing slash and encoded route behavior.

### Admin authentication and authorization
- Login success/failure, absent/weak secrets, expired/tampered cookie, logout, cookie flags and session expiry.
- Rate limiting, lockout behavior, same-origin mutation requirement and CSRF attempts.
- Admin routes and APIs return private 404 when unauthorized; no private metadata in error responses.
- Production mode must never accept development auth bypass, including development build mode.
- Admin pages and API responses must carry noindex/no-store protections as appropriate.

### Resume ingestion and publishing
- Upload valid PDF/DOCX, wrong extension, wrong MIME, corrupt file, empty file, oversized file and malformed multipart request.
- Profile assignment, duplicate upload, unassigned resume and cross-profile access.
- Extracted draft validation, approval state, publish/unpublish, append-only history and repeated rollback.
- Public feed exposes only approved fields and the currently effective snapshot.
- Private notes, source file metadata and other profiles' content never appear in public feed or AI context.
- Deleted resume redacts content in history according to retention policy.
- Missing source file, corrupt index, missing public feed and stale feed consistency reporting.
- Reconciliation must report missing originals; it must not claim it restored files it cannot reconstruct.
- Inject failures before/after file, index and feed writes; verify compensation or explicit partial failure without silent data loss.

### Storage and backup/restore
- Local disk bucket persistence across restart, R2 contract parity, content type metadata and sorted listing.
- Reject path traversal, absolute paths, drive prefixes, repeated separators, dot segments, metadata sidecar access and symlink escape.
- Simulate permission denied, disk full, partial write, rename failure, corrupt metadata and concurrent writes.
- Backup schema/version, checksum, missing files, tampered manifest, invalid keys, duplicate entries and oversized restore.
- Restore must validate all input before first write; inject failure at every write position and verify rollback result.
- Storage migration between local disk and R2 with dry-run, confirmation, interrupted migration and post-copy verification.

### CMS, personas and content
- Draft → publish → rollback → unpublish lifecycle for each profile.
- Reject unknown fields, invalid section keys, excessive lengths, malformed links and profile mismatch.
- Published pages use only approved content; drafts never leak into public pages.
- Concurrent edits, stale versions and rollback conflicts.
- Empty, malformed or missing stored content safely falls back to curated static content.

### AI chat and JARVIS gateway
- Profile-specific context selection and strict isolation across all four personas.
- Prompt injection in user message, uploaded resume, stored content and gateway response.
- Provider priority: JARVIS gateway first; paid OpenAI fallback only with explicit opt-in and server-side secret; offline fallback when unavailable.
- No silent cloud use, no secret in browser bundle/log/error, HTTPS enforcement except local loopback development.
- Timeout, rate limit, malformed JSON, provider 4xx/5xx, empty response and oversized response.
- Context size bounds, grounding, unknown-fact refusal and no invented resume claims.
- Gateway site key invalid/expired/revoked, wrong profile scope, replay and rate limit.

### Images, SEO and frontend
- Image manager upload/list/delete/replace, unsupported type, large file, corrupt image and missing storage.
- Verify all public image paths resolve; broken image fallback and lazy loading.
- Canonical URLs, robots, sitemap, Open Graph, Twitter metadata, structured data and noindex for private pages.
- Hydration mismatch, React console errors, keyboard focus, dialog semantics, form labels and alt text.
- Visual regression for each persona, nav, projects, experience, skills, education, certifications, contact and AI intro.

### DevOps and release integrity
- npm lockfile reproducibility, SBOM, dependency audit and license/security scan.
- Typecheck, lint, build and test failures must fail CI.
- Manifest file inventory, size/hash mismatch, archive tampering, path traversal and provenance mismatch.
- Jenkins stage exit-code propagation, artifact retention and customer release report.
- Nexus publication remains disabled; no test branch may publish artifacts.

## 4. Security test techniques
- Threat-model each boundary: browser ↔ server, admin ↔ public, profile ↔ profile, Portfolio ↔ JARVIS gateway, app ↔ object storage.
- SAST, SCA/dependency audit, secret scanning, config scanning and DAST on local isolated deployment.
- Fuzz path normalization, multipart parsing, body-size boundaries, resume extraction, content schema, backup manifests and provider responses.
- Property-based invariants: unauthorized requests never mutate; profile A never sees profile B; private data never appears publicly; only approved content is published.
- Mutation testing for auth, profile isolation, validation, publish/rollback and storage recovery.
- Race/concurrency tests for publish vs rollback, upload vs delete, backup vs mutation and concurrent admin sessions.
- Fault injection at each storage write and provider call.

## 5. Manual acceptance gates

| Gate | Required evidence | Status |
|---|---|---|
| Four public profiles on target browsers | Route, content and isolation evidence | NOT RUN |
| Admin authentication in production-like config | Login, session, CSRF and bypass-denial evidence | NOT RUN |
| PDF/DOCX ingestion to public publish | Upload/extract/review/approve/publish trace | NOT RUN |
| Resume rollback and feed reconciliation | Multiple versions, consistency report, recovery evidence | NOT RUN |
| R2 and local storage recovery | Failure injection, backup/restore and migration proof | NOT RUN |
| JARVIS gateway | HTTPS, scope, revocation, offline fallback, no secret leak | NOT RUN |
| Accessibility and responsive review | Keyboard/screen-reader and viewport matrix | NOT RUN |
| Release provenance | Exact-head CI, SBOM, checksum and artifact evidence | NOT RUN |

## 6. Execution and reporting rules
1. Record branch and exact commit SHA before every run.
2. Use synthetic resumes and test identities only.
3. Run unit tests, then API/storage integration, security, browser E2E, visual/accessibility, performance and recovery testing.
4. Capture request, response, storage before/after state and redacted logs for failures.
5. Every defect needs severity, impact, reproduction, expected/actual behavior and regression test.
6. A test is PASSED only when it executed on the recorded SHA. Authored tests remain NOT RUN.
7. Keep CI, browser, production-like storage, JARVIS integration and owner acceptance statuses separate.
8. Do not deploy or publish from the test branch. Nexus stays disabled.

## 7. Current known coverage gaps
- Existing tests cover many helper and component areas, but authenticated resume API/storage failure injection and full admin-to-public browser workflows need deeper coverage.
- Actual R2 behavior, deployment environment bindings, browser accessibility and JARVIS HTTPS gateway acceptance require integration/manual environments.
- Latest resume-history test additions in this phase are authored but pending execution.
