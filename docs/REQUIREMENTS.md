# Product Requirements and Delivery Baseline

## Product objective
Deliver **ABHISHEK: THE SERIES**, a polished, accessible, cinematic portfolio platform for four people. Each profile must be factually accurate, individually complete, visually coherent, independently manageable and isolated. The owner manages content, images, resumes and personas through Admin and publishes changes without editing application code.

## Current execution constraints — 2026-11-12

- Active development branch: `new` only.
- **Validation is paused** until the owner explicitly resumes it. Do not run tests, builds, typechecks, lint, audits, browser/device/accessibility checks, CI/Jenkins or release validation during this pause.
- Test source may be authored; test results must not be claimed until explicitly run.
- No merge to `dev`/`main`, production changes, deployment or release without separate explicit approval.
- Older historical status notes below are retained as history and do not override these current constraints.

## Product principles
- Facts must be grounded in owner-approved content or approved resumes; never invent credentials or achievements.
- Public content is published deliberately; drafts, private originals, review notes and secrets remain private.
- A shared design system permits profile-specific customization without sacrificing accessibility or consistency.
- Distinguish source implementation, tests authored, tests executed and owner acceptance.
- Production/release actions require explicit owner approval.

## Profile routes
- Abhishek — `/`
- Amulya / Ammu — `/people/ammu`
- Anjini / Bava — `/people/bava`
- Sai / Darling — `/people/sai`; `/people/darling` is an alias.

## Functional scope
Public multi-section profile pages; profile picker and navigation; owner Admin control room; CMS draft/preview/publish/unpublish/history/rollback; profile-scoped image/resume feeds; image version restore; resume processing and structured editing; persona management; audit; backup/restore/recovery; profile-grounded JARVIS AI; SEO/canonical/social metadata/sitemap/robots/404; privacy controls; CI/CD provenance, artifact integrity, SBOM, signing and customer verification.

## Priority owner-directed stories
### PORT-US-044 — Published SEO and social metadata (P1; partial implementation, validation pending)
- Emit published metadata in server-rendered HTML for root, profile, section and project routes.
- Shared metadata now emits the branded site name, locale, Open Graph image and alt text, and Twitter image tags; profile pages use their own local portrait image.
- Validate canonical URL, title, description, Open Graph and social image; enforce correct profile scope.
- Use safe profile-specific defaults when fields are absent.
- Sitemap and robots reflect routes actually public.
- Unknown routes return HTTP 404 and do not advertise successful canonical pages.
- Never expose draft/private metadata or private asset URLs.
- CMS-created project pages use published title/description/social image.
- Publish, unpublish, rollback and cache revalidation update metadata consistently.

### PORT-US-047 — Owner-approved visual profile customization (P1; partial implementation, validation pending)
- Owner configures approved theme tokens, typography, profile accent, section visibility/order and supported layout modules.
- Draft visual changes can be previewed before publication. Admin now previews the selected fixed theme, profile context, accent treatment and filtered navigation labels without publishing.
- Published accent variables are scoped to the active profile shell so one profile theme does not bleed into another.
- Invalid/inaccessible combinations fall back to the shared accessible design system.
- No arbitrary scripts, unsafe markup or untrusted external resources.
- All four profiles remain responsive and visually coherent.
- Published customization is profile-scoped, versioned and recoverable, and updates public pages without code edits.

### PORT-US-048 — Profile content and asset sign-off (P1; sign-off workflow implemented, owner review pending)
- Each profile has owner-approved biography, skills, projects, experience, education, certifications and contact/link set where applicable.
- Each profile uses approved, correctly attributed/owned imagery and meaningful alt text.
- Generic/placeholder hero imagery is replaced or explicitly approved.
- No profile displays another person's private or incorrect content.
- Admin now provides a nine-point owner checklist and records reviewer, server timestamp, exact published content version and accepted exceptions in the private CMS document.
- A new publish/rollback makes the prior sign-off stale; sign-off cannot be recorded until content is published and every review item is explicitly checked.
- Record completeness and sign-off per profile, including reviewer/date, approved versions and exceptions.

## PORT-US-051 — Resource lifecycle integrity validation (P1; inspector implemented, validation pending)

- A read-only authenticated Admin inspection compares resume and image indexes with their private originals and public copies.
- Report missing resume originals, orphaned resume files, invalid/out-of-sync published resume feeds, missing image originals, orphaned image originals, missing approved public copies, stale/orphaned public copies and incomplete immutable image-version byte/metadata pairs.
- The Admin Image Manager exposes the report and clearly states that inspection does not mutate storage.
- Pure lifecycle inspection test source covers healthy state, missing files, feed drift, orphaned/stale files, incomplete version pairs and unreadable feeds. Tests have not been executed.
- Remediation remains an explicit owner-controlled action. Inspection must never silently delete, republish or rewrite resources.
- Remaining acceptance: verify every finding against real storage, exercise recovery and failed-write scenarios, check resume/image history and cleanup behavior, and obtain owner acceptance for all four profiles.

## Visitor journeys, accessibility, performance and release readiness (P1; acceptance work open)

### Visitor journeys
- Verify first-visit discovery, profile selection, each profile's navigation, project discovery/detail, resume access, contact actions, cross-profile isolation, unknown routes and return navigation.
- Cover desktop, tablet and mobile; include keyboard-only journeys and reduced-motion preferences.
- Confirm each journey has meaningful loading, empty, unavailable and error states.

### Visitor journey coverage map — source review started 2026-11-12

| Journey | Expected path | Source-level coverage / remaining work |
|---|---|---|
| First visit → profile selection | Landing page → `/profiles` → one of four profiles | Profile selector exists; brand and explicit “Back to portfolio” links now return to `/`. Validate all four cards and responsive behavior later. |
| Abhishek discovery | Home → about / skills / experience / projects / education / certifications / contact | Shared navigation and home CTAs exist. Confirm every destination, content state and browser history behavior. |
| Other profile discovery | Profile home → sections → projects → project detail | Person-scoped route shell and section navigation exist. Verify all section slugs and dynamic CMS-created project details per profile. |
| Switch profile | Any profile → choose profile → another profile | Shared profile control and footer link exist. Confirm no previous profile content, theme, media or AI context leaks into the next profile. |
| Project exploration | Featured project → catalogue/filter → project detail → return to catalogue | Catalogue and detail routes exist. Confirm filter empty states, unknown/archived slugs, breadcrumbs/back paths and dynamic published projects. |
| Resume access | Profile → resume action / published resume highlights | Published resume components exist. Confirm no private original, unpublished resume or cross-profile file can be reached. |
| Contact | Profile → email / phone / social contact action | Conditional contact links exist. Confirm invalid/missing values degrade cleanly and external links use safe targets. |
| Failure recovery | Broken route/data/resource → retry or choose profile | Profile error and unavailable states exist. Ensure errors do not strand visitors and preserve a safe route back to profiles. |
| Privacy | Any profile → privacy information | Privacy route exists and is linked in the profile footer. Ensure it is discoverable from the Abhishek shell and selector as well. |

**First source-level journey improvement:** the profile selector previously displayed a non-interactive wordmark with no direct return route. It now exposes a keyboard-focusable home link and an explicit “Back to portfolio” link. This is source implementation only; no browser or accessibility validation was run.

**Next source-level journey priorities:**
1. Add a consistent return/breadcrumb path from project detail pages to their correct profile's project catalogue.
2. Ensure privacy and contact destinations are discoverable consistently across all profile shells.
3. Confirm project catalogue empty/filter states and not-found recovery.
4. Review profile switching for state isolation (theme, open AI panel, mobile menu, published media and profile-scoped data).
5. Keep journey acceptance open until real desktop/mobile and keyboard journeys are performed after validation resumes.

### Accessibility
- Meet WCAG 2.2 AA for applicable public and Admin experiences.
- Verify semantic landmarks/headings, accessible names and descriptions, image alternatives, keyboard operation, visible focus, focus order, dialogs, form errors, contrast, zoom/reflow and reduced motion.
- Include automated checks plus manual keyboard and assistive-technology review. Automated checks alone do not close the story.

### Performance
- Establish representative desktop/mobile measurements for LCP, INP and CLS, plus route bundle size and image payload.
- Optimize responsive image formats/sizes, lazy loading, font loading, caching and route/data work without weakening privacy or freshness.
- Record baseline and post-change evidence on the exact candidate commit and realistic device/network profiles.

### Release readiness
- Require a complete owner-approved four-profile content and asset review; current-head automated checks and CI evidence; accessibility and performance acceptance; SEO/sitemap correctness; storage backup/restore and rollback rehearsal; admin/security review; operational monitoring and recovery instructions; dependency/SBOM/provenance evidence; and a documented rollback plan.
- Release readiness is a report and gate, not permission to deploy. Production release requires separate explicit owner approval.

