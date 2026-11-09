# Portfolio — User Stories and Acceptance Criteria

**Repository:** `ASAA1229/pixel-perfect-pixel`
**Branch:** `new`
**Updated:** 2026-11-09 (development resumed; testing paused)
**Rule:** A story is fully closed only when its acceptance criteria are evidenced; production/CI evidence is still pending for every story.

Epic mapping: [EPICS.md](EPICS.md) · Project overview, constraints and future scope: [POC.md](POC.md)

## Evidence boundary — 2026-11-09

Development is active on `new`; **testing is PAUSED**. The latest previously inspected commit is `9f4a923143eeb2deab4b3288a3e9e067f4f8edd3`; a route-handling development commit `96e2a4ca65605aef92b3cea737b7312641d601fb` was added after it. Do not reuse the 2026-11-07 local test/build/browser evidence as proof for these newer commits. No tests, typecheck, lint, build, browser checks or CI were run for this update. Every newly implemented item remains NEEDS TESTING.

## Status vocabulary

- **DONE — VERIFIED (automated):** covered by passing automated tests on the current head (local run).
- **DONE — VERIFIED LOCALLY:** checked on the dev server / Edge browser on the owner's laptop.
- **IMPLEMENTED — NEEDS TESTING:** built; the named test is still required.
- **PARTIAL — NEEDS DEVELOPMENT:** some behaviour exists; listed gaps remain.
- **NOT STARTED:** no implementation yet.

Local evidence (2026-11-07): typecheck 0 · lint 0 errors · 107 Vitest + 4 Node tests · build OK · 43 sitemap routes 200 · Edge 1440/390 px clean · axe serious 62 → 2 (false positives). No CI/production run yet.

## Story status summary

| Story | Status |
|---|---|
| US-001 Consistent shared experience | DONE — VERIFIED LOCALLY |
| US-002 Correct identity and media | DONE — VERIFIED LOCALLY (owner content review pending) |
| US-003 Cinematic presentation | DONE — VERIFIED LOCALLY |
| US-004 Navigation | DONE — VERIFIED LOCALLY |
| US-005 Project and section pages | DONE — VERIFIED LOCALLY |
| US-006 Legacy routes | DONE — VERIFIED (automated) |
| US-007 AI introduction | IMPLEMENTED — NEEDS TESTING |
| US-008 Grounded chat | DONE — VERIFIED LOCALLY |
| US-009 Secure AI requests | DONE — VERIFIED (automated) |
| US-010 Voice/video intro | IMPLEMENTED — NEEDS TESTING |
| US-011 Protected owner access | IMPLEMENTED — NEEDS TESTING |
| US-012 Upload/review resumes | DONE — VERIFIED LOCALLY (persistent storage pending) |
| US-013 Publish/roll back resumes | PARTIAL — NEEDS DEVELOPMENT |
| US-014 Manage images | DONE — VERIFIED LOCALLY (persistent storage pending) |
| US-015 Engineering checks | DONE — VERIFIED (automated); CI run pending |
| US-016 Browser acceptance | DONE — VERIFIED LOCALLY (journeys partial) |
| US-017 Regression coverage | PARTIAL — NEEDS DEVELOPMENT |
| US-018 Keyboard/assistive tech | DONE — VERIFIED LOCALLY (screen reader pending) |
| US-019 Responsive/reduced motion | DONE — VERIFIED LOCALLY |
| US-020 Performance | IMPLEMENTED — NEEDS TESTING |
| US-021 Search/social | DONE — VERIFIED (automated) |
| US-022 Controlled production release | NOT STARTED |
| US-023 Asset integrity | DONE — VERIFIED (automated) |
| US-024 Approved resume context for AI | DONE — VERIFIED (automated) |
| US-025 Streaming and cancellation | DONE — VERIFIED (automated) |
| US-026 Release/snapshot input validation | DONE — VERIFIED (automated) |
| US-029–032 DevOps provenance/integrity/SBOM | IMPLEMENTED — NEEDS TESTING (CI run) |
| US-033 Gated promotion | PARTIAL — NEEDS DEVELOPMENT |
| US-034 Chat uses the owner's JARVIS personal AI | DONE — VERIFIED LOCALLY |

## PORT-E01 — Shared Design System and Four-Profile UI

### PORT-US-001 — Consistent shared experience

**Current implementation status:** **DONE — VERIFIED LOCALLY** — All four profiles share one template (`0b2308f`); Edge pass at 1440/390 px. Remaining differences: generic hero images for Ammu/Bava/Sai, two near-duplicate contact components.

**As a visitor,** I want all four profiles to share a consistent design system, so that the portfolio feels like one cohesive product.

**Acceptance criteria**
- All profiles use the shared layout, navigation, typography, spacing and responsive rules.
- Profile-specific styling is limited to intentional, documented differences.
- Shared component changes appear consistently across all four profiles.
- Visual review covers desktop, tablet and mobile.

### PORT-US-002 — Correct profile identity and media

