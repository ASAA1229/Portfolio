# Portfolio POC — Status Baseline, Constraints and Future Scope

## Owner-approved execution baseline — 2026-11-09

**Authority:** The owner has explicitly resumed development, testing and enhancement. This section supersedes prior statements in this document that development/testing is paused.

- **Active development branch:** `new` (baseline commit: `57ceb0a8146f78645c00fc8ea9ef261b99e7eb48`). Keep all changes on this branch.
- **Testing:** ACTIVE. Execute relevant checks and CI against each candidate commit; report exact SHA, commands, pass/fail counts and skipped checks.
- **Product scope now:** This is a personal four-profile portfolio for Abhishek, Amulya, Anjini and Sai. Keep the implementation reusable and configurable for future client-specific customization, but do **not** turn it into an actively launched multi-tenant SaaS product now.
- **AI direction:** A modular portfolio AI layer may use selected JARVIS capabilities (chat, specialized agent and monitoring functions) without requiring the entire JARVIS platform or creating a hard runtime dependency.
- **Content and management:** Owner-managed dashboard, profile-scoped resume/image processing, AI-assisted extraction and drafting with owner review/approval, and strict separation of each profile's data.
- **Architecture:** Configurable shared design system, profile-specific content and optional customization, adaptive backend/storage and provider-independent deployment where practical.
- **Cost/privacy:** Zero recurring cost by default. No paid provider, production resource, production secret or hosted service activation without explicit approval. Keep API keys server-side and out of source control.
- **Release boundary:** No merge to `dev` or `main`, no production deployment, production secret/R2 provisioning, public tunnel or Nexus publication without separate explicit approval. Keep Nexus disabled.

### Current branch and CI evidence at authorization