## Definition of done
All four profiles contain approved and isolated content; every public route and CMS field behaves consistently; resume/image publishing and recovery are safe; Admin is secure; JARVIS is privacy-safe and reports availability honestly; SEO, accessibility, responsiveness and performance meet acceptance; exact-head engineering/CI evidence is green; backup/restore and rollback are rehearsed; owner explicitly approves release. Source changes alone do not satisfy completion.

## Consolidated product and delivery records
The following full source records are retained as appendices to avoid losing requirements, acceptance criteria, owner decisions and historical status. Historical claims are not current verification; the newest dated entry and explicit validation pause govern.


---

## Complete user stories and acceptance criteria

_Source consolidated from `docs/USER_STORIES.md`; retained for complete requirement and decision traceability._

# Portfolio — User Stories and Acceptance Criteria

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

**Repository:** `ASAA1229/pixel-perfect-pixel`
**Active branch:** `test`
**Updated:** 2026-11-09 (development and testing active on `new`)
**Rule:** A story is fully closed only when its acceptance criteria are evidenced; production/CI evidence is still pending for every story.

Epic mapping: [EPICS.md](EPICS.md) · Project overview, constraints and future scope: [POC.md](POC.md)

## Evidence boundary — 2026-11-09

Development and testing are ACTIVE on `new`. The current exact-head CI run is authoritative; historical local test/build/browser evidence does not prove the latest commit. Every story remains open until its own acceptance criteria are evidenced.

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
| US-034 Chat uses the owner's JARVIS personal AI | IMPLEMENTED IN SOURCE — VALIDATION PENDING |

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

**Implementation notes:** The shared published-resume panel is now fed from the page's profile-scoped normalized data. Abhishek's five content routes prefer valid published section data and use the curated static portfolio only when the matching published section is empty. Other profile routes retain the shared profile-aware renderer. Direct-load, refresh and cross-profile acceptance remain unverified while the corresponding exact-head check is pending.

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

**Current implementation status:** **IMPLEMENTED IN SOURCE — VALIDATION PENDING** — `/api/chat` resolves JARVIS server-side, keeps provider credentials out of the browser, and uses paid OpenAI fallback only when `PORTFOLIO_AI_ALLOW_PAID_FALLBACK=true`. The Worker now injects only the selected profile’s approved resume, published CMS document and published persona. Provider response bodies are not written to application logs. Existing and new route regression tests are authored; execution remains paused.

**As the owner,** I want the portfolio chat to use my JARVIS personal AI through an API key, so that my sites run on my own AI instead of a paid third-party API.

**Acceptance criteria**
- When `JARVIS_AI_URL` and a valid `JARVIS_AI_KEY` (`jrv_…`) are set, chat requests go to JARVIS `/v1/chat/completions` with the profile instructions as the system message.
- JARVIS URLs must be https, except loopback for local development; keys stay in server-side environment only.
- If JARVIS is not configured, OpenAI is used only when `OPENAI_API_KEY` is set **and** `PORTFOLIO_AI_ALLOW_PAID_FALLBACK=true`; otherwise the API returns 503 and the UI shows offline profile answers.
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

**Current implementation status:** **IMPLEMENTED IN SOURCE — VALIDATION PENDING.** JARVIS is the primary server-side gateway; paid fallback is explicit opt-in only. The Worker injects the selected profile’s approved resume, published CMS content and published persona, and the chat route revalidates CMS/persona shape before prompt construction. Profile scope is sent to JARVIS in both the header and request body. Drafts, private originals, review notes and other profiles are excluded. Provider error bodies are not logged; timeouts and request abort are wired. Production tunnel, distributed gateway controls, privacy acceptance and end-to-end cancellation/failure verification remain open.

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

**Current implementation status:** IMPLEMENTED — NEEDS TESTING. `src/routes/people.$person.projects.$slug.tsx` now throws `notFound()` when the selected profile does not contain the requested project after published CMS overrides are merged. The route uses its existing not-found boundary. No HTTP/browser verification has been run pending exact-head verification.

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


## Test evidence and story-status reconciliation — 2026-11-09 (test branch)

**Current branch head:** `0f90a96c47a1a36826306ca5bd26a1f7b263acfe`.

Antigravity's Windows 11 report records **137 passed, 0 failed and 1 skipped** across 22 suites. That is a **100% local pass rate among runnable cases (137/137)** and **99.3% executed (137/138)**. The skipped case is the Win32 filesystem symlink-policy check. The local report does not record the tested commit SHA, so it cannot establish exact-head CI acceptance.