**Current implementation status:** **DONE — VERIFIED LOCALLY** — Person pages show only their own facts; each profile has its own monogram (Abhishek keeps the GA. logo); asset-integrity tests pass. Owner content review and Sai monogram decision (DR vs DS) pending.

**As a visitor,** I want each profile to display the correct person's facts and images, so that identities and information are never mixed.

**Acceptance criteria**
- Each profile displays only its own approved biography, skills, projects, experience, education and certifications.
- Images belong to the correct profile and include meaningful alt text.
- Missing assets use a safe fallback without breaking layout.
- Private/admin-only information is never rendered publicly.

### PORT-US-003 — Cinematic page presentation

**Current implementation status:** **DONE — VERIFIED LOCALLY** — Chapter heroes, featured projects and Reveal motion on every profile; reduced motion honoured.

**As a visitor,** I want portfolio sections to have the same polished visual quality as the home page, so that the experience remains engaging throughout.

**Acceptance criteria**
- About, Skills, Projects, Experience, Certifications, Education and Contact follow the approved visual language.
- Technology logos/assets are accurate and used with appropriate licensing/attribution.
- Motion is purposeful, responsive and disabled or reduced when the user requests reduced motion.
- Content remains readable at supported screen sizes.

## PORT-E02 — Routes, Navigation and Portfolio Content

### PORT-US-004 — Reliable profile and section navigation

**Current implementation status:** **DONE — VERIFIED LOCALLY** — 33-route matrix and 43 sitemap routes return 200; unknown profile/section/page return 404; navbar tests pass.

**As a visitor,** I want to navigate between profiles and their sections, so that I can find information without broken links.

**Acceptance criteria**
- Every visible navigation item opens its intended route.
- Direct URL load and browser refresh work for every supported route.
- Active navigation reflects the current route.
- Invalid profile/section paths show a deliberate not-found experience.

### PORT-US-005 — Complete project and section pages

**Current implementation status:** **DONE — VERIFIED LOCALLY** — Section and project pages render for all profiles with published-resume precedence; broken home project links fixed with 301s.

**As a visitor,** I want project and portfolio detail pages to load complete information, so that I can understand each person's work.

**Acceptance criteria**
- Project detail pages resolve the correct project by stable slug.
- Skills, experience, education and certifications show the correct profile data.
- Empty sections have an intentional empty state.
- Internal and external links resolve to the intended destination.

**Implementation notes:** The shared published-resume panel is now fed from the page's profile-scoped normalized data. Abhishek's five content routes prefer valid published section data and use the curated static portfolio only when the matching published section is empty. Other profile routes retain the shared profile-aware renderer. Direct-load, refresh and cross-profile acceptance remain unverified while testing is paused.

### PORT-US-006 — Preserve legacy route behavior

**Current implementation status:** **DONE — VERIFIED (automated)** — `/portfolio` → 301 `/`, `/people/abhishek` → `/`, `/people/darling` → `/people/sai`; routing test plus dev-server check.

**As a returning visitor,** I want existing supported portfolio links to keep working, so that updates do not break bookmarks or shared URLs.

**Acceptance criteria**
- Legacy routes either continue to work or redirect to a documented replacement.
- Profile selection and profile-specific routes remain consistent.
- No redirect loop or route collision is introduced.
- Route behavior is covered by regression checks.

## PORT-E03 — AI Introduction and Portfolio Chat

### PORT-US-007 — Profile-aware AI introduction

**Current implementation status:** **IMPLEMENTED — NEEDS TESTING** — Profile-aware intro context exists; test: open AI Intro on each profile in a real browser and confirm silent open and close.

**As a visitor,** I want the introduction to describe the selected person accurately, so that I receive relevant information.

**Acceptance criteria**
- The assistant uses only the selected profile's approved context.
- Switching profiles updates the assistant's context.
- Unknown facts are acknowledged rather than invented.
- The introduction can be dismissed and does not unexpectedly play audio.

### PORT-US-008 — Grounded portfolio chat

**Current implementation status:** **DONE — VERIFIED LOCALLY** — Live chain portfolio → JARVIS → llama3.2 returned answers grounded in Ammu’s and Sai’s data; offline fallback tests pass.

**As a recruiter or visitor,** I want to ask questions about a profile, so that I can quickly understand skills and experience.

**Acceptance criteria**
- Answers are grounded in current portfolio data and approved resume additions.
- The assistant does not invent projects, qualifications, employers or dates.
- Private resume files, review notes and admin data are not included in public context.
- Empty/unknown answers are handled honestly.

### PORT-US-009 — Secure and resilient AI requests

**Current implementation status:** **DONE — VERIFIED (automated)** — Keys server-side only; request bounds; provider 401/429 mapped to safe messages; idle-based timeouts.

**As the owner,** I want AI provider credentials and requests handled securely, so that the integration cannot expose secrets or fail unsafely.

**Acceptance criteria**
- The API key is read only from a server-side environment variable.
- No key appears in client bundles, source control, logs or error responses.
- Request size/input validation and rate limiting are enforced.
- Missing/invalid key, timeout, provider failure and rate limiting return safe feedback.
- Cancellation and retry behavior do not leave stale or duplicated responses.

