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
   - [ ] Implement document parsing/extraction with a safe manual-review/edit step before any public approval.
   - [x] Add explicit profile assignment (Abhishek, Amulya, Anjini Kumar or Sai); publishing rejects missing/invalid assignment and excludes unassigned or legacy records from the public feed.
   - [x] Render approved resume metadata only on its matching public profile homepage, with no source-file links and no changes to the existing hardcoded portfolio facts (commit `5373a93`).
   - [ ] Authentication/session, storage, upload/download/delete and file-boundary validation are deferred while testing is paused.
4. **EPIC-08 — Dynamic profile updates and publishing**
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
- [ ] Build a reviewable content-mapping step from extracted resume sections into profile experience, education, skills, projects and certifications. Preserve profile-specific facts and require approval before public changes.
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


## Shared profile design and image refresh

- [x] Extract the shared cinematic profile layout rules into `src/styles/profiles.css`; all four profile routes consume the same imported stylesheet and design tokens (commits `6bdf67d`, `9490d8e`).
- [ ] Replace legacy static profile image assets and every source reference with the files from the newly supplied `images.zip`. The archive includes HEIC photos, which need conversion to browser-friendly formats before references can safely be switched. Do not delete the currently referenced assets until the replacement binaries have been added to the branch; otherwise profile images would break. Testing remains paused.
