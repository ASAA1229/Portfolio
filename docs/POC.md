# Portfolio POC — Current Baseline and Remaining Work

**Planning branch:** `new`  
**Reviewed branch head:** `32ee3bf7b89fabcb33bc8d69848587e8416a4f12`  
**Review date:** 2026-11-05  
**Status:** IN PROGRESS — NOT RELEASE-READY

## 1. Product objective

Deliver a polished, responsive, Netflix-inspired multi-profile developer portfolio for Abhishek, Amulya, Anjini and Sai. Each profile should share a consistent design system while presenting its own verified biography, skills, projects, experience, education, certifications and contact details. The portfolio includes a data-aware AI introduction/chat experience and a protected admin workflow for maintaining profile content and resumes.

## 2. Repository baseline observed

- React 19, TypeScript, TanStack Start/Router, Vite and Tailwind CSS.
- Shared portfolio components, profile data modules, route-driven profile pages and shared profile styles.
- Profile routes and section routes, project detail routes, skills, experience, education, certifications, contact and profile selection pages.
- AI introduction/chat components, server-side chat route and portfolio knowledge/resume extraction/mapping modules.
- Admin login, image and resume routes, plus admin-auth implementation/tests.
- Vitest/Testing Library tests, ESLint and Prettier.
- CI workflows for portfolio verification and artifact integrity.
- Node scripts for artifact manifests/checksums, customer release verification, policy signatures and on-site change detection.
- Jenkins pipeline and Nexus Raw publication behavior are described in README; actual Jenkins/Nexus execution remains environment-dependent.

This is a source-tree review, not a claim that all routes, content, integrations or deployment workflows have been accepted.

## 3. POC capabilities and boundaries

### Portfolio experience
- Four profile identities and profile-specific data are represented in the repository.
- Shared page/component and styling foundations exist.
- Main navigation, profile pages, section pages, project details and contact flows have automated test coverage.
- Remaining visual parity, content accuracy, accessibility, responsive behavior and real-browser checks require verification.

### AI portfolio assistant
- Server-side chat route uses the OpenAI Responses API; Lovable AI is not the active fallback.
- The server requires `OPENAI_API_KEY` supplied through a private environment secret.
- Never expose API keys in client code, Vite-prefixed variables, logs, repository files or generated artifacts.
- Confirm current portfolio data is used as the source of truth and unsupported claims are not invented.
- API availability/cost is external and is not included as a free/zero-cost guarantee.

### Admin and resume workflow
- Admin login, resume and image route modules exist.
- Verify authentication and authorization on every server-side read/write operation; hiding a route is not access control.
- Verify upload type/size limits, safe parsing, file storage, profile mapping, error handling and auditability.
- Confirm public profile content changes only through an authorized workflow.

### Build and release integrity
- CI workflow and scripts exist for manifest generation, SHA-256 integrity checks, signed policy verification and on-site change detection.
- README documents optional authenticated Nexus Raw publication through Jenkins credentials.
- A local script or workflow definition is not proof of successful Jenkins-agent or Nexus operation.
- The customer must obtain signing public keys or trusted policy digests independently from the package.

## 4. Remaining work — prioritized

### P0 — Correctness and security
- [ ] Run install, production build, lint and full test suite on the exact `new` head.
- [ ] Audit route tree, imports/exports, loaders/actions and generated route registration for broken or duplicate routes.
- [ ] Verify admin authentication, session handling, authorization and server-only secret boundaries.
- [ ] Test resume/image upload validation, path traversal protection, file limits and failure cleanup.
- [ ] Verify chat API input validation, rate/size limits, error redaction and API-key isolation.
- [ ] Review dependencies and record security-audit findings.

### P1 — Consistent four-profile experience
- [ ] Compare all four profiles section-by-section against Abhishek's approved baseline.
- [ ] Enforce one shared styling system and remove unintended profile-specific layout drift.
- [ ] Verify profile-specific content, links, images and fallback behavior.
- [ ] Check navigation, active states, responsive layout, typography, spacing, motion and reduced-motion behavior.
- [ ] Verify all profile and section routes, including education, projects and direct URL refresh/deep links.
- [ ] Test keyboard navigation, focus visibility, contrast, alt text and mobile/tablet/desktop layouts.

### P1 — Dynamic portfolio content and AI
- [ ] Verify AI responses are grounded in the current profile data and selected profile.
- [ ] Verify resume extraction maps to the correct profile and does not overwrite verified fields silently.
- [ ] Define approval/review before publishing extracted resume changes.
- [ ] Test missing key, invalid key, provider timeout, malformed response and rate-limit behavior.
- [ ] Verify no secret or private resume content leaks to public routes or client bundles.

### P1 — Admin and content management
- [ ] Test unauthenticated and unauthorized access to every admin route and mutation.
- [ ] Verify secure session expiry/logout and CSRF/origin protections where applicable.
- [ ] Validate PDF/DOCX MIME, extension, size and parser failure cases.
- [ ] Verify image replacement, safe filenames, storage limits and rollback.
- [ ] Add clear success/failure feedback and prevent partial profile updates.

### P2 — CI/CD and release delivery
- [ ] Execute GitHub Actions on the exact branch head and resolve all failures.
- [ ] Validate Jenkins pipeline on the intended agent and confirm artifact reproducibility.
- [ ] Validate Nexus credentials, permissions, HEAD preflight, upload, download and checksum comparison with the Nexus administrator.
- [ ] Verify customer package in a clean staging directory, including manifest-ignore policy, signature, archive and extracted-file inventory.
- [ ] Test on-site change detection against modified, missing, extra and restored files.
- [ ] Document release, rollback, signing-key rotation and customer handoff procedures.

### P2 — Release readiness
- [ ] Run browser-based end-to-end checks on all public routes and all four profiles.
- [ ] Check performance, image loading, SEO metadata, sitemap/robots and error pages.
- [ ] Verify production environment variables and hosting configuration without exposing secrets.
- [ ] Record exact commit, build artifact, manifest, checksum, test results and known limitations.
- [ ] Obtain owner approval before production release.

## 5. Evidence and status rules

- **IMPLEMENTED:** source code exists.
- **TEST-AUTHORED:** automated test exists.
- **CI-VERIFIED:** successful workflow ran against the exact commit.
- **ENVIRONMENT-VERIFIED:** actual Jenkins/Nexus/hosting environment was exercised.
- **ACCEPTED:** applicable functional, security, accessibility and release gates passed.
- **BLOCKED:** external dependency prevents progress and the owner/action is recorded.

Do not mark a capability complete from source inspection alone. Record commit SHA, command or workflow run, environment, expected/actual result and limitations.

## 6. Scope controls

- Keep work on `new`; do not modify `main` or merge branches as part of this documentation task.
- Do not commit credentials, private keys, real resume files or customer data.
- Keep the four-profile shared design consistent; profile data may differ, shared layout rules should not drift.
- Preserve the existing artifact integrity and customer verification sequence.
- Do not publish resume-derived changes without explicit owner review.
- No PR is created unless separately requested.

## 7. Completion definition

The POC is complete only when the epic exit criteria in [EPICS.md](EPICS.md) are satisfied, all user stories in [USER_STORIES.md](USER_STORIES.md) have evidence-backed disposition, exact-head CI passes, admin/AI/security boundaries are verified, and the intended Jenkins/Nexus release path is validated or explicitly documented as out of scope.