### PORT-US-010 — Accessible voice and video introduction

**Current implementation status:** **IMPLEMENTED — NEEDS TESTING** — Narration/video controls exist; test on a phone and desktop browser (play/pause/close, no autoplay).

**As a visitor,** I want optional voice/video controls, so that I can choose how to experience the introduction.

**Acceptance criteria**
- Audio/video starts only after an explicit user action.
- Play, pause, replay and close controls remain synchronized.
- Unsupported microphone/browser features have a usable fallback.
- Closing the introduction stops its own playback and cleans up resources.
- Reduced-motion preferences are respected.

### PORT-US-034 — Chat uses the owner's JARVIS personal AI

**Current implementation status:** **DONE — VERIFIED LOCALLY** — `/api/chat` resolves the provider server-side (`src/lib/ai-provider.ts`); live local chain answered with profile-grounded text; provider, request-shape and 401 tests pass. Production needs a Cloudflare Tunnel to JARVIS and deployment secrets.

**As the owner,** I want the portfolio chat to use my JARVIS personal AI through an API key, so that my sites run on my own AI instead of a paid third-party API.

**Acceptance criteria**
- When `JARVIS_AI_URL` and a valid `JARVIS_AI_KEY` (`jrv_…`) are set, chat requests go to JARVIS `/v1/chat/completions` with the profile instructions as the system message.
- JARVIS URLs must be https, except loopback for local development; keys stay in server-side environment only.
- If JARVIS is not configured, OpenAI is used when `OPENAI_API_KEY` is set; otherwise the API returns 503 and the UI shows offline profile answers.
- Only assistant text is streamed to the browser; provider errors map to safe messages without leaking keys.
- Slow answers are not cut off: timeouts apply to silence (45 s, reset by keep-alives) with a 5-minute ceiling.

## PORT-E04 — Admin, Resume and Image Management

### PORT-US-011 — Protected owner access

**Current implementation status:** **IMPLEMENTED — NEEDS TESTING** — Server-side admin gate on `/admin` and every `/admin/*` + `/api/admin/*`; cross-origin mutations rejected; `/admin` hub added. Test: real login, logout and session expiry in a deployed environment (dev uses a local bypass).

**As the owner,** I want admin routes and APIs protected by server-side authentication and authorization, so that only I can manage portfolio content.

**Acceptance criteria**
- Unauthenticated and unauthorized requests cannot read or mutate admin data.
- Authorization is checked on every server-side loader, action and API.
- Session expiry and logout invalidate access.
- Errors do not reveal protected record or file existence.

### PORT-US-012 — Upload and review resumes

**Current implementation status:** **DONE — VERIFIED LOCALLY** — Upload HTTP 500 root cause fixed (body-limit helper, `f12ebb9`); false “Cannot read properties of null (reading reset)” error fixed (`9e9b761`); PDF upload, 415 for unsupported types and extraction verified. Persistent R2 storage not yet verified.

**As the owner,** I want to upload a resume for a selected profile and review extracted information, so that profile updates are easier to maintain.

**Acceptance criteria**
- Only supported file formats and bounded file sizes are accepted.
- Extension, MIME/content signature, filename and parser errors are validated.
- Extracted fields are mapped to the selected profile only.
- Extracted facts remain private/pending until reviewed and explicitly approved.
- Original resume files and review notes are not publicly accessible.

### PORT-US-013 — Publish and roll back resume content

**Current implementation status:** **PARTIAL — NEEDS DEVELOPMENT / TESTING** — Append-only publish/rollback history and a per-profile admin history panel with confirmed rollback are implemented. An authenticated consistency endpoint compares the public feed with the private approved-resume index and reports missing private files; an owner-confirmed reconciliation endpoint rebuilds the public feed from the private index. Still incomplete: recoverable/transactional handling across private index, original file storage and public feed writes. Reconciliation does not recreate missing originals. Regression tests are authored but not run.

**As the owner,** I want to publish approved resume-derived sections and roll them back, so that public profile updates remain controlled.

**Acceptance criteria**
- Profile assignment and required fields are validated before publishing.
- Only approved metadata/structured content appears on the matching profile.
- Existing verified portfolio facts are not silently overwritten.
- Unpublish/rollback removes public visibility while preserving private source data where appropriate.
- Partial storage/index failures are reported and reconciled safely.

### PORT-US-014 — Manage profile images

**Current implementation status:** **DONE — VERIFIED LOCALLY** — Upload → publish → public feed/identical bytes → unpublish (public URL 404) → delete on the dev server (in-memory storage). Persistent bucket acceptance pending.

**As the owner,** I want to upload, review, publish and unpublish profile images, so that galleries stay accurate and current.

**Acceptance criteria**
- Upload type, size and filename are validated.
- Files remain private/pending until the configured approval action.
- Published images are associated with the intended profile only.
- Unpublish removes public visibility without unintended data loss.
- Failed operations do not leave broken public references.