- The `new` branch head is `57ceb0a8146f78645c00fc8ea9ef261b99e7eb48`.
- Latest observed CI run for this exact SHA: [run #42608509533](https://github.com/ASAA1229/pixel-perfect-pixel/actions/runs/42608509533) **FAILED** during CycloneDX SBOM generation. npm reported `EINVALIDPURLTYPE` for package `tanstack_start_ts@`; build, typecheck, lint and tests were skipped. Dependency installation also reported 13 vulnerabilities (11 moderate, 2 high); this is an audit finding, not a completed security assessment.
- First technical priority: repair the SBOM generation/input contract without weakening provenance or silently omitting dependencies, then rerun the full pipeline so build, typecheck, lint and tests actually execute.
- Other priorities: resume publish/rollback consistency and recoverability; admin authentication/session/authorization; profile isolation and route correctness; resume/image lifecycle; JARVIS gateway privacy/fallback; accessibility, responsive behavior, performance and SEO.
- Historical local test counts and older CI runs are not proof for the current branch head. A story remains open until its own acceptance evidence is recorded.

### Implementation principles

- Personal use first; preserve a clean path to reusable client templates later.
- Shared components and design tokens, with profile content and identity isolated.
- All AI-derived resume/profile facts are untrusted until reviewed and approved by the owner.
- Public pages expose only approved content; original resumes, drafts, review notes and credentials remain private.
- Keep the product deployable without mandatory paid services or a JARVIS runtime.

**Repository:** `ASAA1229/Portfolio`
**Active branch:** `new`
**Status snapshot:** 2026-11-09
**Overall status:** IN PROGRESS — core product works locally and passes all automated checks; production configuration, deployment and some lifecycle features remain.

**Status vocabulary:** **DONE — VERIFIED (automated)** · **DONE — VERIFIED LOCALLY** (dev server / browser on the owner's laptop) · **IMPLEMENTED — NEEDS TESTING** (test named) · **PARTIAL — NEEDS DEVELOPMENT** · **NOT STARTED**. Nothing is marked production-verified: no CI run, deployment or production check has happened for this head.



## Current status refresh — 2026-11-09 (authoritative)

**Latest inspected commit before this refresh:** `9f4a923143eeb2deab4b3288a3e9e067f4f8edd3`. The project remains IN PROGRESS. Development and testing are ACTIVE on `new`. Do not treat older local test/build/browser evidence as evidence for the latest code.

### Newly implemented source changes — not tested
- Profile route has a dedicated recoverable error screen with retry and profile-selection navigation.
- Published content and public image responses use bounded public cache headers; private/admin responses remain no-store.
- Runtime startup diagnostics report missing configuration names only, never secret values.
- **2026-11-09 development increment:** valid-format but unknown profile project slugs now throw the route's not-found result and use the route's 404 boundary rather than rendering a missing page with HTTP 200. Commit: `96e2a4ca65605aef92b3cea737b7312641d601fb`.

### Remaining development
1. **Implemented in source (2026-11-12):** Abhishek's root portfolio now consumes published CMS contact details, secure GitHub/LinkedIn overrides and editable skill groups; the CMS editor exposes skill groups, and shared profile merging applies them to the four profile experiences. Remaining: published SEO metadata propagation and route-by-route acceptance evidence.
2. **Partially implemented in source (2026-11-12):** resume reconciliation now refuses to rebuild the public feed when an indexed original is missing, returning a 409 with the missing IDs and leaving the existing feed untouched. Remaining: broader failure-injection coverage for publish/rollback/unpublish, concurrent updates and hosted R2 durability.
3. **Implemented in source (2026-11-12):** backup/restore now requires every referenced resume/image binary, validates SHA-256 before writes, and rejects incomplete source migrations before destination writes. Regression tests are authored but not run; storage failure-injection and hosted R2 verification remain open.
4. Complete admin authentication/session hardening and production R2 configuration readiness.
5. Complete JARVIS gateway production integration without silently enabling paid fallback.
6. Close browser journey, screen-reader, responsive, performance and release evidence after testing resumes.

### Constraints and requirements
- Testing is **PAUSED**: do not run tests, typecheck, lint, build, audit, browser checks, CI or deployment checks until explicitly resumed.
- Development may continue on `new`; tests may be authored/updated but not executed.
- Four profiles remain Abhishek, Amulya/Ammu, Anjini/Bava and Sai/Darling, with strict profile isolation and approved resume facts only.
- JARVIS is the primary AI engine; paid OpenAI fallback is allowed only with explicit `PORTFOLIO_AI_ALLOW_PAID_FALLBACK=true` and owner-supplied server secret. No silent paid provider or secret in client code.
- Keep owner/admin data private, credentials server-side, mutations authenticated/audited and published data profile-scoped.
- No production deployment, domain/tunnel setup, production secrets, R2 provisioning, PR, merge or promotion without explicit owner approval.

**Evidence rule:** the route change and latest source commits are IMPLEMENTED — NEEDS TESTING. No new test, build, browser or production result is claimed.

---

## Development completion snapshot — 2026-11-08

All backlog stories in the owner-approved baseline now have an implementation on `new`. Testing was paused by the owner for this phase, so every item below is **IMPLEMENTED — NEEDS TESTING**. `npm run typecheck`, `npm run lint` (0 errors) and `npm run build` pass.

| Story | What was built | Commit(s) | Test still required |
|---|---|---|---|
| PORT-US-013 / 036 Resume publish history | Append-only history, confirmed rollback (adds an entry), drafts removed on delete | `312302b`, `99c7208`, `032e55e` | Run history tests; publish → rollback → unpublish in browser |
| PORT-US-035 Owner CMS | `/admin/content`: profile basics, projects, experience, education, certifications, SEO, navigation; draft/publish/history/restore, merged over curated data | `e6289eb` | CMS tests; publish edits and check every profile page |
| PORT-US-037 JARVIS as AI engine | JARVIS primary; paid OpenAI only with `PORTFOLIO_AI_ALLOW_PAID_FALLBACK=true` | `0cec5b6`, `7887729` | Chat via JARVIS gateway + tunnel in production |
| PORT-US-038 Personas | `/admin/personas`: per-profile persona with preview, publish, history; cannot override grounding rules | `032e55e` | Persona tests; chat per profile |
| PORT-US-039 Privacy | `/privacy`, chat consent notice with "Clear my chat", no analytics, mailto-only contact | `032e55e` | Browser check of notice and clear |
| PORT-US-040 Templates | `src/config/site-config.ts`, navbar reads it, new-profile factory, `docs/PROFILE_TEMPLATES.md` | `e6289eb` | Visual regression on all profiles |
| PORT-US-041 Storage | One storage contract (R2, local disk, memory), `docs/STORAGE.md`, `/admin/backup` export/restore | `e6289eb` | Backup → restore round trip |
| Dev uploads on disk | `.local-storage/` survives restarts | `604fe9c` | Upload, restart, confirm |

**Known limits:** CMS edits to Abhishek's own pages only affect navigation labels so far; backup binary completeness is now enforced in source but requires exact-head tests and storage verification; unknown person-project slugs now route to the not-found boundary (implementation added 2026-11-09; HTTP status still needs verification). **Owner-dependent:** production R2 + login check, `VITE_SITE_URL`, JARVIS tunnel secrets, first CI run, Sai monogram (DR vs DS).

## 1. Product summary

A cinematic, Netflix-inspired portfolio presenting four people — **Abhishek** (root site `/`), **Amulya / Ammu**, **Anjini Kumar / Bava** and **Sai / Darling** (`/people/{ammu,bava,sai}`, `/people/darling` → `/people/sai`). All profiles now share one visual template (chapter heroes, featured projects, contact panel, footer, per-person monogram). Visitors can chat with a profile-grounded AI assistant, which now runs on the owner's **JARVIS personal AI** (OpenAI optional fallback; offline profile answers when no AI is reachable). A private `/admin` area lets the owner upload resumes and images, review them, and publish/unpublish.

**Latest local evidence (2026-11-07):** typecheck 0 errors · lint 0 errors (6 warnings) · **107 Vitest + 4 Node tests pass** · production build passes · 33-route matrix and all **43 sitemap routes return 200** · Edge headless pass at 1440 px and 390 px with no page errors or horizontal overflow · axe serious issues **62 → 2** (both are `aria-hidden` watermark false positives) · admin image lifecycle and resume upload verified on the dev server.

## 2. Status at a glance

| Epic | Done | Needs testing | Pending development |
|---|---|---|---|
| **PORT-E01** Shared design & four profiles | Shared template for all four profiles (`0b2308f`); per-person monogram (no more GA logo on other profiles); identity isolation | Owner visual/content review of every page per profile | Personal hero images for Ammu/Bava/Sai; merge the two contact components; Sai monogram “DR” vs data initials “DS” (decision) |
| **PORT-E02** Routes & content | Route matrix, direct load/refresh, 404s, `/portfolio` → 301 `/`, `/people/darling` → Sai, broken project links fixed + 301 | Owner click-through of every nav link on phone | Resume files for Ammu/Bava/Sai (Resume buttons hidden until provided) |
| **PORT-E03** AI intro & chat | Profile-grounded chat, approved-resume context, streaming/cancellation, offline fallback, idle-based timeouts | Voice/video intro on a real phone and desktop browser | — |
| **AI provider via JARVIS** | `/api/chat` prefers JARVIS (`JARVIS_AI_URL` + `JARVIS_AI_KEY`), OpenAI fallback, 503 → offline answers; live local chain answered Ammu/Sai in 14–24 s | Production: deployed site → Cloudflare Tunnel → JARVIS | Tunnel + site key + deployment secrets (owner setup) |
| **PORT-E04** Admin, resumes, images | Upload HTTP 500 fixed (`f12ebb9`); resume false “reset” error fixed and `/admin` hub (`9e9b761`); image upload → publish → public → unpublish → delete verified on dev server | Persistent R2 bucket + real admin login/session expiry in a deployed environment | Resume rollback to a previous published version; partial-failure reconciliation |
| **PORT-E05** Quality engineering | All checks green locally; strict `npm run typecheck` added; CI/Jenkins lint+tests re-enabled | First CI/Jenkins run (happens after push) | Browser journeys (chat, contact, admin) as automated tests |
| **PORT-E06** Accessibility & responsive | Skip link, focus styles, mobile-menu focus handling, reduced motion, AA contrast; no overflow at 390 px | Screen-reader pass (NVDA/Narrator) | — |
| **PORT-E07** Performance, SEO, release | `sitemap.xml`, `robots.txt`, canonical/OG/Twitter tags, admin `noindex`; profile photos 11.9 MB → 0.7 MB WebP | Lighthouse/Web Vitals on the deployed site | Set `VITE_SITE_URL`; remove unused/original images (owner approval); production release (not authorized) |
| **PORT-E08** DevOps & artifact integrity | Provenance, SHA-256/archive verification (verifier SyntaxError and Windows `tar` bug fixed), customer reports, quarantine/recovery records | GitHub Actions + Jenkins exact-head artifact run | Nexus publishing (disabled by policy) |

## 3. How to test what's ready

1. **Run locally:** `npm ci`, then `npx vite dev --port 8081`. Open `/`, `/profiles`, `/people/ammu`, `/people/bava`, `/people/sai` and each section; check on desktop and a phone (or 390 px DevTools).
2. **Admin:** open `/admin` → Image Manager → upload a JPEG/PNG/WebP for a profile → **Publish** (or tick *Publish immediately after upload*) → confirm it appears in that profile's gallery → **Unpublish** → confirm it disappears. Resume Manager → upload a PDF/DOCX → extract → review → publish. *Dev storage is in memory and is cleared on restart.*
3. **AI chat with JARVIS:** start JARVIS with `JARVIS_SITE_GATEWAY_PORT=3100`, create a key (`npm run site-key -- create portfolio`), then start the portfolio with `JARVIS_AI_URL=http://127.0.0.1:3100` and `JARVIS_AI_KEY=<key>`; ask a profile question. Stop JARVIS and confirm the chat falls back to offline answers.
4. **SEO:** open `/sitemap.xml` and `/robots.txt`; confirm `/admin` is disallowed.
5. **Automated:** `npm run typecheck && npm run lint && npm test && npm run build`.

## 4. Known constraints

- **Dev storage is ephemeral:** without the R2 `RESUME_BUCKET` binding, uploads live in server memory and vanish on restart.
- **Live AI depends on the owner's laptop:** JARVIS must be running and reachable (Cloudflare Tunnel) for deployed chat; otherwise visitors get offline profile answers.
- **Local model latency:** CPU-only `llama3.2` took 14–24 s per answer (~2 tokens/s while OneDrive sync loaded the CPU). Moving projects out of OneDrive / “Best performance” power mode is expected to help.
- **Lovable sync:** pushing `new` syncs to Lovable; avoid history rewrites.
- **Secrets stay server-side:** AI keys, admin secrets and bucket bindings only in server/deployment environment, never in client code.
- **Canonical URLs** are relative until `VITE_SITE_URL` is set in the deployment.

## 5. Open decisions for the owner

1. Push `new` (triggers CI and Lovable sync) and open a PR to `dev`?
2. Sai's monogram: “DR” (first + last name) or “DS” (profile data)?
3. Delete the original large photos and the 3 unused images flagged by `npm run audit:images`?
4. Provide resume files and personal hero photos for Ammu, Bava and Sai?
5. Keep OpenAI as a fallback provider or JARVIS + offline only?
6. Production target and domain (sets `VITE_SITE_URL`, tunnel hostname, R2 bucket).

## 6. Future scope / enhancement candidates

- Resume version history with one-click rollback; scheduled publish.
- Per-profile analytics (privacy-friendly) and a contact form with a real delivery service.
- Automated Playwright journeys in CI (chat, contact, admin publish/unpublish).
- Responsive `srcset` image pipeline and automatic WebP/AVIF generation on upload.
- Chat answer caching for common questions to hide local-model latency.
- Additional profiles via configuration only (no code changes).
- Dark/light theme toggle; multilingual content.

---

> **Historical notes below are retained for traceability.** Earlier “development stopped” / “testing paused” statements are superseded by the 2026-11-07 status above.

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


## Owner-approved product requirements baseline — 2026-11-08

This section records the owner's consolidated answers to the 50-question development requirements exercise. It supplements the implementation/status snapshot above and does not imply that future capabilities are implemented.

### Product direction and profile model

- The current product remains a personal portfolio for four people: Abhishek, Amulya/Ammu, Anjini/Bava and Sai/Darling.
- All four profiles use one shared template, design system and common functionality; profile-specific content and approved media differ.
- The owner/admin can manage the full experience: profiles, pages, sections, content, resumes, projects, credentials, images/galleries, themes, layout, navigation, SEO, AI configuration and publishing lifecycle.
- Additional profiles and configurable profile creation/permissions are future extensibility requirements. The current owner-only admin model remains the initial authorization model.
- The current product is personal. Its architecture, templates, content model and configuration should be reusable for future client-specific customizations, but a multi-tenant commercial platform is not part of the immediate scope.

### Visitor experience and content management

- Preserve the cinematic portfolio experience while supporting all requested visitor journeys, pages, project exploration and contact/business capabilities.
- The CMS should support original resume files plus structured extracted data, profile-scoped knowledge, draft/review/publish/unpublish, version history, rollback, media metadata, import/export and audit history.
- Dynamic profile content and AI knowledge must come from approved profile data and authorized sources; private originals, drafts and review notes remain private.
- Visual customization should ultimately support editable themes, fonts, colors, layout, reusable components and templates through an admin-facing visual configuration experience.

### JARVIS-powered AI integration

- JARVIS is the portfolio's primary AI engine and agent service. Portfolio remains a separate visitor-facing application and sends only the selected profile's approved, bounded context to JARVIS.
- Remove dependence on a third-party paid API as the primary assistant. JARVIS availability, authentication and offline behavior must be handled explicitly; no API key or secret is exposed to the browser.
- Support profile-aware introductions and chat, project/skills/experience Q&A, multilingual and optional voice experiences as capabilities mature.
- Profile persona, response style, knowledge scope and system instructions are configurable by the owner/admin within the shared security and privacy rules.

### Storage, privacy and deployment

- Use adaptive local, database and cloud storage according to data importance, complexity, privacy and operational needs; define clear source-of-truth and synchronization rules.
- Provide visitor consent, minimal collection by default, retention controls, deletion, export and privacy notices/controls.
- Preserve server-side authentication and secret boundaries. Current access is owner-only; future roles and permissions can be added when required.
- Deployment should remain portable and cost-conscious, with clear configuration for application hosting, database, object storage, CDN and the JARVIS connection.

### Future reusable-client direction

- Keep profile data, themes, sections, components, AI persona and integration settings configuration-driven where practical.
- Future client onboarding should be able to start from a reusable template and apply client-specific branding, content, modules, integrations and permissions without copying business logic.
- Do not introduce multi-tenancy, client billing or commercial account workflows into the current personal release without a separate owner decision.

## Authoritative continuation update — 2026-11-09 12:22 IST

**Inspected branch head:** `new` · `3605e922ef469d821e19dde8b5f079799ccedab4` (merge commit). The earlier feature SHA in this POC is a historical checkpoint, not the current branch head.

### Current disposition
- **Development: ACTIVE on `new`. Testing/validation: PAUSED by owner.** No tests, typecheck, lint, build, image audit, browser/accessibility checks, CI/Jenkins or release validation may be started until explicitly resumed.
- Current source includes profile-aware routes/content, JARVIS-first server-side AI provider selection, protected admin managers, resume/image review and publishing workflows, storage adapters/migration, backup/restore, audit history and release-integrity tooling.
- Resume publishing/reconciliation, persistent production storage/configuration, real admin-session acceptance, full profile/content isolation and production JARVIS connectivity remain **PARTIAL or IMPLEMENTED — NEEDS TESTING** as appropriate; do not claim production-ready.
- The current `README.md` AI configuration text is stale: it still describes OpenAI Responses API as the only provider, while `src/lib/ai-provider.ts` selects JARVIS first and permits OpenAI only with explicit paid-fallback opt-in. This documentation mismatch remains to be corrected.

### Active development order
1. Complete resume publish/unpublish/rollback consistency and partial-failure reconciliation across private index, public feed and object storage.
2. Finish production admin authentication/session and private storage configuration boundaries.
3. Complete profile-scoped public content and JARVIS chat failure/stream cancellation handling.
4. Close image/resume manager failure states and accessibility gaps.
5. Finish DevOps release disposition and gated promotion implementation without executing release operations.

### Non-negotiable requirements and constraints
- Four profiles remain strictly isolated: Abhishek, Amulya, Anjini and Sai. Public content must be approved, profile-scoped metadata; private originals, drafts, source notes and admin records never enter public pages or AI context.
- JARVIS is the primary AI provider. Cloud/paid OpenAI fallback is allowed only with explicit `PORTFOLIO_AI_ALLOW_PAID_FALLBACK=true` and server-side credentials. No key in browser bundles, source control or logs.
- Zero ongoing cost/free-first defaults; no paid hosting/storage/model dependency without owner approval.
- No tests/build/lint/audits/browser/CI/device validation while paused. Development and documentation updates only.
- Work only on `new`; no PR, merge, push to `dev`/`main`, deployment, production secret change, artifact publication or Nexus enablement without explicit authorization. Keep Nexus disabled.

**Evidence rule:** source presence is implementation only. Every changed/new story remains OPEN / NEEDS TESTING until exact-head checks and owner acceptance are completed after testing resumes.


## Resume publishing integrity update — 2026-11-09

A source-level hardening increment was added to `src/lib/resume-publish-history.ts`: persisted history validation now validates nested contact and structured-section records, allowed keys, per-field bounds, profile ownership, skill limits and timestamp/rollback metadata. Regression cases were authored in `src/test/resume-publish-history.test.ts`; **they were not executed because testing is paused**. This closes a validation gap only. It does not resolve object-storage non-transactionality or prove publish/unpublish/rollback recovery. PORT-US-013 remains partial until that work and later acceptance are complete.



## Post-Claude source review — 2026-11-09 13:30 IST

**Branch reviewed:** `new`. Compared with the previously recorded development baseline, the latest increment updates the resume publish-history admin panel and server-side resume APIs.

### Newly implemented in source — not tested
- The per-profile Publish History panel loads append-only history, displays the next rollback target, and requires explicit confirmation before rollback.
- An authenticated consistency endpoint compares the public approved-resume feed with the private resume index and reports missing private resume files.
- An owner-confirmed reconciliation endpoint rebuilds the public feed from the private index and reports whether the feed was already in sync and which indexed files are missing.
- The history validator enforces profile ownership, timestamp/rollback metadata and bounded/allowed structured fields; targeted regression tests are authored.

### Remaining work and acceptance
- Feed reconciliation repairs the public feed only; it does not recreate missing private original files or make private-index, original-file and public-feed writes transactional.
- Recoverable partial-failure handling across all storage writes remains incomplete. Keep PORT-US-013 **PARTIAL — NEEDS DEVELOPMENT / TESTING**.
- Regression tests were not run. No tests, builds, typecheck, lint, audits, browser checks, CI/Jenkins or release validation were run for this increment. Four-profile isolation and private/public data separation remain mandatory.


## Authoritative testing and status refresh — 2026-11-09 (test branch)

**Branch:** `test`  
**Exact branch head inspected:** `0f90a96c47a1a36826306ca5bd26a1f7b263acfe`  
**Status:** core application and local automated suite are substantially implemented; exact-head CI is RED; production and owner acceptance remain incomplete. This section supersedes older statements that testing is paused.

### Antigravity local test report

- **22 suites / 138 test cases listed.**
- **137 passed, 0 failed, 1 skipped** (Win32 filesystem symlink-policy check).
- **100% pass rate among runnable tests (137/137)**; 137/138 = **99.3% executed** when the skipped case is included in the denominator.
- Local TypeScript check is reported clean.
- The report does not record the exact Git commit SHA used for the local run; treat it as local evidence only.

### Exact-head GitHub Actions evidence

Run: [Verify portfolio #42591418653](https://github.com/ASAA1229/pixel-perfect-pixel/actions/runs/42591418653)  
Head: `0f90a96c47a1a36826306ca5bd26a1f7b263acfe`  
**Overall: FAILED.**

Passed: dependency installation, CycloneDX SBOM generation, production build and TypeScript check.

Failed: ESLint due to Prettier formatting violations in:
- `src/lib/admin-auth.test.ts`
- `src/lib/local-disk-bucket.test.ts`
- `src/lib/resume-publish-history.ts`
- `src/server.ts`
- `src/test/resume-publish-history.test.ts`

The test step and SBOM upload were skipped after lint failed. The local report's passing tests therefore do not replace a green exact-head CI run.

### Completion percentages

- **Antigravity local runnable-test pass rate:** **100% (137/137)**.
- **All listed test cases executed:** **99.3% (137/138)**; one platform-specific symlink test was skipped.
- **Exact-head CI acceptance:** not complete (workflow is red; lint blocks the test step).
- **Production/owner acceptance:** not complete.
- **Overall product/development completion:** no single percentage is assigned; open storage, resume recovery, production security, JARVIS gateway, accessibility and release gates are not measured by test-case counts.

### Remaining work — priority order

1. Resolve the Prettier lint failures in the five listed files; rerun lint and the full exact-head CI suite.
2. Reconcile resume publish/rollback/unpublish failures across private index, original files and public feed; feed rebuild does not recreate missing originals and is not a multi-store transaction.
3. Complete durable R2 storage, production admin authentication/session expiry, authorization and upload boundary checks.
4. Verify four-profile isolation, content precedence, invalid routes/HTTP 404 behavior and public/private data separation in browser E2E.
5. Complete JARVIS gateway integration through the approved deployment/tunnel path; preserve local-first and explicit paid-fallback opt-in.
6. Finish automated admin journeys (resume/image upload, review, publish, unpublish, rollback, backup/restore) and browser acceptance.
7. Complete screen-reader/keyboard, responsive, reduced-motion and performance acceptance.
8. Verify production configuration, SEO, release integrity, rollback and owner approval before any deployment.

**No production release is accepted.** Do not merge, deploy, publish artifacts, provision production secrets/R2 or enable Nexus without explicit owner approval.


## Current development increment — backup integrity guard (2026-11-12)

- **Branch:** `new`
- **Implementation commits:** `de45fe42` (reject incomplete backup export/validation/restore/migration) and `7fce418d` (regression tests).
- Version-2 backups can no longer pass validation when an index references a missing private resume/image original or approved public image copy.
- Backup export fails with the missing storage key instead of producing a misleadingly complete file.
- Restore has a second defensive check and performs no writes for an incomplete payload.
- Migration stops before destination writes when the source is incomplete.
- **Validation:** NOT RUN by instruction. The tests are authored only; no build, typecheck, lint, test, browser, audit or CI result is claimed.


## Current development increment — root CMS coverage (2026-11-12)

- **Branch:** `new`
- Root contact panel and contact landing page now prefer approved published resume contact details, then owner-published CMS details, then curated defaults.
- Homepage, shared site footer and contact panels consume CMS contact/social overrides. Only HTTPS URLs on the expected LinkedIn/GitHub domains are accepted for those links; invalid or mismatched URLs fall back to curated destinations.
- CMS supports validated skill groups (unique categories, unique items, bounded text/list sizes); the admin content editor exposes the new field.
- Abhishek's root Skills page renders published CMS skill groups. Shared person-profile merging also applies skill overrides to the other profile experiences.
- Added regression tests for contact fallback/URL validation, skill override/fallback and skill schema validation/profile merge.
- **Validation:** tests are authored only and remain unrun. No build, typecheck, lint, browser, accessibility or production result is claimed.


## Current development increment — resume reconciliation guard (2026-11-12)

- **Branch:** `new`
- Resume consistency remains observable through the admin consistency endpoint, including missing original IDs.
- The reconcile mutation now returns HTTP 409 with `RESUME_ORIGINALS_MISSING` when any indexed original is absent. It does not rewrite the public approved-resume feed in that state.
- Added a route-level failure-path regression test that publishes a resume, removes its private original, attempts reconciliation, and asserts the public feed remains byte-for-byte unchanged.
- **Validation:** test authored but not executed. Storage behavior under hosted R2 and other publish/rollback/unpublish failure combinations remains unverified.


## Current development increment — image lifecycle compensation (2026-11-12)

- **Branch:** `new`
- Added `commitImageState` in `src/server.ts`: it snapshots affected object keys before writes, applies image state changes in order and compensates attempted writes in reverse order, including an ambiguous write that persisted before returning an error.
- Image upload/publish-on-upload, replacement, publish, unpublish and delete now use the compensating helper for private originals, public copies, the image index and superseded copies.
- Image failure responses expose a `restored` signal so an incomplete compensation is not reported as a successful rollback.
- Added `src/test/image-failure-paths.test.ts` for injected ambiguous index-write failures across upload, replace, publish, unpublish and delete.
- **Still open:** resume/image cross-request concurrency, durable recovery records when compensation itself fails, verified-original restore workflows, hosted R2 acceptance and exhaustive storage failure injection.
- **Validation:** tests authored only; not executed. No build, typecheck, lint, browser, audit or CI run was performed. Testing remains paused.


## Current development increment — resume history compensation coverage (2026-11-12)

- Extended `src/test/resume-failure-paths.test.ts` to inject an ambiguous write failure after the resume publish-history object is persisted.
- The regression case checks compensation returns the resume to pending, restores an empty public feed and restores the prior empty history state.
- Existing tests also cover public-feed failures before and after persistence and rejection of reconciliation when a private original is missing.
- **Still open:** durable recovery records when compensation itself fails, cross-request/distributed concurrency, post-commit private-original cleanup failure handling and hosted R2 acceptance.
- **Validation:** tests authored only; no tests/build/typecheck/lint/browser/CI executed. Validation remains paused.


## Current development increment — admin control room and unified navigation (2026-11-12)

- Added `src/components/AdminNavigation.tsx` as the shared navigation for the private owner workspace.
- Integrated consistent navigation into the content, AI persona, resume, image, backup/restore and audit managers.
- Rebuilt `/admin` as a control room for all four profiles. It reads the existing admin APIs and summarizes resume/image review queues, content/persona draft and published states, storage availability and recent audit actions.
- Added direct public-profile and editor shortcuts, manual refresh, and local/all-device session sign-out controls.
- Dashboard aggregation is read-only. When an API source is unavailable, the dashboard identifies it and warns that counts may be incomplete rather than implying a complete inventory.
- Added PORT-US-049 to `docs/USER_STORIES.md`; the admin experience is implemented in source but is not accepted or complete until validation and owner review.
- **Validation:** no tests, build, typecheck, lint, browser/device/accessibility checks or CI were run. Testing remains paused.

## Current development increment — dynamic admin workflows (2026-11-12)

- Added profile filtering to the resume inventory while preserving its existing search and status filters.
- Added image search, profile filtering and publication-status filtering to the image inventory.
- Added audit-history search and outcome filtering.
- Added a live in-page preview of the current unpublished content editor state, with project/skill/experience/education and SEO summaries. The preview does not publish or alter public data.
- The admin workspace continues to use authenticated server APIs for content/persona versioning, image/resume lifecycle, backup/restore, storage migration and audit history.
- **Validation:** no tests/build/typecheck/lint/browser/accessibility/CI were run. Validation remains paused.


## PORTFOLIO ADMIN RESOURCE MANAGEMENT — 2026-11-12

Admin-managed resumes and images are intended to be the source of truth for public profile resources. The public UI must consume profile-scoped published API feeds; it must not require edits to bundled image paths or static resume links when an owner publishes a replacement. Pending uploads and private source documents remain private until publication. Unpublish/restore must update the public view safely, and curated content is only a fallback when no published resource exists.

**Implemented in this source increment:** shared published-image normalization/hook; Abhishek home portrait and About hero/gallery consume published image records; other person-profile portrait and gallery views consume the same shared profile-scoped feed, with published gallery records replacing the curated gallery when present. Existing published resume metadata already feeds selected profile headline, summary, skills, structured sections and approved contact surfaces.

**Still open:** dynamic download of the active published resume binary from a public profile-safe endpoint; complete audit of all four profiles and every image placement; confirmation that publish/replace/unpublish/rollback invalidates public caches and that restored versions become active; admin active-resource visibility and failure recovery. The implementation is partial, not end-to-end complete. Tests/build/typecheck/lint/browser/accessibility/CI remain paused and were not run.


## PORT-US-050 follow-up — published resume binary and profile downloads (2026-11-12)

**Status:** IMPLEMENTED IN SOURCE / VALIDATION PENDING

- Added a read-only public resume binary endpoint at `GET /api/published-resumes/:id`. It resolves the record from the private index and serves the original file only while that exact record is approved and assigned to a public profile.
- Updated the shared resume action to resolve the active published resume ID from the public feed rather than a hardcoded static file path.
- Added the same profile-aware download action to Amulya, Anjini and Sai profile home pages.
- Existing resume metadata continues to populate published profile headline, summary, skills, structured experience, education, projects, certifications and contact surfaces where supported.

The endpoint has not been tested. Published feed and media responses now require immediate revalidation (`max-age=0`); runtime cache behavior, storage failures, profile isolation, browser download behavior and all four profile journeys remain unverified. Validation is still paused.


## Admin image inventory — active public resource visibility (2026-11-12)

The image manager now compares private inventory records with the public published-image feed. It identifies the currently selected portrait per profile and published gallery items as “Live on profile”, while distinguishing other approved images as “Published · not selected”. It also displays a specific empty state when the active search/profile/status filters return no results. If the public feed cannot be read, Admin does not claim that a resource is live. This is source implementation only; runtime behavior has not been validated.


## Admin resume inventory — active public resource visibility (2026-11-12)

The resume manager now reads the private admin inventory and public approved-resume feed independently. It distinguishes the exact resume currently served for a profile (“Live on profile”) from approved-but-not-active records. If the public feed is unavailable, it displays an unknown state rather than claiming that approval proves public visibility. Publish and unpublish actions refresh the feed-backed status after the server confirms success. This is source implementation only; runtime behavior has not been validated.


## Admin image version history and safe restore (2026-11-12)

- Replacements now preserve the previous private image and a metadata sidecar (filename, content type, byte size and timestamp).
- The Admin image manager can list available restorable versions and restore a selected version.
- Restore validates the version ID, metadata, exact byte size and JPEG/PNG/WebP/AVIF signature. It first snapshots the current image as a new version, then updates private storage, the public object when approved, and the image index using compensating writes.
- Older byte-only snapshots without metadata are excluded from restore choices; no filename or MIME type is guessed.
- Cleanup permanently deletes superseded versions and therefore removes their restore capability.
- **Validation:** no tests/build/typecheck/lint/browser/accessibility/CI were run. Source implementation is unverified.

## Project-specific image placement — 2026-11-12

The image CMS now supports a project placement in addition to portrait and gallery. A project image is assigned to a profile ID and exact project URL slug. The public feed carries that assignment, and both Abhishek's root project-detail renderer and the shared person-project detail renderer load only approved images matching both values. Automated normalization regression coverage has been authored but not executed. Admin upload requires the project slug and the inventory displays the assignment; approved project images count as active public resources.

This is source implementation only. Route coverage (especially Abhishek's project detail route), publication lifecycle, stale cache behavior, and cross-profile isolation still require validation. Existing portrait/gallery records remain compatible. No tests/build/typecheck/lint/browser/accessibility/CI checks were run; validation remains paused.

## Four-profile public resource lifecycle and image placement audit — 2026-11-12

Public image placements were audited across the profile selector, Abhishek's homepage and About page, the three shared person-profile homes and About sections, profile project cards, Abhishek's project index/featured showcase, and all project-detail renderers. Personal portrait, gallery and project media now resolve through the published image feed using profile ID and, for project media, exact project slug. The profile selector now uses the shared feed normalizer. The normalizer rejects malformed UUIDs, mismatched image URLs, empty alt text, invalid project slugs and project slugs on non-project placements. Abhishek's static duplicate profile image with inaccurate alternative text was removed. Bundled portrait/gallery assets remain intentional fallbacks; shared brand billboards, backdrops and logo remain static design assets.

Both image and resume admin APIs accept the four public profile IDs. Added integration-test source for each profile covering the image lifecycle (private upload, publish, replace, restore, unpublish, republish and delete) and resume lifecycle (private upload, publish, supersede, history, rollback, unpublish, private download and delete/history redaction). Added normalizer coverage for cross-profile image feed isolation.

Implementation and test source only. No tests, builds, typechecks, lint, browser, accessibility, CI or storage-provider checks were run because validation remains paused. Verify all public routes, lifecycle operations, cross-profile isolation, cache behavior, R2/local-disk consistency and failure compensation before acceptance.