The exact-head [Portfolio CI run #42591418653](https://github.com/ASAA1229/pixel-perfect-pixel/actions/runs/42591418653) passed dependency installation, SBOM generation, build and typecheck, but failed ESLint/Prettier in `src/lib/admin-auth.test.ts`, `src/lib/local-disk-bucket.test.ts`, `src/lib/resume-publish-history.ts`, `src/server.ts` and `src/test/resume-publish-history.test.ts`. CI skipped the test step and SBOM upload after lint failed.

### Story status reconciliation

- Stories with passing local suites remain **LOCAL TEST REPORT PASS — EXACT SHA NOT RECORDED** until rerun on the exact candidate and green CI.
- **PORT-US-013** remains **PARTIAL — NEEDS DEVELOPMENT / TESTING**: history and feed reconciliation exist, but recovery/compensation across private index, original files and public feed remains incomplete.
- **PORT-US-036** remains **IMPLEMENTED — NEEDS TESTING** pending exact-head tests and owner acceptance.
- Admin/auth/upload/storage stories remain OPEN pending production-like authorization, persistence, session-expiry and failure-injection tests.
- AI/JARVIS integration remains OPEN pending deployment/tunnel and fallback/privacy acceptance.
- Accessibility, responsive, performance, SEO and release stories remain OPEN where manual/browser/production criteria are not evidenced.

No story is closed solely because the local test report is green. The local test pass metrics are **100% of runnable cases passed** and **99.3% of listed cases executed**.


## Authoritative objective gap audit and execution backlog — 2026-11-12

**Purpose:** Close the gaps between the current implementation and the approved product objective: a polished, owner-managed, four-profile digital identity platform for Abhishek, Amulya, Anjini and Sai, with accurate profile-specific content, a cinematic visitor experience, secure CMS, approved resume/media publishing, profile-aware JARVIS assistance, privacy controls and a portable zero-cost-by-default deployment.

**Authority and evidence:** This audit applies to branch `new`. It supersedes older statements in this document that testing is active. Development/documentation may continue; testing and validation remain PAUSED. No tests, build, typecheck, lint, audit, browser/device/accessibility checks, CI/Jenkins or release validation may be run until the owner explicitly resumes them. Source implementation and authored tests are not acceptance evidence. No merge to `dev`/`main`, deployment, production secret/R2 provisioning, public tunnel, artifact publication or Nexus activation is authorized. Nexus remains disabled.

### Prioritized gap-closure work packages

| Priority | Work package | Existing story mapping | Current gap / required outcome |
|---|---|---|---|
| P0 | GCP-01 — Complete root-page CMS coverage | PORT-US-035 | The CMS now supports contact/social and skill overrides, but Abhishek's root experience does not yet consume the full managed profile basics, projects and other supported section overrides consistently. Make root pages and person pages use one predictable published-content precedence model; retain curated fallbacks and profile isolation. |
| P0 | GCP-02 — Resume publish lifecycle integrity | PORT-US-013, PORT-US-036 | Current history, rollback, consistency reporting and feed reconciliation exist. Missing-original reconciliation is now blocked safely, but writes across original object, private index and public feed are not transactional/recoverable. Add compensation/retry/idempotency and owner-directed recovery for every partial publish, unpublish, rollback, delete and restore outcome; define concurrent-update behavior. |
| P0 | GCP-03 — Production admin security boundary | PORT-US-011 | Source has protected routes and signed sessions, but real production login/session expiry/logout, secret rotation, authorization on every mutation, CSRF/origin controls, brute-force/rate-limit behavior and production configuration have not been accepted in a production-like environment. Ensure development bypasses cannot activate in production. |
| P0 | GCP-04 — JARVIS integration readiness | PORT-US-007, PORT-US-008, PORT-US-009, PORT-US-034, PORT-US-037, PORT-US-038 | Local/provider source integration exists, but owner-approved hosted connectivity and real deployment acceptance remain open. Verify profile-scoped approved context, persona isolation, streaming/cancellation, timeout, unavailable/offline behavior, key rotation and safe errors through the approved gateway. JARVIS stays primary; paid OpenAI fallback remains explicit opt-in only. |
| P1 | GCP-05 — Image lifecycle and binary recovery parity | PORT-US-014, PORT-US-023, PORT-US-041 | Resume backup completeness has been hardened, but image upload/publish/unpublish/delete/reconcile failure paths and binary backup/restore/migration need equivalent end-to-end guarantees. Confirm private originals, public copies, metadata and feeds cannot become inconsistent or leak across profiles. |
| P1 | GCP-06 — Complete SEO and share metadata | PORT-US-021, PORT-US-035 | Per-page SEO editing exists in the CMS, but published SEO metadata propagation and route-by-route output are still open. Apply approved title, description, canonical URL, Open Graph/social image and structured metadata to root and all profile/project routes; verify sitemap, robots and not-found status behavior. |
| P1 | GCP-07 — Finish profile identity and content approval | PORT-US-002, PORT-US-003, PORT-US-005 | Owner review remains for biographies, project facts, contact data, profile-specific media and visual identity. Replace generic/placeholder hero assets where still present; verify every person's facts, links, image ownership, alt text and section completeness. No unapproved personal facts may be invented or published. |
| P1 | GCP-08 — CMS visual customization | PORT-US-035, PORT-US-040 | Admin content editing exists, but owner-facing theme/layout customization is incomplete. Define the safe editable scope for themes, colors, typography, section visibility/order, navigation and reusable page modules; preview drafts before publish and preserve a usable shared design system. |
| P1 | GCP-09 — Full visitor journey and route acceptance | PORT-US-004, PORT-US-005, PORT-US-016, PORT-US-042 | Historical route checks do not prove current-head behavior. Verify direct load, refresh, profile switching, all section/project routes, published/archived project slugs, invalid profile/slug 404s, empty states, external links and contact journeys across all four profiles. |
| P1 | GCP-10 — Accessibility and device acceptance | PORT-US-010, PORT-US-018, PORT-US-019 | Keyboard/reduced-motion work exists, but current-head screen-reader and real device acceptance are incomplete. Verify focus order/visibility, labels, contrast, dialogs, live chat announcements, voice/video controls, no autoplay, cleanup, reduced motion and mobile/tablet layouts. |
| P1 | GCP-11 — Performance and operational resilience | PORT-US-020, PORT-US-041 | Performance and production storage behavior are not accepted. Measure current-head Core Web Vitals or equivalent, image/font loading, route payloads and chat responsiveness; verify local/R2 adapter behavior, storage outages, limits, backup/restore and migration without paid defaults. |
| P1 | GCP-12 — Exact-head engineering and CI recovery | PORT-US-015, PORT-US-017, PORT-US-029–032 | Existing tests have been authored/changed since earlier evidence; no current-head pass is established. When testing is resumed, repair the SBOM/lint/CI blockers as applicable, run install/build/typecheck/lint/tests and security/dependency checks, and retain exact-SHA results plus generated SBOM/provenance evidence. Never weaken dependency inventory or provenance to get a green pipeline. |
| P1 | GCP-13 — Release gate and recovery readiness | PORT-US-022, PORT-US-026, PORT-US-033 | Release integrity/quarantine/recovery tooling exists in source, but no accepted release has passed exact-head CI, owner review, deployment configuration, backup/restore rehearsal, rollback rehearsal and security/privacy sign-off. Keep promotion, deployment and Nexus blocked until explicit approval. |
| P2 | GCP-14 — Privacy and retention policy closure | PORT-US-039 | Current chat is tab-local and no analytics/transcript storage is intended. Document actual operational logs/cookies/session data and retention, ensure privacy copy matches implementation, and verify clear-chat/cancellation and no cross-visitor/profile data exposure. Add export/deletion workflows only if persistent visitor data is introduced. |
| P2 | GCP-15 — Reusable-template boundary | PORT-US-040, PORT-US-041 | Keep the four-profile personal product as the current deliverable. Validate that shared profile/template/configuration abstractions remain reusable without adding multi-tenant SaaS, billing or client-role complexity to this release. |

### New focused user stories

#### PORT-US-043 — Consistent root and profile CMS content

**Priority:** P0  
**Status:** IMPLEMENTED IN SOURCE — REGRESSION COVERAGE AUTHORED — VALIDATION PENDING.

**As the owner,** I want every public route to consume the approved CMS content for its intended profile, so that edits made in the owner dashboard are reflected consistently throughout the portfolio.

**Acceptance criteria**
- Root Abhishek pages and all four profile experiences consume the supported published basics, projects, skills, experience, education, certifications, contact and navigation overrides.
- Published resume-derived data, CMS overrides and curated defaults follow one documented precedence order.
- Draft/unpublished content never appears publicly.
- Profile-specific content and media never cross profile boundaries.
- Empty, archived, invalid and missing content states are deliberate and safe.
- Changes are covered by regression tests and route-level acceptance after validation resumes.  

**2026-11-12 implementation update:** root Skills now renders every published CMS skill group, including custom categories; root About/Home consume CMS basics, experience, education and location; root Projects consumes the published project collection and supports CMS-created project detail routes. All three person profiles now merge CMS location/socials/contact consistently, and resume → CMS → curated precedence is applied to profile-home basics/education. Explicit empty CMS collections now clear skills, projects, experience and certifications instead of silently restoring curated defaults. JARVIS now receives only the selected profile’s published CMS content and uses it to ground root Abhishek and all three person-profile prompts. Tests were added for collection clearing, new projects, CMS profile merge and CMS-grounded JARVIS prompts. No validation was run.

#### PORT-US-044 — Published SEO and social metadata

**Priority:** P1  
**Status:** PARTIAL — NEEDS DEVELOPMENT / TESTING.

**As the owner,** I want SEO and social metadata configured in the CMS to appear correctly on every public route, so that each profile and project can be discovered and shared accurately.

**Acceptance criteria**
- Published metadata is emitted in server-rendered HTML for root, profile, section and project routes.
- Canonical URL, title, description, Open Graph and social image values are validated and profile-correct.
- Missing values use safe profile-specific defaults.
- Sitemap and robots output match the routes that are actually public.
- Unknown routes return HTTP 404 and do not advertise successful canonical pages.
- No draft/private metadata or private asset URL is exposed.

#### PORT-US-045 — Recoverable media and resume storage operations

**Priority:** P0  
**Status:** PARTIAL — DURABLE JOURNAL IMPLEMENTED IN SOURCE / TESTS AUTHORED / NOT RUN; DISTRIBUTED CONCURRENCY AND REMAINING SINGLE-OBJECT/FILE CLEANUP PATHS OPEN.

**As the owner,** I want resume and image operations to recover safely from partial storage failures, so that the private source, approved index and public feed cannot silently diverge.

**Acceptance criteria**
- Publish, unpublish, rollback, delete, restore and migration define their write order and recovery state across object storage, private indexes and public feeds.
- Operations are idempotent or safely reject duplicate/replayed requests.
- Partial failures produce an actionable consistency record and a safe retry/compensation path.
- Concurrent updates cannot silently overwrite a newer approved version.
- Missing private originals are never treated as recoverable merely by rebuilding a public feed; restore requires a verified source backup or explicit owner action.
- Resume and image binaries, metadata, digests and profile ownership are checked before restore/migration writes.
- Failure-injection tests cover every storage boundary after validation resumes.

#### PORT-US-046 — Production-ready owner authentication

**Priority:** P0  
**Status:** PARTIAL — SOURCE HARDENING IMPLEMENTED / VALIDATION AND PRODUCTION ACCEPTANCE PENDING.

**As the owner,** I want the admin authentication and session boundary to remain secure in the real hosting environment, so that only authorized owner actions can change public portfolio data.

**Acceptance criteria**
- Login, logout, expiry, renewal and secret rotation behave correctly in production-like hosting.
- Every admin loader, action and API mutation enforces server-side authorization.
- CSRF/origin protections and request throttling are applied to sensitive mutations and authentication.
- Development-only bypass behavior is impossible in production configuration.
- Cookies use appropriate Secure, HttpOnly and SameSite settings.
- Authentication failures and audit records do not disclose passwords, tokens, private record existence or sensitive content.
- Production secrets remain outside source control and client bundles.

#### PORT-US-047 — Owner-approved visual profile customization

**Priority:** P1  
**Status:** PARTIAL — NEEDS DEVELOPMENT / TESTING.

**As the owner,** I want to preview and manage approved visual settings from the CMS, so that the four profiles can be individually polished without editing shared application code.

**Acceptance criteria**
- The owner can configure approved theme tokens, typography, profile accent, section visibility/order and supported layout modules.
- Draft visual changes can be previewed before publication.
- Invalid or inaccessible combinations fall back to the shared accessible design system.
- Customization cannot inject arbitrary scripts, unsafe markup or untrusted external resources.
- All four profiles remain responsive and visually coherent.

#### PORT-US-048 — Profile content and asset sign-off

**Priority:** P1  
**Status:** OWNER REVIEW PENDING.

**As a profile owner,** I want each profile's facts, links and media reviewed before release, so that the portfolio represents each person accurately and respectfully.

**Acceptance criteria**
- Abhishek, Amulya, Anjini and Sai each have an owner-approved biography, skills, projects, experience, education, certifications and contact/link set where applicable.
- Each profile uses approved, correctly attributed/owned imagery and meaningful alt text.
- Generic/placeholder hero imagery is replaced or explicitly approved.
- No profile displays another person's private or incorrect content.
- Content completeness and sign-off are recorded per profile.

### Execution sequence — work on these first

1. **P0:** PORT-US-045 storage recovery design and implementation, starting with resume publish/rollback/unpublish and then image parity.
2. **P0:** PORT-US-046 production admin security boundaries (source work only until validation is resumed).
3. **P0:** PORT-US-043 root/profile CMS source coverage implemented; exact-head and route acceptance pending.
4. **P0:** PORT-US-037 / PORT-US-034 JARVIS context boundaries implemented in source; hosted connectivity, privacy and failure-path acceptance pending.
5. **P1:** PORT-US-044 SEO metadata propagation.
6. **P1:** PORT-US-048 profile facts/media owner sign-off and PORT-US-047 CMS visual customization.
7. **P1:** PORT-US-009/016/017/018/019/020/022/033 acceptance, CI, accessibility, performance and release gates when validation is explicitly resumed.
8. **P2:** PORT-US-039 privacy/retention confirmation and PORT-US-040/041 reusable-template/storage portability refinement.

**Definition of objective completion:** All four profiles contain owner-approved and isolated content; every public route and CMS-managed field behaves consistently; resume/image publishing and recovery are safe; owner admin is secure; JARVIS behavior is privacy-safe and accurately reports availability; SEO, accessibility, responsiveness and performance meet documented acceptance; exact-head engineering/CI evidence is green; backup/restore and rollback are rehearsed; and the owner explicitly approves release. A source change alone does not satisfy this definition.


### PORT-US-045 implementation increment — image lifecycle compensation (2026-11-12)

**Branch:** `new`  
**Status:** IMAGE OPERATIONS IMPLEMENTED IN SOURCE / FAILURE TESTS AUTHORED / NOT RUN

- Added a shared compensating storage-write helper for image lifecycle operations. It snapshots every affected key before the first mutation and compensates the attempted operation, including an ambiguous provider write that persists and then rejects.
- Applied the helper to image upload (including publish-on-upload), replacement, publish, unpublish and delete. A failed commit now attempts to restore private originals, public copies, the image index and superseded-image state.
- Image API failure responses now report whether compensation completed; callers are told to inspect consistency before retrying if rollback itself failed.
- Added `src/test/image-failure-paths.test.ts` with failure-injection cases for ambiguous index writes during upload, replacement, publish, unpublish and delete.
- Resume lifecycle already has a compensating index/feed/history commit helper, but still lacks distributed concurrency protection and a durable recovery journal for compensation failures. Missing originals remain non-recoverable without a verified backup/source.

**Validation:** no tests, build, typecheck, lint, browser checks or CI were run. All new image regression tests are authored only. PORT-US-045 remains open until validation resumes and resume/image recovery, concurrency and hosted R2 acceptance are complete.


### PORT-US-045 follow-up — resume history compensation coverage (2026-11-12)

- Extended `src/test/resume-failure-paths.test.ts` with an ambiguous persisted-write failure at the resume publish-history step. The scenario asserts that compensation restores the pending resume index, empty public feed and empty prior history state.
- This supplements existing publish-feed failure tests and the missing-original reconciliation guard. Tests remain authored but unexecuted.
- Remaining P0 work: durable recovery when compensation itself fails, concurrency control across overlapping requests/instances, and safe cleanup/recovery for post-commit original-file deletion. Hosted R2 acceptance is also open.


### PORT-US-049 — Admin control room and unified workspace navigation

**Priority:** P1  
**Status:** IMPLEMENTED IN SOURCE — NEEDS TESTING / OWNER ACCEPTANCE PENDING.

**As the owner,** I want one admin control room that summarizes the operational state of all four profiles and gives me consistent navigation to every management area, so that I can identify pending work and manage the complete portfolio without hunting through individual routes.

**Acceptance criteria**
- The private dashboard summarizes pending/approved resume and image records, content drafts and AI persona drafts.
- Each of the four profile cards shows content/persona publication state and profile-scoped resume/image counts.
- The dashboard reports whether private storage and audit history can currently be read; unavailable sources are disclosed and counts are marked incomplete rather than silently shown as authoritative.
- Recent audit actions are visible with a link to the complete audit history.
- Every admin manager has consistent navigation to the dashboard, content, personas, resumes, images, backup/restore and audit pages.
- The dashboard provides direct links to each public profile and its primary editing workflows.
- Session sign-out and sign-out-everywhere remain available, with confirmation before terminating all sessions.
- Dashboard data is read-only; status aggregation must never publish, mutate, restore or delete portfolio data.
- All pages remain private/noindex and server-side authorization remains authoritative.
- Responsive, keyboard and screen-reader behavior is accepted after validation resumes.

**Implementation increment — admin control room (2026-11-12)**
- Added a shared `AdminNavigation` component and integrated it into the content, persona, resume, image, backup and audit workspaces.
- Replaced the basic admin landing page with a four-profile control room that reads the existing admin APIs for resume/image review queues, content/persona draft and published versions, storage availability and recent audit activity.
- The dashboard reports unavailable status sources and marks the resulting counts as potentially incomplete; it does not perform writes.
- Added profile shortcuts, manager links, refresh and session sign-out controls.
- **Validation:** no tests, build, typecheck, lint, browser/accessibility checks or CI were run. This is source implementation only; route behavior, API aggregation, responsive layout and accessibility remain unverified.

### PORT-US-049 follow-up — dynamic admin workflows (2026-11-12)

- Resume inventory now supports profile-scoped filtering in addition to existing text search and publication-status filtering, including unassigned records.
- Image inventory now supports text search plus profile and publication-status filtering; its count reflects the filtered result set.
- Audit history now supports text search across action, actor, outcome and target IDs, plus outcome filtering.
- Content manager now provides an in-page preview of current editor values, including summary/story, projects, skills, experience, education/certification counts and SEO data. The preview is explicitly unpublished and does not mutate public content.
- Existing persona prompt preview, draft/publish/rollback/unpublish, structured resume editing/extraction, image lifecycle, backup export/restore and storage migration workflows remain connected to their existing server APIs.
- **Validation:** no tests, build, typecheck, lint, browser, accessibility or CI were run. Dynamic workflows are implemented in source only and remain unverified.


### PORT-US-050 — Admin-managed resources drive public profiles

**Priority:** Critical · **Status:** IN PROGRESS — source integration incremented; full acceptance pending.

As the portfolio owner, I want images and resumes uploaded, assigned, reviewed and published in Admin to become the active resources for the matching public profile, so that profile content and media can be maintained without editing application source code.

**Acceptance criteria**
- Each published image is scoped to one of the four profile IDs and has a defined placement (portrait or gallery), accessible alt text and a stable public resource URL.
- The public profile reads only published resources for its own profile ID. Draft/pending resources and private originals/review notes never appear publicly.
- Publishing or replacing a portrait updates the profile's portrait placements; publishing gallery images updates the managed gallery without source edits.
- If a profile has published gallery resources, they become the managed gallery set; if none are published, the curated fallback remains available.
- Publishing a resume updates the matching profile's headline, summary, skills, experience, education, projects, certifications and approved contact details wherever those sections are rendered.
- The active published resume file is downloadable from that profile using a public, read-only endpoint that serves only records still approved in the private index; private source files remain inaccessible.
- Replacing, unpublishing or restoring a resource changes the active public result after cache invalidation/revalidation, without requiring a code change or deployment.
- Missing or unavailable published resources fail safely to curated fallback content; one profile's resources never leak into another profile.
- Admin shows the currently active resource, placement/profile assignment, draft/published state and relevant version history.

**Current implementation note (2026-11-12):** A shared validated published-image feed is now used by Abhishek's home portrait, About hero/gallery and the other person-profile portrait/gallery surfaces. The existing published-resume feed already drives several resume-derived text sections and contact/highlight surfaces. The downloadable published resume file endpoint, full all-profile placement coverage, replacement/unpublish cache behavior and end-to-end lifecycle acceptance remain open. Validation remains paused; no tests/build/typecheck/lint/browser/CI were run.


**PORT-US-050 follow-up (2026-11-12):** The public resume binary endpoint and profile-aware download actions are now implemented in source. `GET /api/published-resumes/:id` checks the private resume index and serves the file only while that exact record remains approved; the Abhishek and person-profile download actions resolve the currently published resume ID from the published feed. This remains untested, and public download behavior after rollback/unpublish still requires runtime acceptance.


**PORT-US-050 admin follow-up — active image visibility (2026-11-12):** The Admin image inventory now reads the public published-image feed alongside the private inventory and marks the image resources currently selected by the public profile rendering rules as “Live on profile”. Other approved images are identified separately as published but not selected, preventing approval status from being mistaken for proof of active display. The image inventory also now has a dedicated no-results state when filters exclude all records. Public-feed unavailability is treated as unknown/not confirmed, not as proof that an approved image is live. Validation remains paused; this source change is untested.


**PORT-US-050 admin follow-up — active resume visibility (2026-11-12):** The resume inventory now checks the public approved-resume feed separately from the private admin index. It marks the exact resume ID present in the public feed as “Live on profile”, distinguishes approved records that are not currently active, and reports “Public status unknown” when the public feed cannot be read. Publish and unpublish refresh both inventories after the server confirms the operation. This is source implementation only; validation remains paused.


**PORT-US-050 follow-up — safe image version restore (2026-11-12):** Image replacement now stores the superseded private image together with validated filename, content type, size and upload timestamp metadata. Admin can inspect available restorable versions and request a restore. The server validates the selected version identifier, metadata, byte size and file signature; snapshots the currently active image as another version; then updates private bytes, public bytes when approved, and the private index through the compensating-write helper. Version entries without matching metadata (including legacy byte-only snapshots) are intentionally not offered. The UI refreshes the preview and version history after replacement/restoration. Cleanup permanently removes superseded versions, so the owner must retain versions until no longer needed. Source implementation only; validation remains paused.

### PORT-US-050 follow-up — project-specific image placements (2026-11-12)

**Status:** IMPLEMENTED IN SOURCE / VALIDATION PENDING

As the owner, I want to assign approved images to an exact profile project so each project detail page can display its own media without source-code edits.

**Implemented source behavior**
- Image records support a project placement with a validated lowercase project URL slug, in addition to profile portrait and profile gallery placements.
- Upload requires a project slug when the project placement is selected; the slug is stored with the profile ID and image record.
- The public approved-image feed exposes the project slug only for project placements.
- Public normalization requires both the requested profile ID and a valid project slug; the project detail renderer requests images for its own profile and slug only.
- Admin inventory identifies project placement and includes published project images in active-resource visibility.

**Acceptance criteria still open**
- Verify images appear only on the matching profile/project route, including direct loads and refresh.
- Verify pending images never appear publicly; publish, unpublish, delete and restore retain correct placement.
- Verify all four profile route families, including Abhishek's project detail routes.
- Verify project slug changes/deleted projects do not leave misleading public media.
- Run automated, browser, responsive and accessibility checks only when validation is explicitly resumed.

### PORT-US-051 — four-profile public resource lifecycle and image placement audit (2026-11-12)

**Status:** IMPLEMENTED IN SOURCE / AUTOMATED COVERAGE AUTHORED / VALIDATION PENDING

As the owner, I want every public image and resume resource to be managed independently for Abhishek, Amulya, Anjini and Sai, so uploads, publication changes, replacements, restores and deletions affect only the intended profile.

**Image placement audit and source changes**
- Profile selector portraits use the shared validated published-image feed for all four profiles; bundled portraits remain intentional fallbacks when no approved portrait exists.
- Abhishek's home hero, About hero and AI introduction portrait use the published portrait placement; About gallery uses published gallery images with bundled fallback. Removed the duplicate static profile image that had an inaccurate illustration description.
- Amulya, Anjini and Sai home portraits and About portraits/galleries use the same profile-scoped published image feed with their existing bundled assets as fallbacks.
- All four profiles' project cards and project-detail pages resolve media by exact profile ID and project slug. Abhishek's homepage/project index/featured showcase and detail pages are included.
- Shared series billboards, chapter backdrops and the brand logo remain static design assets, not personal profile resources.
- Public feed normalization validates UUID identity, exact same-origin image URL, non-empty alt text, supported placement, and project slug; a project slug is forbidden on non-project placements.

**Resource lifecycle coverage authored (not executed)**
- Images: private upload, pending visibility, publish, public byte delivery, replace, version listing, restore, unpublish, republish, delete and storage cleanup boundaries for each profile.
- Resumes: private upload, profile assignment, publish, supersede, append-only history, rollback, unpublish, private download and delete/redaction for each profile.
- Cross-profile isolation: public feeds and project galleries must never expose another profile's assets.
- Existing static assets remain fallback content only; approved CMS resources take precedence.

**Acceptance still requires validation**
- Run the new four-profile image and resume lifecycle integration tests.
- Browser-check every public profile route and every project card/detail route, including direct navigation and refresh.
- Verify R2 and local-disk behavior, cache/revalidation, storage failure compensation, image signature/metadata consistency and deleted-resource cleanup.
- Verify no cross-profile leakage, stale published asset, or public access to pending/private resources.
- Do not mark this story accepted until validation is explicitly resumed and passes.

### PORT-US-045 implementation increment — durable recovery journal (2026-11-12)

**Branch:** `new`  
**Status:** IMPLEMENTED IN SOURCE / TESTS AUTHORED / VALIDATION PENDING

- Added `src/lib/storage-recovery.ts`, a write-ahead journal that persists pre-change object snapshots before multi-object writes.
- Resume index, approved feed and optional publish history now use journaled commits.
- Image lifecycle multi-object operations now use the same journal instead of relying only on in-memory compensation.
- Backup restore and migration destination writes use journaled snapshots and replayable rollback.
- Added owner-only recovery status and confirmed recovery endpoint at `/api/admin/storage/recovery`, plus a recovery panel in Admin → Backup & Restore.
- Added failure-injection test source for successful rollback, compensation failure followed by later recovery, journal preparation failure and overlapping operations sharing one bucket instance.

**Still open:** the queue serializes journaled write phases, but handler reads can be stale before the queue is acquired; read-modify-write lost-update protection is not complete. It is isolate-local, not a distributed R2 lock/CAS. Remaining single-object/multi-step content/persona writes need an inventory. R2 behavior, concurrent Worker instances, failure injection and recovery acceptance remain unverified.

### PORT-US-046 implementation increment — authentication/session hardening (2026-11-12)

**Branch:** `new`  
**Status:** SOURCE HARDENING IMPLEMENTED / TESTS AUTHORED / VALIDATION PENDING

- Admin session signing secrets must now contain at least 32 UTF-8 bytes; weak/missing secrets disable authentication.
- Session epoch reads fail closed on storage errors or malformed persisted values rather than silently reverting to epoch 0.
- Admin authorization fails closed if private session storage is unavailable.
- Runtime auth bypass now also requires a non-production Vite build, in addition to the explicit development environment binding.
- Added same-origin, authenticated `POST /api/admin/session/renew` and an Extend session control in the admin navigation.
- Existing eight-hour HttpOnly/SameSite=Strict cookie, secure-on-HTTPS behavior, login origin check, bounded password body and per-client attempt throttle remain in place.
- Added test source for weak signing secrets, protected admin routes, CSRF rejection, session renewal and malformed epoch fail-closed behavior.

**Still open:** the login throttle is in-memory per isolate and is not a distributed rate limiter; production secret rotation and deployment configuration need owner-controlled verification; the complete route/mutation inventory and production-like session lifecycle still need acceptance. No tests or security scans were run.


### PORT-US-045 follow-up — resume binary upload and delete transaction (2026-11-12)

- Resume upload now journals the private original and resume index together; an ambiguous index failure restores the previous index and removes the unreferenced upload.
- Resume deletion now includes index, approved feed, publish-history redaction and private original deletion in one journaled transaction. If original deletion persists and then rejects, recovery restores the original and prior published state.
- Added failure-injection test source for ambiguous upload-index persistence and ambiguous original-file deletion.
- Tests remain authored only. Distributed concurrency and hosted R2 verification remain open.


PORT-US-046 follow-up: owner passwords shorter than 12 characters and session signing secrets shorter than 32 UTF-8 bytes are now rejected by the server configuration check. Session epoch values are restricted to safe integers; malformed or unavailable epoch storage fails closed. The login throttle remains per-isolate and must be replaced or complemented by a distributed hosting-level rate limiter before production acceptance.


## Test evidence and story-status reconciliation — 2026-11-09 (test branch)

**Current branch head:** `0f90a96c47a1a36826306ca5bd26a1f7b263acfe`.

Antigravity's Windows 11 report records **137 passed, 0 failed and 1 skipped** across 22 suites. That is a **100% local pass rate among runnable cases (137/137)** and **99.3% executed (137/138)**. The skipped case is the Win32 filesystem symlink-policy check. The local report does not record the tested commit SHA, so it cannot establish exact-head CI acceptance.

The exact-head [Portfolio CI run #42591418653](https://github.com/ASAA1229/pixel-perfect-pixel/actions/runs/42591418653) passed dependency installation, SBOM generation, build and typecheck, but failed ESLint/Prettier in `src/lib/admin-auth.test.ts`, `src/lib/local-disk-bucket.test.ts`, `src/lib/resume-publish-history.ts`, `src/server.ts` and `src/test/resume-publish-history.test.ts`. CI skipped the test step and SBOM upload after lint failed.

### Story status reconciliation

- Stories with passing local suites remain **LOCAL TEST REPORT PASS — EXACT SHA NOT RECORDED** until rerun on the exact candidate and green CI.
- **PORT-US-013** remains **PARTIAL — NEEDS DEVELOPMENT / TESTING**: history and feed reconciliation exist, but recovery/compensation across private index, original files and public feed remains incomplete.
- **PORT-US-036** remains **IMPLEMENTED — NEEDS TESTING** pending exact-head tests and owner acceptance.
- Admin/auth/upload/storage stories remain OPEN pending production-like authorization, persistence, session-expiry and failure-injection tests.
- AI/JARVIS integration remains OPEN pending deployment/tunnel and fallback/privacy acceptance.
- Accessibility, responsive, performance, SEO and release stories remain OPEN where manual/browser/production criteria are not evidenced.

No story is closed solely because the local test report is green. The local test pass metrics are **100% of runnable cases passed** and **99.3% of listed cases executed**.



---

## Epic register and delivery plan

_Source consolidated from `docs/EPICS.md`; retained for complete requirement and decision traceability._

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



---

## POC baseline, constraints and implementation history

_Source consolidated from `docs/POC.md`; retained for complete requirement and decision traceability._

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

**Known limits:** PORT-US-043 root/profile CMS coverage and PORT-US-034/037 published-context integration are now implemented in source, but exact-head tests, live publish-to-public checks and route/404 acceptance remain pending. Backup binary completeness is enforced in source but requires exact-head tests and storage verification; CMS-created root project pages still need SEO metadata propagation under PORT-US-044. **Owner-dependent:** production R2 + login check, `VITE_SITE_URL`, JARVIS tunnel secrets, first CI run, Sai monogram (DR vs DS).

## 1. Product summary

A cinematic, Netflix-inspired portfolio presenting four people — **Abhishek** (root site `/`), **Amulya / Ammu**, **Anjini Kumar / Bava** and **Sai / Darling** (`/people/{ammu,bava,sai}`, `/people/darling` → `/people/sai`). All profiles now share one visual template (chapter heroes, featured projects, contact panel, footer, per-person monogram). Visitors can chat with a profile-grounded AI assistant, which now runs on the owner's **JARVIS personal AI** (OpenAI fallback only with explicit paid-fallback opt-in; offline profile answers when no AI is reachable). A private `/admin` area lets the owner upload resumes and images, review them, and publish/unpublish.

**Latest local evidence (2026-11-07):** typecheck 0 errors · lint 0 errors (6 warnings) · **107 Vitest + 4 Node tests pass** · production build passes · 33-route matrix and all **43 sitemap routes return 200** · Edge headless pass at 1440 px and 390 px with no page errors or horizontal overflow · axe serious issues **62 → 2** (both are `aria-hidden` watermark false positives) · admin image lifecycle and resume upload verified on the dev server.

## 2. Status at a glance

| Epic | Done | Needs testing | Pending development |
|---|---|---|---|
| **PORT-E01** Shared design & four profiles | Shared template for all four profiles (`0b2308f`); per-person monogram (no more GA logo on other profiles); identity isolation | Owner visual/content review of every page per profile | Personal hero images for Ammu/Bava/Sai; merge the two contact components; Sai monogram “DR” vs data initials “DS” (decision) |
| **PORT-E02** Routes & content | Route matrix, direct load/refresh, 404s, `/portfolio` → 301 `/`, `/people/darling` → Sai, broken project links fixed + 301 | Owner click-through of every nav link on phone | Resume files for Ammu/Bava/Sai (Resume buttons hidden until provided) |
| **PORT-E03** AI intro & chat | Profile-grounded chat, approved-resume context, streaming/cancellation, offline fallback, idle-based timeouts | Voice/video intro on a real phone and desktop browser | — |
| **AI provider via JARVIS** | `/api/chat` prefers JARVIS (`JARVIS_AI_URL` + `JARVIS_AI_KEY`), OpenAI fallback only with explicit opt-in, 503 → offline answers; published CMS/resume/persona context is profile-scoped | Production: deployed site → Cloudflare Tunnel → JARVIS | Tunnel + site key + deployment secrets (owner setup) |
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
- `README.md` now documents JARVIS as primary and OpenAI as explicit opt-in only; keep deployment instructions aligned with the provider resolver and the selected profile's published-context boundary.

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

Public image placements were audited across the profile selector, Abhishek's homepage, About page and AI introduction portrait, the three shared person-profile homes and About sections, profile project cards, Abhishek's project index/featured showcase, and all project-detail renderers. Personal portrait, gallery and project media now resolve through the published image feed using profile ID and, for project media, exact project slug. The profile selector now uses the shared feed normalizer. The normalizer rejects malformed UUIDs, mismatched image URLs, empty alt text, invalid project slugs and project slugs on non-project placements. Abhishek's static duplicate profile image with inaccurate alternative text was removed. Bundled portrait/gallery assets remain intentional fallbacks; shared brand billboards, backdrops and logo remain static design assets.

Both image and resume admin APIs accept the four public profile IDs. Added integration-test source for each profile covering the image lifecycle (private upload, publish, replace, restore, unpublish, republish and delete) and resume lifecycle (private upload, publish, supersede, history, rollback, unpublish, private download and delete/history redaction). Added normalizer coverage for cross-profile image feed isolation.

Implementation and test source only. No tests, builds, typechecks, lint, browser, accessibility, CI or storage-provider checks were run because validation remains paused. Verify all public routes, lifecycle operations, cross-profile isolation, cache behavior, R2/local-disk consistency and failure compensation before acceptance.

## Current P0 development increment — PORT-US-045 and PORT-US-046 (2026-11-12)

**Branch:** `new`  
**Status:** SOURCE IMPLEMENTATION / AUTOMATED TESTS AUTHORED / VALIDATION PAUSED

### PORT-US-045 — Storage recovery and data integrity
- Added a durable write-ahead recovery journal for resume index/feed/history commits, image multi-object lifecycle operations and backup restore/migration writes.
- Added owner-only recovery status and explicit recovery action in Admin → Backup & Restore.
- Added failure-injection test source for rollback, failed compensation/recovery replay, journal preparation failure and same-isolate overlapping transactions.
- Remaining: stale read-modify-write protection (including requests that prepare snapshots before entering the transaction queue), distributed/multi-Worker concurrency control, remaining non-journaled content/persona writes, storage reconciliation and hosted R2 acceptance.

### PORT-US-046 — Admin authentication and security
- Enforced a minimum 32-byte session signing secret.
- Session epoch storage now fails closed; admin authorization also fails closed if private session storage is unavailable.
- Runtime bypass is rejected in production builds.
- Added an authenticated same-origin session renewal endpoint and admin navigation control.
- Added test source for secret strength, route protection, CSRF rejection, renewal and invalid epoch behavior.
- Remaining: distributed login throttling, production secret rotation/configuration verification, full route/mutation inventory and production-like session acceptance.

**Validation boundary:** no tests, build, typecheck, lint, audit, browser, accessibility, CI or R2 checks were run. Source implementation and authored tests are not verified behavior. No merge or deployment.


### PORT-US-045 follow-up — resume binary write boundaries (2026-11-12)

Resume upload now journals the private original and index together. Resume deletion now journals the private index, public approved feed, history redaction and original binary deletion as one recoverable transaction. Added failure-injection test source for ambiguous upload-index and original-delete failures. These changes remain unvalidated; distributed concurrency and hosted R2 acceptance remain open.


PORT-US-046 configuration note: owner password minimum is 12 characters and session signing secret minimum is 32 UTF-8 bytes. Session epoch values must be safe integers. The login attempt throttle is currently isolate-local, not distributed; hosting-level rate limiting and secret rotation remain production-readiness work.


## Current development increment — PORT-US-043 CMS coverage and PORT-US-034/037 JARVIS boundaries (2026-11-12)

- **Branch:** `new`
- Root Abhishek Skills now renders all published CMS skill groups, including custom categories instead of filtering to a fixed curated category list.
- Root Home and About consume CMS basics, experience, education and location. About milestones now derive from the published experience collection.
- Root Projects now consumes the merged published project inventory, including owner-created projects; the detail route can render published CMS-created slugs and returns not-found for unknown/archived slugs.
- All three person profiles merge CMS location and social handles into the shared model. Contact links accept only HTTPS destinations on LinkedIn/GitHub domains or safe platform handles. Profile Home/About basics follow CMS override → approved resume → curated fallback; structured resume sections remain primary where published.
- Explicit empty CMS skills, projects, experience and certification collections now remain empty instead of silently restoring curated defaults. Empty CMS social lists can clear curated social destinations.
- JARVIS request enrichment now includes only the selected profile's published CMS document, approved resume and published persona. Drafts, private originals, admin review notes and other profiles are excluded. The chat route revalidates CMS content and merges it into person-profile knowledge; Abhishek's root prompt receives published CMS facts as well.
- JARVIS remains the primary AI provider. OpenAI fallback requires both an API key and explicit `PORTFOLIO_AI_ALLOW_PAID_FALLBACK=true`. Provider error bodies are no longer copied into application logs.
- Added regression test source for CMS empty collections, project creation/archive, profile merge, and JARVIS prompts using published CMS context.
- **Still open:** exact-head tests/build/typecheck/lint, route-level SSR/404 checks, live CMS publish-to-public acceptance, JARVIS tunnel/hosted connectivity, multi-profile isolation, gateway rate-limit/policy/audit verification, timeout/cancellation/failure-path acceptance and privacy review.
- **Validation:** deliberately not run. No test, build, typecheck, lint, browser, accessibility, security scan, CI or production verification is claimed.


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



---

## Historical roadmap

_Source consolidated from `roadmap.md`; retained for complete requirement and decision traceability._

# Netflix-inspired portfolio enhancement

# Four-person portfolio update
- [ ] Replace main audience picker with Abhishek, Amulya, Anjini and Sai.
- [ ] Add typed person data and shared person-specific pages; preserve Abhishek routes and interactions.
- [ ] Test person boundaries, facts, routing, navigation and mobile states; do not publish.

# Multi-page cinematic update
- [ ] Add Home, About, Skills, Projects/detail, Experience, Certifications and Contact with shared navigation/footer.
- [ ] Preserve profile picker, legacy portfolio, portraits, optional intro and chatbot.
- [ ] Apply design-reference guidance and verify local asset/icon licenses.
- [ ] Validate routes, factual rules, interactions and mobile layout.

- [x] Add four selectable profiles, optional intro, and profile switching.
- [x] Apply cinematic red/charcoal design, billboard and accessible details.
- [x] Add horizontal project/episode rows, skill categories, and awards.
- [x] Connect supplied social URLs and honest bio/resume/contact actions.
- [x] Test factual rules, desktop/mobile interactions, accessibility and errors.

# Optional AI portfolio introduction

- [ ] Inspect video and connect authentic/AI portraits — blocked: the video, refer real.jpeg and ai refer.jpeg are absent from both upload mounts; needs re-upload.
- [x] Add shared accessible intro with transcript and optional browser voice to picker and hero.
- [x] Verify playback, fallback, mobile layout and existing portfolio interactions; portrait verification awaits missing images.

# Video-backed introduction

- [ ] Add both supplied clips with user-started background intro narration.
- [ ] Verify video selection, playback, pause, replay and cleanup.

# AI portfolio chatbot

- [x] Floating launcher + chat panel, grounded AI replies with honest offline fallback.
- [ ] GitHub sync — managed by Lovable's GitHub connector; cannot be driven from chat.

# Delivery plan and release gates (2026-10-31)

Status: the roadmap below is the execution order. A checkbox is not considered complete until there is evidence from a successful build/test run or documented manual acceptance. Do not merge to main or publish/deploy without explicit approval.

## P0 — unblock engineering and establish reliable validation

1. **EPIC-01 — Build stability and engineering foundation**
   - [x] Align the package manifest with the existing lockfile: `@lovable.dev/vite-tanstack-config` is now `2.25.3` in both files (commit `4fd8402`).
   - [ ] If the intended dependency target is still `2.26.5`, regenerate the lockfile with Node.js 24/npm in a network-enabled environment; do not hand-edit lockfile integrity/resolution metadata.
   - [ ] Run and record `npm ci`, `npm run build`, `npm run lint`, and `npm test` successfully. These have not yet been run against the aligned commit.
   - [x] Verification workflow configuration is limited to pushes to `dev`, pull requests targeting `dev`/`main`, or manual dispatch, with cancellation of stale runs; a successful run is still needed.
2. **EPIC-02 — Portfolio-wide functional validation**
   - [ ] Build a route/interaction acceptance matrix for all four profiles and record browser-level results.
   - [ ] Cover desktop, tablet and mobile, including loading, empty, offline, validation and failure states.
   - [ ] Verify navigation, chat/voice, contact, resume workflows and profile-data isolation.
   - [x] Add data-level acceptance tests for project/slug consistency, navigation data, contact destinations, experience, skills and certifications (commit `c7c407c`); run them and add browser smoke checks based on the matrix.

## Development-only execution (user direction, 2026-10-31)

Testing and validation work is paused by user request. Continue feature implementation on the current feature branch; do not run tests, build, lint, browser checks, or acceptance exercises until the user resumes that work.

## P1 — product capabilities

3. **EPIC-07 — Resume Manager and document processing**
   - [x] Add client-side search across filename, display name, headline, summary and skills.
   - [x] Add status filtering (all, pending review, approved/published), clear-filters action, result count and published/pending summary counts (commit `f1ed72e`).
   - [x] Save reviewed metadata as a private pending draft without publishing; moving an approved record back to draft removes it from the public approved-resume feed.
   - [x] Add bounded best-effort PDF/DOCX text extraction into private review notes with a manual edit step; scanned PDFs/OCR and complex PDF font encodings remain unsupported (commit `0f5a5bb`).
   - [x] Add explicit profile assignment (Abhishek, Amulya, Anjini Kumar or Sai); publishing rejects missing/invalid assignment and excludes unassigned or legacy records from the public feed.
   - [x] Render approved resume metadata only on its matching public profile homepage, with no source-file links and no changes to the existing hardcoded portfolio facts (commit `5373a93`).
   - [ ] Authentication/session, storage, upload/download/delete and file-boundary validation are deferred while testing is paused.
   - [x] Add strict validation for persisted private resume-index records, including UUIDs, allowed content types, size bounds, profile IDs, structured-section shapes and duplicate IDs; corrupted indexes fail closed rather than being silently treated as empty (source change only, commit `b5b3006`).
   - [x] Make resume upload storage/index updates clean up the newly stored private file if index persistence fails, preventing orphaned uploads where cleanup succeeds (source change only, commit `b5b3006`).
   - [x] Restrict resume record API paths to canonical UUIDs before resolving private storage keys (source change only, commit `b5b3006`).
   - [ ] Verify these storage and boundary behaviors with failure-injection tests and hosted storage checks when validation resumes.
4. **EPIC-08 — Dynamic profile updates and publishing**
   - [x] Centralize approved-resume feed serialization and order unpublish/draft/delete operations to remove public visibility before persisting private status/removal; publishing persists private approval before exposing the public feed. Object storage remains non-transactional, so partial failures require reconciliation and runtime failure-injection verification (commits `c0127e6`, `fb3f084`).
   - [x] Add a public metadata-only resume highlights section filtered by profile ID; private resume files remain inaccessible from public profile pages (commit `5373a93`).
   - [x] Add an in-manager public-field preview, explicit unpublish/rollback to private pending status, and require profile assignment before publishing (commits `34c10a1`, `9298ca8`, `77b4f54`).
   - [x] Add a final publish confirmation and client-side checks for profile assignment, display name, headline, summary and empty skill entries (commit `4fad5ea`).
   - [x] Make desktop and mobile cinematic-series controls navigate to the relevant projects page instead of presenting a non-functional “coming soon” action (commit `d9404cb`).
   - [x] Expose the current page through `aria-current="page"` on desktop and mobile primary-navigation links (commit `ad25264`).
- [x] Validate resume upload filename extensions and PDF/ZIP signatures before private storage to reject mismatched or obviously invalid uploads (commit `7580f5e`).
- [x] Add client-side resume upload preflight for supported extensions, declared MIME type and 10 MB limit, plus selected-file details and a clear-selection action (commit `9f7d8d4`).
- [x] Update Amulya (Amu) profile gallery media: replace `amulya_1.webp` with `ammu3.jpeg` and `amulya_2.webp` with `amulya_main.webp` (commit `5303355`).
- [x] Add private source-text notes to the Resume Manager review workflow; notes can be pasted manually, saved only in the private index, capped at 12,000 characters, and excluded from the public feed (commits `c5862c9`, `7519102`).
   - [ ] Verify preview, approval, publish, rollback and local/hosted behavior when validation resumes.
5. **EPIC-06 — AI assistant, chat and voice**
   - [ ] Verify API configuration, grounded profile-specific answers, streaming/cancellation and honest offline fallback.
   - [ ] Test microphone permissions, unsupported browsers, privacy disclosures and failure recovery.
6. **EPIC-05 — Four profile experiences and content architecture**
   - [ ] Verify typed profile data, shared page components, route compatibility and strict separation of facts across Abhishek, Amulya, Anjini and Sai.
7. **EPIC-04 — Cinematic design and media**
   - [ ] Verify all supplied media assets exist and are correctly licensed/attributed where required.
   - [ ] Complete video intro playback, pause/replay, cleanup, reduced-motion behavior and mobile fallback.
8. **EPIC-03 — Shared UI, navigation and responsive experience**
   - [ ] Validate shared navigation/footer, active states, keyboard operation, responsive layouts and all route links.
9. **EPIC-09 — Security, accessibility and performance**
   - [ ] Audit access control, upload validation, public/private data boundaries, keyboard/screen-reader behavior and performance.
   - [x] Stop using caller-supplied `X-Forwarded-For` as the login rate-limit identity; use only the platform-provided `CF-Connecting-IP` value and fall back to a shared `unknown` bucket when unavailable (commit `45e3134`). Source-only security hardening; proxy behavior and distributed rate-limit coverage remain unverified.
   - [x] Respect the operating system reduced-motion preference by disabling the autoplaying intro video and decorative particle animation when reduced motion is requested (commits `eb6c337`, `17a47b5`). Source-only accessibility improvement; browser and assistive-technology behavior remains unverified.
   - [x] Make the floating portfolio chat an explicitly modal dialog for assistive technology and keep keyboard Tab/Shift+Tab navigation inside it; Escape closes it and returns focus to the launcher (commit `cbb84e9`). Source-only improvement; screen-reader and browser behavior remain unverified.
   - [x] Improve responsive navigation keyboard behavior: opening the mobile menu moves focus to its first item, and Escape closes it and restores focus to the menu toggle (commit `f4e7414`). Source-only improvement; browser and assistive-technology behavior remains unverified.
   - [x] Enforce the chat API's 70 KB request limit while reading the body, not only from the optional `Content-Length` header, so chunked requests cannot bypass the transport bound (commit `84adc97`). Source-only security hardening; runtime behavior remains unverified.
   - [x] Strictly validate admin session cookies before HMAC verification: enforce the timestamp/signature format, exact 32-byte SHA-256 signature length and canonical base64url encoding (commits `42b63cd`, `973726e`). Source-only security hardening; runtime behavior remains unverified.
10. **EPIC-10 — End-to-end acceptance and release**
    - [ ] Run the full acceptance matrix on the candidate branch and record results.
    - [ ] Review the complete branch diff and outstanding issues.
    - [ ] Obtain explicit user approval before any merge to `main` or deployment.

## Working rules
- During the user-requested development-only phase, continue feature implementation and explicitly leave validation tasks pending.
- Do not mark validation complete based only on source inspection; record the command/test or manual evidence when testing resumes.
- Do not commit generated lockfile metadata by hand.
- Do not merge to `main`, publish, or deploy without explicit approval.


## Upload-driven profile content automation

- [x] Let resume uploads select their target profile at upload time; persist that assignment in the private record so users do not have to assign it again afterward (commits `57956e1`, `fc1d9c0`).
- [x] Keep image uploads associated with a selected profile and serve approved images through the dynamic profile gallery feed.
- [x] Add an explicit publish-immediately option to the image upload form; server publishes the stored image and marks it approved in the same upload workflow (commits `b75f9d5`, `8638d47`).
- [ ] Add reliable PDF/DOCX text extraction to prefill editable resume fields and profile content from the uploaded document. Current runtime dependencies do not include a document parser; choose and integrate an appropriate parser before claiming extraction is automated.
- [x] Add conservative heading-based mapping for experience, education, skills, projects and certifications into private review notes; suggest skills in the editable review form. This does not yet populate the structured public profile sections, and explicit approval remains required (commits `f281381`, `230ff68`, `2bc68a8`).
- [x] Add editable structured experience, education, project and certification fields to the private review record; heading mapping can prefill them, drafts persist privately, and only explicitly approved structured fields enter the metadata-only public resume feed (commits `af32b89`, `64a3693`). Existing hardcoded profile facts are not overwritten; public profile rendering of these new fields remains a separate follow-up.
- [x] Render explicitly published experience, education, project and certification additions on their matching public profile sections, filtered by profile ID; existing static portfolio content remains intact (commit `2ad8870`).
- [x] Split recognized resume sections into separate editable review entries at blank-line and explicit bullet boundaries; wrapped lines remain together and mapping remains conservative (commits `afbd013`, `eaf833e`).
- [x] Add per-entry editing controls for structured resume sections, including add/remove actions, visible entry counts, and bounded per-entry character and count limits; changes remain private until explicit publication (commit `fefb6ec`).
- [ ] Define whether image uploads should support an explicit publish-on-upload option; current behavior intentionally keeps uploads private/pending until publication.
- [ ] Validate upload-to-profile mapping, extraction quality, draft editing, publication and rollback when testing resumes.

## Image asset reliability and dynamic media (development work)

- [x] Correct Amulya gallery references that pointed to `ammu3.jpeg`, which is not present in `public/images/profiles/amulya/` on this branch; keep references on committed assets until the new upload is available (commit `d6f2dfd`).
- [x] Add a repeatable `npm run audit:images` source/public asset audit script. It reports missing image paths, likely filename case mismatches, and unreferenced public images; it has not been run while validation is paused.
- [x] Add authenticated image upload/review/publish workflow using the existing object bucket; images remain pending/private until approval and public metadata exposes only approved image IDs, profile IDs, alt text, and app-served URLs (commits `4b7ed77`, `6a32d2d`).
- [ ] Reconcile any newly uploaded public-directory changes with this branch and run `npm run audit:images` to repair every missing/case-mismatched reference; execution is paused.
- [x] Add an explicit `/people/$person/education` route to make the Education destination a first-class route alongside the shared `$section` route (commit `1defd54`).
- [ ] After validation resumes, regenerate/inspect the TanStack route tree and directly open `/education` plus `/people/ammu/education`, `/people/bava/education`, and `/people/sai/education`; the 404 fix is implemented but not yet acceptance-verified.

- [x] Fix a source-inspection issue in JPEG filename validation: the escaped dot now matches `.jpg` and `.jpeg` filenames as intended (commit `7d7f87c`). This is a code change only; upload behavior remains untested while validation is paused.
- [x] Add image unpublish/rollback so an approved image can be removed from public galleries without deleting the private original (commits `d7ea286`, `23ae216`). Source changes only; behavior is not runtime-verified while testing is paused.
- [x] Validate persisted image-index records and duplicate IDs before use; roll back incomplete private/public upload objects when the index write fails; remove public image bytes and index visibility before deleting the private original (commit `5b547ac`). Source-only change; failure-injection and hosted object-storage behavior remain unverified while testing is paused.


## Shared profile design and image refresh

- [x] Extract the shared cinematic profile layout rules into `src/styles/profiles.css`; all four profile routes consume the same imported stylesheet and design tokens (commits `6bdf67d`, `9490d8e`).
- [ ] Replace legacy static profile image assets and every source reference with the files from the newly supplied `images.zip`. The archive includes HEIC photos, which need conversion to browser-friendly formats before references can safely be switched. Do not delete the currently referenced assets until the replacement binaries have been added to the branch; otherwise profile images would break. Testing remains paused.

## Source-level bug review (testing remains paused)

- [x] Fixed the admin image publish/unpublish route matcher so it matches the actual `/api/admin/images/:id/(publish|unpublish)` paths.
- [x] Fixed resume draft saving so edited private review notes are sent to and persisted by the existing draft API.
- [x] Fixed streamed AI-provider error messages to use actual line breaks rather than displaying literal escaped newline characters.
- [x] Updated the image-manager submit label to distinguish private uploads from immediate publication.
- [x] Hardened admin path canonicalization by decoding bounded nested URL-encoding layers and rejecting malformed or still-encoded paths before routing (commits `8e5f724`, `54b85f9`, `999b02b`). Source-only change; route behavior remains unverified while testing is paused.
- [ ] Continue source-only review of imports/exports, route wiring, request/response contracts, state handling, accessibility, and security. Do not run tests, builds, lint, browser checks, or audits until testing is explicitly resumed.
- [x] Corrected resume section entry parsing to use actual newline normalization, splitting, list-marker matching and entry joining (commit `7fd49d6`). Source-only correction; behavior remains unverified while testing is paused.
- [x] Fix resume section parsing so CR/LF normalization, line splitting, list-marker detection and editable-entry joining use actual newline/whitespace characters rather than literal backslash sequences (commit `b4b3cd5`). Source inspection only; behavior remains unverified while testing is paused.