## PORT-E05 — Quality Engineering and Automated Testing

### PORT-US-015 — Repeatable engineering checks

**Current implementation status:** **DONE — VERIFIED (automated)** — typecheck, lint, tests and build pass locally; CI/Jenkins re-enabled with a strict typecheck step. First CI run happens after push.

**As a maintainer,** I want clean install, build, lint and test commands to pass, so that regressions are detected before release.

**Acceptance criteria**
- Clean dependency installation succeeds on the documented runtime.
- Production build, lint and all configured tests pass on the exact commit.
- CI results identify the commit SHA and actionable failure details.
- No check is marked passed without an executed result.

### PORT-US-016 — Browser-level acceptance

**Current implementation status:** **DONE — VERIFIED LOCALLY** — Edge pass over all profiles/sections at 1440/390 px with no page errors; admin upload checked in the browser. Chat/contact journeys are not yet automated.

**As a maintainer,** I want critical journeys tested in a real browser, so that issues missed by unit tests are detected.

**Acceptance criteria**
- All four profiles and their key section/project routes load.
- Navigation, profile switching, chat, contact and admin protection behave as expected.
- Direct route refresh and invalid-route behavior are checked.
- Desktop/tablet/mobile and keyboard interactions are recorded.

### PORT-US-017 — Regression and failure-path coverage

**Current implementation status:** **PARTIAL — NEEDS DEVELOPMENT** — New regressions cover archive inventory, request-body limit, legacy routes, person templates, SEO and provider selection; parser-failure and partial-persistence cases still missing.

**As a maintainer,** I want important error paths covered by tests, so that failures do not expose data or leave inconsistent state.

**Acceptance criteria**
- Tests cover invalid uploads, parser failures, unauthorized access and partial persistence failures.
- AI tests cover missing configuration, provider errors, rate limits and malformed responses.
- Profile isolation and public/private boundaries have regression tests.
- Test results are traceable to the commit under review.

## PORT-E06 — Accessibility and Responsive Experience

### PORT-US-018 — Keyboard and assistive-technology support

**Current implementation status:** **DONE — VERIFIED LOCALLY** — Skip link, visible focus, mobile-menu focus management, keyboard order checked; axe serious 62 → 2 (aria-hidden watermark false positives). Screen-reader pass pending.

**As a visitor using a keyboard or assistive technology,** I want all essential controls to be accessible, so that I can use the portfolio independently.

**Acceptance criteria**
- All interactive controls are keyboard reachable and have visible focus.
- Dialogs manage focus correctly and support Escape where appropriate.
- Headings, labels, landmarks and accessible names are meaningful.
- Images have suitable alt text; decorative images are ignored by assistive technology.
- Color contrast meets the project's chosen accessibility target.

### PORT-US-019 — Responsive and reduced-motion behavior

**Current implementation status:** **DONE — VERIFIED LOCALLY** — No horizontal overflow at 390 px; reduced-motion CSS disables non-essential motion.

**As a mobile or motion-sensitive visitor,** I want the site to adapt to my device and preferences, so that it remains comfortable to use.

**Acceptance criteria**
- Layouts work at agreed desktop, tablet and mobile breakpoints.
- No unintended horizontal overflow or clipped controls appear.
- Touch targets and text remain usable on mobile.
- Reduced-motion preference suppresses non-essential motion and autoplay.
- User-controlled audio/video remains optional.

## PORT-E07 — Performance, SEO and Production Readiness

### PORT-US-020 — Fast and reliable pages

**Current implementation status:** **IMPLEMENTED — NEEDS TESTING** — Profile photos 11.9 MB → 0.7 MB WebP (`bf23a66`). Test: Lighthouse/Web Vitals on the deployed site. Originals and 3 unused images await owner approval to remove.

**As a visitor,** I want pages and images to load reliably, so that I can explore the portfolio without unnecessary delay.

**Acceptance criteria**
- Large images are appropriately sized and optimized.
- Route loading and client bundles are reviewed for avoidable overhead.
- Loading, empty and error states are deliberate.
- Performance findings and material regressions are recorded.

### PORT-US-021 — Search and social presentation

**Current implementation status:** **DONE — VERIFIED (automated)** — `sitemap.xml` (43 routes), `robots.txt`, canonical/OG/Twitter via shared `seoHead`, admin `noindex`. `VITE_SITE_URL` must be set in production.

**As a visitor or recruiter,** I want portfolio pages to have accurate metadata and share previews, so that links are understandable when discovered or shared.

**Acceptance criteria**
- Important routes have accurate titles and descriptions.
- Canonical URLs and social preview metadata are correct.
- Sitemap/robots behavior matches the intended public routes.
- Private/admin routes are not exposed as public search content.

### PORT-US-022 — Controlled production release

**Current implementation status:** **NOT STARTED** — Deployment is not authorized; needs production secrets, CI evidence and owner approval.

**As the owner,** I want a documented release and recovery process, so that production changes are safe and reversible.

**Acceptance criteria**
- Production secrets are configured only through the hosting provider's secret store.
- Candidate commit and successful CI/browser evidence are recorded.
- Known limitations and rollback steps are documented.
- Production deployment occurs only after explicit owner approval.

### PORT-US-023 — Profile image asset integrity

**Current implementation status:** **DONE — VERIFIED (automated)** — Every referenced avatar/portrait/gallery image resolves to a committed file.

**As a maintainer,** I want every profile avatar, portrait and gallery reference to resolve to a committed public asset, so that broken images are caught before release.

**Acceptance criteria**
- Every profile-directory avatar reference resolves to a file under the public assets directory.
- Every portfolio portrait and gallery image reference resolves to a committed file.
- Missing image paths fail the automated test suite with the missing path listed.
- The check covers all supported profile entries and does not rely on remote network access.

## Additional stories — current hardening increments

### PORT-US-024 — Approved, profile-scoped resume context for AI

**Current implementation status:** **DONE — VERIFIED (automated)** — Only the matching profile’s approved resume is attached server-side; tested in chat API tests.

**As a visitor,** I want the portfolio assistant to use only the selected person's latest approved published resume information, so that answers are current without exposing private drafts or mixing profiles.

**Acceptance criteria**
- The server obtains resume context only from the approved published-resume feed.
- The selected profile ID is matched before context is attached or used.
- Client-supplied resume context cannot override server-approved context.
- Private drafts, original resume files and review notes are excluded.
- Resume content is treated as untrusted data; embedded instructions are ignored.
- Request-size limits remain enforced after context enrichment.
- Missing or unavailable approved context falls back safely without inventing facts.

### PORT-US-025 — Reliable AI streaming and request cancellation

**Current implementation status:** **DONE — VERIFIED (automated)** — Decoder flush, final SSE event, cancellation and idle timeouts covered by tests.

**As a visitor,** I want streamed assistant responses to finish completely and respect cancellation, so that I do not see truncated text, stale answers or speech after stopping a request.

**Acceptance criteria**
- Final buffered server-sent events are processed even when the stream ends without a newline.
- UTF-8 decoder buffers are flushed at stream completion.
- Only the active request may update the current conversation or busy state.
- Cancelled requests do not continue speaking or overwrite a newer response.
- Offline fallback content is shown in the conversation when the provider request fails.

### PORT-US-026 — Validate release and snapshot integrity inputs

**Current implementation status:** **DONE — VERIFIED (automated)** — Manifest and snapshot inventories validated; change-detection tests updated for the stricter schema.

**As a portfolio maintainer,** I want release manifests and environment snapshot inventories validated before comparison, so that unsafe paths or malformed metadata cannot produce misleading integrity reports.

**Acceptance criteria**
- Manifest inventory paths reject absolute, traversal, NUL-containing and Windows drive-relative/drive-prefixed paths.
- Duplicate manifest paths, invalid sizes and malformed SHA-256 digests are rejected.
- Snapshot inventories validate schema, file count, unique safe paths, sizes and SHA-256 values.
- Baseline and snapshot ignore policies must be equivalent; policy entries are deduplicated and sorted before comparison.
- Invalid inputs fail closed and do not produce a success report.

**Scope:** This story covers generic repository integrity utilities only, not the separate CMM/Nexus product.

## PORT-E08 — Shared DevOps Pipeline, Provenance & Artifact Integrity

### PORT-US-029 — Generate traceable portfolio build provenance

**Current implementation status:** **IMPLEMENTED — NEEDS TESTING** — Provenance manifest and release identity exist; test: exact-head GitHub Actions/Jenkins run.

**As a release maintainer,** I want every portfolio artifact to include a machine-readable provenance manifest, so that its project, source revision and CI origin can be identified.

**Acceptance criteria**
- The manifest records project identity, repository, normalized branch, full source commit, build number and CI provider/run metadata.
- Required fields are nonblank, non-placeholder and structurally valid.
- CI metadata is compared with current environment values when available.
- A deterministic release identity binds the project/source/build identity.
- Missing or mismatched required provenance blocks acceptance.

### PORT-US-030 — Validate manifest inventory and artifact integrity

**Current implementation status:** **IMPLEMENTED — NEEDS TESTING** — Archive-backed inventory verification works locally (verifier SyntaxError and Windows tar bug fixed; tests pass); CI run pending.

**As a release maintainer,** I want manifest inventory metadata and SHA-256 values validated before artifact acceptance, so that malformed or tampered packages are rejected.

**Acceptance criteria**
- Manifest schema version and checksum algorithm are supported and validated.
- Declared file count equals the inventory array length.
- Every file entry has a safe relative path, unique normalized path, non-negative safe-integer size and canonical SHA-256 digest.
- Invalid inventory metadata is rejected before checksum verification.
- The verifier compares archive members with the declared inventory and validates each file's size/hash before claiming archive-content integrity.
- The customer release verifier validates manifest metadata, exact file count, artifact metadata, unique safe paths and per-file digest/size before accepting the inventory.
- The authenticated policy's project, source commit and build number match the manifest.
- Windows path separators are normalized before path validation.

**Implementation notes:** strict manifest validation and archive-backed inventory comparison are implemented in `scripts/customer-release-verifier.mjs`. The verifier inspects `.tar.gz` member paths/types, rejects unsafe paths and links, extracts to an isolated temporary directory, then compares each file's path, size and SHA-256 with the manifest. GitHub Actions and Jenkins pass the archive directly. Policy creation also rejects a package whose filename, size or SHA-256 does not match the manifest. System `tar` is required; automated execution remains paused.

### PORT-US-031 — Verify customer packages and explain failures

**Current implementation status:** **IMPLEMENTED — NEEDS TESTING** — Structured failure report verified by test; CI artifact retention unverified.

**As a release operator,** I want a consistent customer-package verification sequence with a useful report, so that delivery failures can be diagnosed safely.

**Acceptance criteria**
- Manifest-ignore policy is authenticated and evaluated before manifest processing.
- Manifest schema, provenance and release identity are validated before package acceptance.
- Package checksum is checked against trusted release metadata.
- Reports identify the failed validation stage and reason without disclosing secrets.
- CI persists the structured failure report when customer verification fails.
- Verified release bundles are archived with traceable fingerprints/metadata and bounded retention.
- A failed verification cannot enter the successful release archive or promotion path.
- Legacy behavior is explicitly bounded and cannot bypass strict-provenance mode.

### PORT-US-032 — Produce SBOM-backed and signed CI artifacts

**Current implementation status:** **IMPLEMENTED — NEEDS TESTING** — SBOM/signing pipeline defined; needs a CI run with signing secrets.

**As a release maintainer,** I want GitHub Actions and Jenkins to produce traceable artifacts with dependency SBOM and integrity metadata, so that releases can be independently reviewed.

**Acceptance criteria**
- Configured pipelines package artifact, manifest, checksum, signature metadata and CycloneDX SBOM.
- Signing credentials are available only to signing operations and temporary key files are cleaned up.
- Pipeline steps stop on command failures and reject incomplete output.
- CI configuration is documented using secret/variable names only.
- Exact-head pipeline execution and artifact inspection are recorded before acceptance.
- Nexus publication remains disabled until separately authorized.

### PORT-US-033 — Gate promotion and deployment on release evidence

**Current implementation status:** **PARTIAL — NEEDS DEVELOPMENT** — Quarantine/recovery records exist; promotion gating and rollback exercise not done; Nexus disabled.

**As the portfolio owner,** I want promotion and deployment to remain controlled by explicit approval, so that unverified artifacts cannot be published.

**Acceptance criteria**
- Feature development remains on authorized `new` branch and integration promotion follows the documented branch policy.
- Failed artifacts can be rejected/quarantined with an actionable reason.
- Rollback and recovery instructions are documented.
- No merge to production, deployment or Nexus publication occurs without explicit owner approval.
- Testing and pipeline acceptance remain pending while validation is paused.

**Implementation notes:** Operator-invoked quarantine and recovery-candidate record commands are available in `scripts/release-disposition.mjs`; they fail closed on inconsistent evidence and never perform promotion, deployment, rollback or Nexus publication. See [release rejection, quarantine and recovery](release-rejection-quarantine-recovery.md). Acceptance remains pending while validation is paused.


## Owner-approved expanded product backlog — 2026-11-08

The following stories capture the owner's answers to the 50-question development requirements exercise. They are future backlog requirements, not claims of implementation. Existing story IDs and acceptance criteria remain unchanged. Add these to the delivery plan after dependency mapping; the current product remains a personal four-profile site.

### PORT-US-035 — Owner-managed complete portfolio CMS

**Current implementation status:** **IMPLEMENTED — NEEDS TESTING** — `/admin/content` edits basics, projects (merge by slug, archive), experience, education, certifications, per-page SEO and navigation labels; draft → publish → unpublish with append-only history and restore (`src/lib/cms-content.ts`, `/api/admin/content/*`). Published overrides merge over curated data at read time via `/api/published-content` and `useMergedPersonPortfolio` (person pages, navbar labels). Test: draft/publish/rollback/unpublish per profile, cross-origin rejection, new and archived project slugs on person pages, navigation relabel, resume precedence still wins. Not yet: themes/layout editing in admin, Abhishek root pages consume only navigation labels (not basics/projects overrides).

**Priority:** P1

**As the owner,** I want to manage all profiles, pages, sections, projects, experience, education, certifications, media, themes and publishing from one protected admin experience, so that the portfolio can evolve without routine code changes.

**Acceptance criteria**
- The owner can create/update/archive profile content and manage all supported page/section types.
- Content changes support draft, review, publish, unpublish and version history.
- The owner can manage resume records, projects, media, galleries, SEO metadata, navigation and AI settings.
- Admin mutations are authenticated, authorized, audited and recoverable.
- Current access remains owner-only; role-based permissions are a later extension.

### PORT-US-036 — Resume and profile knowledge lifecycle

**Priority:** P1

**Current implementation status:** **IMPLEMENTED — NEEDS TESTING** — Publish history is append-only (publish and rollback entries; replayed to find the effective version), rollback never trims newer entries, public pages/AI context read only the current approved record, and deleting a resume drops its extracted draft with the index record and redacts its history entries to timestamps. The admin panel exposes per-profile history/confirmed rollback, and the server exposes private-index/public-feed consistency reporting and owner-confirmed feed reconciliation. To test: publish v1→v2→v3, roll back twice, unpublish/roll back, delete a resume and inspect history/public feed (`src/test/resume-publish-history.test.ts` written, not run).

**As the owner,** I want original resumes and structured extracted profile data to be versioned and reviewed before publication, so that public content and AI answers remain accurate.

**Acceptance criteria**
- Original PDF/DOCX files are stored privately with profile association and version metadata.
- Extracted data is normalized into structured profile sections and remains a private draft until approved.
- Publishing creates an immutable/versioned snapshot that can be rolled back.
- Public pages and AI context use only the current approved published version.
- Deletion and retention behavior covers originals, extracted drafts, published records and derived AI indexes according to policy.

### PORT-US-037 — JARVIS as the portfolio AI engine

**Priority:** P0 — shared integration priority

**As the owner,** I want portfolio AI introductions and chat to use my JARVIS personal AI, so that the portfolio benefits from my own AI platform rather than depending on an external paid API.

**Acceptance criteria**
- Portfolio sends requests to the authenticated JARVIS gateway using server-side credentials only.
- Requests include the selected profile's approved, bounded knowledge and configured persona; they exclude other profiles, private originals and admin notes.
- JARVIS enforces provider routing, rate limits, policy and audit rules.
- If JARVIS is unavailable, the portfolio provides a clear offline/fallback experience without pretending a live AI response occurred.
- No third-party paid provider is silently selected as a fallback.

### PORT-US-038 — Configurable profile personas and knowledge

**Priority:** P1

**Current implementation status:** **IMPLEMENTED — NEEDS TESTING** — `/admin/personas` (linked from `/admin`) edits a per-profile persona (name, tone, style guidance, approved notes) with draft, live preview, publish, unpublish and append-only version history/restore in private storage. The Worker attaches only the selected profile's published persona (client values discarded) and `/api/chat` appends it after the fixed grounding/security rules. To test: publish personas for two profiles and confirm each chat uses only its own; forged `_persona` ignored; restore an older version (`src/lib/persona.test.ts` written, not run).

**As the owner,** I want to configure each profile's AI persona, response style, instructions and approved knowledge, so that each assistant represents the correct person while sharing the same platform.

**Acceptance criteria**
- Each profile has isolated persona and knowledge configuration.
- Persona instructions cannot override platform security, privacy or factual-grounding rules.
- Profile switching changes the context and prevents cross-profile leakage.
- The owner can preview and publish persona/knowledge changes with version history.

### PORT-US-039 — Privacy and visitor data controls

**Priority:** P1

**Current implementation status:** **IMPLEMENTED — NEEDS TESTING** — `/privacy` page (linked from both footers and the sitemap); both assistants show a consent notice with a “Clear my chat” control (chat lives only in the tab; no transcripts stored); no analytics; contact stays mailto-only. Export/deletion requests for stored visitor data are N/A because none is stored. To test: notice visible in both assistants, Clear my chat aborts and empties, /privacy renders and links resolve.

**As a visitor,** I want clear consent and control over any personal data collected during my visit, so that I understand and can manage how my information is used.

**Acceptance criteria**
- Anonymous browsing collects only the minimum operational data required.
- Chat history, analytics and contact details are collected only for disclosed purposes and with required consent.
- Retention periods and deletion/export requests are supported for stored visitor data.
- Public responses never expose another visitor's data, private profile records or admin content.

### PORT-US-040 — Reusable profile templates and future client configuration

**Current implementation status:** **IMPLEMENTED — NEEDS TESTING** — Typed `src/config/site-config.ts` (theme tokens mirroring `:root`, `NAV_SECTIONS` consumed by the navbar) and `createProfileFromTemplate()` (`src/lib/profile-template.ts`); flow in `docs/PROFILE_TEMPLATES.md`. Test: navbar renders identical labels/paths for all four profiles; factory output renders on person pages. Not yet: runtime theme switching UI.

**Priority:** P2 — future scope

**As the owner,** I want the personal portfolio's profile model, themes and content structures to be reusable as templates, so that I can customize future client portfolios without duplicating the core product.

**Acceptance criteria**
- Profile content, theme tokens, sections, navigation and AI configuration are data/configuration-driven where practical.
- A new profile can be created from an approved template with independent content and media.
- Future client customization can override branding, modules and content without modifying shared core components.
- Multi-tenant hosting, client billing and client-specific role systems remain out of scope until separately approved.

### PORT-US-041 — Adaptive storage and portable deployment

**Current implementation status:** **IMPLEMENTED — NEEDS TESTING** — `StorageAdapter` contract with R2, local-disk (now with `list`) and in-memory adapters; source of truth per data class in `docs/STORAGE.md`; `/admin/backup` exports/restores CMS, persona and resume metadata as validated JSON (known keys only, `RESTORE` confirmation). Test: export → restore round trip on local disk and R2, invalid/unknown-key backups rejected before any write. Not yet: binary originals in backups, database adapter.

**Priority:** P2

**As the owner,** I want portfolio data and media to use local, database and cloud storage according to privacy and operational needs, so that the product remains portable and cost-conscious.

**Acceptance criteria**
- Storage adapters expose a consistent contract and define a source of truth for each data class.
- Sensitive originals and admin data use private storage and least-privilege access.
- Public media can use optimized object storage/CDN where configured.
- Backup, export, restore and migration are documented without coupling the application to one provider.
- No paid hosting or storage dependency is assumed without owner approval.

## PORT-E02 — Routes, Navigation and Portfolio Content (additional story)

### PORT-US-042 — Return a real not-found response for unknown profile projects

**Current implementation status:** IMPLEMENTED — NEEDS TESTING. `src/routes/people.$person.projects.$slug.tsx` now throws `notFound()` when the selected profile does not contain the requested project after published CMS overrides are merged. The route uses its existing not-found boundary. No HTTP/browser verification has been run because testing is paused.

**As a visitor or search engine,** I want an unknown project URL to return a real not-found response, so that missing content is not presented as a successful page.

**Acceptance criteria**
- A known curated project slug renders its project detail page.
- A known published CMS project slug renders for the correct profile only.
- An unknown but syntactically valid slug returns HTTP 404 and the intended not-found UI.
- A malformed slug continues to be rejected by route validation.
- An unknown profile remains not found and cannot leak another profile's projects.
- Direct load and refresh behavior is consistent across all supported profiles.



## Owner-directed status reconciliation — 2026-11-09 12:22 IST

**Inspected `new` branch head:** `3605e922ef469d821e19dde8b5f079799ccedab4`. Development is ACTIVE; testing/validation is PAUSED. Existing source additions for profile routes/content, JARVIS-first AI provider, admin audit, storage migration, backup/restore and release disposition are implementation evidence only. Do not reuse the 2026-11-07 local test/build/browser evidence as proof for this later branch head.

### Current development priorities
1. **PORT-US-013 / resume publishing:** close publish/unpublish/rollback consistency and recoverable partial failures across private index, public feed and object storage.
2. **PORT-US-011 / admin access:** complete secure session lifecycle, server-side authorization and production configuration boundaries.
3. **PORT-US-034 / JARVIS chat:** preserve profile scope, bounded approved context, safe provider failures, cancellation and server-only credentials; paid fallback remains explicit opt-in only.
4. **PORT-US-017 / regression readiness:** continue adding targeted regression coverage without executing it while testing is paused.
5. **PORT-US-033 / release disposition:** keep promotion/deployment/Nexus blocked; implement only safe, operator-reviewed evidence and recovery controls.

### Constraints applying to every story
Four-profile isolation is mandatory. Public content and AI context may contain only approved, profile-scoped data; private resume originals, drafts, source notes and admin data remain private. JARVIS is primary; paid OpenAI fallback requires explicit opt-in and server-side keys. Free-first/zero ongoing cost; no unapproved paid infrastructure. Testing paused means no tests, build, typecheck, lint, image audit, browser/accessibility checks, CI/Jenkins or release validation. Work only on `new`; no PR, merge, push to `dev`/`main`, deployment, production secret changes, artifact publication or Nexus enablement without explicit authorization. Nexus stays disabled.

New or changed stories remain OPEN / IMPLEMENTED — NEEDS TESTING until exact-head and applicable owner acceptance evidence is recorded after testing resumes.


## PORT-US-013 implementation update — 2026-11-09

**Implemented in source; testing paused:** publish-history loading now rejects malformed nested contact data, unknown structured-section fields, invalid section entries, oversized skills, invalid timestamps and cross-profile records. Focused regression cases were added for malformed contact, structured fields, skill bounds and profile mismatch. Tests were authored but not run. This hardens the persisted history boundary; it does not yet prove end-to-end consistency across private index, public feed and object storage. Keep PORT-US-013 **PARTIAL — NEEDS DEVELOPMENT / TESTING** until compensation/reconciliation and acceptance evidence are complete.

## Post-Claude story reconciliation — 2026-11-09 13:30 IST

- **PORT-US-013:** status updated to PARTIAL. Publish history, confirmed rollback, feed consistency reporting and owner-confirmed public-feed rebuild are present in source. Missing-original recovery and robust compensation across private index/file/public feed writes remain unfinished.
- **PORT-US-036:** append-only lifecycle and admin history controls remain IMPLEMENTED — NEEDS TESTING. Exact-head tests and owner acceptance have not occurred.
- Testing remains paused; no tests/build/typecheck/lint/audits/browser/CI/release validation were run.
