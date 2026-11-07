# Portfolio — User Stories and Acceptance Criteria

**Repository:** `Guda-Abhishek/pixel-perfect-pixel`  
**Branch:** `new`  
**Status:** OPEN until acceptance criteria are verified with recorded evidence.

Epic mapping: [EPICS.md](EPICS.md)  
Product baseline and remaining work: [POC.md](POC.md)

## PORT-E01 — Shared Design System and Four-Profile UI

### PORT-US-001 — Consistent shared experience
**As a visitor,** I want all four profiles to share a consistent design system, so that the portfolio feels like one cohesive product.

**Acceptance criteria**
- All profiles use the shared layout, navigation, typography, spacing and responsive rules.
- Profile-specific styling is limited to intentional, documented differences.
- Shared component changes appear consistently across all four profiles.
- Visual review covers desktop, tablet and mobile.

### PORT-US-002 — Correct profile identity and media
**As a visitor,** I want each profile to display the correct person's facts and images, so that identities and information are never mixed.

**Acceptance criteria**
- Each profile displays only its own approved biography, skills, projects, experience, education and certifications.
- Images belong to the correct profile and include meaningful alt text.
- Missing assets use a safe fallback without breaking layout.
- Private/admin-only information is never rendered publicly.

### PORT-US-003 — Cinematic page presentation
**As a visitor,** I want portfolio sections to have the same polished visual quality as the home page, so that the experience remains engaging throughout.

**Acceptance criteria**
- About, Skills, Projects, Experience, Certifications, Education and Contact follow the approved visual language.
- Technology logos/assets are accurate and used with appropriate licensing/attribution.
- Motion is purposeful, responsive and disabled or reduced when the user requests reduced motion.
- Content remains readable at supported screen sizes.

## PORT-E02 — Routes, Navigation and Portfolio Content

### PORT-US-004 — Reliable profile and section navigation
**As a visitor,** I want to navigate between profiles and their sections, so that I can find information without broken links.

**Acceptance criteria**
- Every visible navigation item opens its intended route.
- Direct URL load and browser refresh work for every supported route.
- Active navigation reflects the current route.
- Invalid profile/section paths show a deliberate not-found experience.

### PORT-US-005 — Complete project and section pages
**As a visitor,** I want project and portfolio detail pages to load complete information, so that I can understand each person's work.

**Acceptance criteria**
- Project detail pages resolve the correct project by stable slug.
- Skills, experience, education and certifications show the correct profile data.
- Empty sections have an intentional empty state.
- Internal and external links resolve to the intended destination.

### PORT-US-006 — Preserve legacy route behavior
**As a returning visitor,** I want existing supported portfolio links to keep working, so that updates do not break bookmarks or shared URLs.

**Acceptance criteria**
- Legacy routes either continue to work or redirect to a documented replacement.
- Profile selection and profile-specific routes remain consistent.
- No redirect loop or route collision is introduced.
- Route behavior is covered by regression checks.

## PORT-E03 — AI Introduction and Portfolio Chat

### PORT-US-007 — Profile-aware AI introduction
**As a visitor,** I want the introduction to describe the selected person accurately, so that I receive relevant information.

**Acceptance criteria**
- The assistant uses only the selected profile's approved context.
- Switching profiles updates the assistant's context.
- Unknown facts are acknowledged rather than invented.
- The introduction can be dismissed and does not unexpectedly play audio.

### PORT-US-008 — Grounded portfolio chat
**As a recruiter or visitor,** I want to ask questions about a profile, so that I can quickly understand skills and experience.

**Acceptance criteria**
- Answers are grounded in current portfolio data and approved resume additions.
- The assistant does not invent projects, qualifications, employers or dates.
- Private resume files, review notes and admin data are not included in public context.
- Empty/unknown answers are handled honestly.

### PORT-US-009 — Secure and resilient AI requests
**As the owner,** I want AI provider credentials and requests handled securely, so that the integration cannot expose secrets or fail unsafely.

**Acceptance criteria**
- The API key is read only from a server-side environment variable.
- No key appears in client bundles, source control, logs or error responses.
- Request size/input validation and rate limiting are enforced.
- Missing/invalid key, timeout, provider failure and rate limiting return safe feedback.
- Cancellation and retry behavior do not leave stale or duplicated responses.

### PORT-US-010 — Accessible voice and video introduction
**As a visitor,** I want optional voice/video controls, so that I can choose how to experience the introduction.

**Acceptance criteria**
- Audio/video starts only after an explicit user action.
- Play, pause, replay and close controls remain synchronized.
- Unsupported microphone/browser features have a usable fallback.
- Closing the introduction stops its own playback and cleans up resources.
- Reduced-motion preferences are respected.

## PORT-E04 — Admin, Resume and Image Management

### PORT-US-011 — Protected owner access
**As the owner,** I want admin routes and APIs protected by server-side authentication and authorization, so that only I can manage portfolio content.

**Acceptance criteria**
- Unauthenticated and unauthorized requests cannot read or mutate admin data.
- Authorization is checked on every server-side loader, action and API.
- Session expiry and logout invalidate access.
- Errors do not reveal protected record or file existence.

### PORT-US-012 — Upload and review resumes
**As the owner,** I want to upload a resume for a selected profile and review extracted information, so that profile updates are easier to maintain.

**Acceptance criteria**
- Only supported file formats and bounded file sizes are accepted.
- Extension, MIME/content signature, filename and parser errors are validated.
- Extracted fields are mapped to the selected profile only.
- Extracted facts remain private/pending until reviewed and explicitly approved.
- Original resume files and review notes are not publicly accessible.

### PORT-US-013 — Publish and roll back resume content
**As the owner,** I want to publish approved resume-derived sections and roll them back, so that public profile updates remain controlled.

**Acceptance criteria**
- Profile assignment and required fields are validated before publishing.
- Only approved metadata/structured content appears on the matching profile.
- Existing verified portfolio facts are not silently overwritten.
- Unpublish/rollback removes public visibility while preserving private source data where appropriate.
- Partial storage/index failures are reported and reconciled safely.

### PORT-US-014 — Manage profile images
**As the owner,** I want to upload, review, publish and unpublish profile images, so that galleries stay accurate and current.

**Acceptance criteria**
- Upload type, size and filename are validated.
- Files remain private/pending until the configured approval action.
- Published images are associated with the intended profile only.
- Unpublish removes public visibility without unintended data loss.
- Failed operations do not leave broken public references.

## PORT-E05 — Quality Engineering and Automated Testing

### PORT-US-015 — Repeatable engineering checks
**As a maintainer,** I want clean install, build, lint and test commands to pass, so that regressions are detected before release.

**Acceptance criteria**
- Clean dependency installation succeeds on the documented runtime.
- Production build, lint and all configured tests pass on the exact commit.
- CI results identify the commit SHA and actionable failure details.
- No check is marked passed without an executed result.

### PORT-US-016 — Browser-level acceptance
**As a maintainer,** I want critical journeys tested in a real browser, so that issues missed by unit tests are detected.

**Acceptance criteria**
- All four profiles and their key section/project routes load.
- Navigation, profile switching, chat, contact and admin protection behave as expected.
- Direct route refresh and invalid-route behavior are checked.
- Desktop/tablet/mobile and keyboard interactions are recorded.

### PORT-US-017 — Regression and failure-path coverage
**As a maintainer,** I want important error paths covered by tests, so that failures do not expose data or leave inconsistent state.

**Acceptance criteria**
- Tests cover invalid uploads, parser failures, unauthorized access and partial persistence failures.
- AI tests cover missing configuration, provider errors, rate limits and malformed responses.
- Profile isolation and public/private boundaries have regression tests.
- Test results are traceable to the commit under review.

## PORT-E06 — Accessibility and Responsive Experience

### PORT-US-018 — Keyboard and assistive-technology support
**As a visitor using a keyboard or assistive technology,** I want all essential controls to be accessible, so that I can use the portfolio independently.

**Acceptance criteria**
- All interactive controls are keyboard reachable and have visible focus.
- Dialogs manage focus correctly and support Escape where appropriate.
- Headings, labels, landmarks and accessible names are meaningful.
- Images have suitable alt text; decorative images are ignored by assistive technology.
- Color contrast meets the project's chosen accessibility target.

### PORT-US-019 — Responsive and reduced-motion behavior
**As a mobile or motion-sensitive visitor,** I want the site to adapt to my device and preferences, so that it remains comfortable to use.

**Acceptance criteria**
- Layouts work at agreed desktop, tablet and mobile breakpoints.
- No unintended horizontal overflow or clipped controls appear.
- Touch targets and text remain usable on mobile.
- Reduced-motion preference suppresses non-essential motion and autoplay.
- User-controlled audio/video remains optional.

## PORT-E07 — Performance, SEO and Production Readiness

### PORT-US-020 — Fast and reliable pages
**As a visitor,** I want pages and images to load reliably, so that I can explore the portfolio without unnecessary delay.

**Acceptance criteria**
- Large images are appropriately sized and optimized.
- Route loading and client bundles are reviewed for avoidable overhead.
- Loading, empty and error states are deliberate.
- Performance findings and material regressions are recorded.

### PORT-US-021 — Search and social presentation
**As a visitor or recruiter,** I want portfolio pages to have accurate metadata and share previews, so that links are understandable when discovered or shared.

**Acceptance criteria**
- Important routes have accurate titles and descriptions.
- Canonical URLs and social preview metadata are correct.
- Sitemap/robots behavior matches the intended public routes.
- Private/admin routes are not exposed as public search content.

### PORT-US-022 — Controlled production release
**As the owner,** I want a documented release and recovery process, so that production changes are safe and reversible.

**Acceptance criteria**
- Production secrets are configured only through the hosting provider's secret store.
- Candidate commit and successful CI/browser evidence are recorded.
- Known limitations and rollback steps are documented.
- Production deployment occurs only after explicit owner approval.

### PORT-US-023 — Profile image asset integrity
**As a maintainer,** I want every profile avatar, portrait and gallery reference to resolve to a committed public asset, so that broken images are caught before release.

**Acceptance criteria**
- Every profile-directory avatar reference resolves to a file under the public assets directory.
- Every portfolio portrait and gallery image reference resolves to a committed file.
- Missing image paths fail the automated test suite with the missing path listed.
- The check covers all supported profile entries and does not rely on remote network access.


## Additional stories — current hardening increments

### PORT-US-024 — Approved, profile-scoped resume context for AI

**As a visitor,** I want the portfolio assistant to use only the selected person's latest approved published resume information, so that answers are current without exposing private drafts or mixing profiles.

**Acceptance criteria**
- The server obtains resume context only from the approved published-resume feed.
- The selected profile ID is matched before context is attached or used.
- Client-supplied resume context cannot override server-approved context.
- Private drafts, original resume files and review notes are excluded.
- Resume content is treated as untrusted data; embedded instructions are ignored.
- Request-size limits remain enforced after context enrichment.
- Missing or unavailable approved context falls back safely without inventing facts.

**Current status:** IMPLEMENTED in source; runtime and regression verification pending.

### PORT-US-025 — Reliable AI streaming and request cancellation

**As a visitor,** I want streamed assistant responses to finish completely and respect cancellation, so that I do not see truncated text, stale answers or speech after stopping a request.

**Acceptance criteria**
- Final buffered server-sent events are processed even when the stream ends without a newline.
- UTF-8 decoder buffers are flushed at stream completion.
- Only the active request may update the current conversation or busy state.
- Cancelled requests do not continue speaking or overwrite a newer response.
- Offline fallback content is shown in the conversation when the provider request fails.

**Current status:** IMPLEMENTED in source; browser and automated verification pending.

### PORT-US-026 — Validate release and snapshot integrity inputs

**As a portfolio maintainer,** I want release manifests and environment snapshot inventories validated before comparison, so that unsafe paths or malformed metadata cannot produce misleading integrity reports.

**Acceptance criteria**
- Manifest inventory paths reject absolute, traversal, NUL-containing and Windows drive-relative/drive-prefixed paths.
- Duplicate manifest paths, invalid sizes and malformed SHA-256 digests are rejected.
- Snapshot inventories validate schema, file count, unique safe paths, sizes and SHA-256 values.
- Baseline and snapshot ignore policies must be equivalent; policy entries are deduplicated and sorted before comparison.
- Invalid inputs fail closed and do not produce a success report.

**Current status:** IMPLEMENTED in source; automated execution remains paused. This story covers generic repository integrity utilities only, not the separate CMM/Nexus product.

## PORT-E08 — Shared DevOps Pipeline, Provenance & Artifact Integrity

### PORT-US-029 — Generate traceable portfolio build provenance
**As a release maintainer,** I want every portfolio artifact to include a machine-readable provenance manifest, so that its project, source revision and CI origin can be identified.

**Acceptance criteria**
- The manifest records project identity, repository, normalized branch, full source commit, build number and CI provider/run metadata.
- Required fields are nonblank, non-placeholder and structurally valid.
- CI metadata is compared with current environment values when available.
- A deterministic release identity binds the project/source/build identity.
- Missing or mismatched required provenance blocks acceptance.

### PORT-US-030 — Validate manifest inventory and artifact integrity
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

**Current development status:** strict manifest validation and archive-backed inventory comparison are implemented in `scripts/customer-release-verifier.mjs`. The verifier inspects `.tar.gz` member paths/types, rejects unsafe paths and links, extracts to an isolated temporary directory, then compares each file's path, size and SHA-256 with the manifest. GitHub Actions and Jenkins pass the archive directly. Policy creation also rejects a package whose filename, size or SHA-256 does not match the manifest. System `tar` is required; automated execution remains paused.

### PORT-US-031 — Verify customer packages and explain failures
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
**As a release maintainer,** I want GitHub Actions and Jenkins to produce traceable artifacts with dependency SBOM and integrity metadata, so that releases can be independently reviewed.

**Acceptance criteria**
- Configured pipelines package artifact, manifest, checksum, signature metadata and CycloneDX SBOM.
- Signing credentials are available only to signing operations and temporary key files are cleaned up.
- Pipeline steps stop on command failures and reject incomplete output.
- CI configuration is documented using secret/variable names only.
- Exact-head pipeline execution and artifact inspection are recorded before acceptance.
- Nexus publication remains disabled until separately authorized.

### PORT-US-033 — Gate promotion and deployment on release evidence
**As the portfolio owner,** I want promotion and deployment to remain controlled by explicit approval, so that unverified artifacts cannot be published.

**Acceptance criteria**
- Feature development remains on authorized `new` branch and integration promotion follows the documented branch policy.
- Failed artifacts can be rejected/quarantined with an actionable reason.
- Rollback and recovery instructions are documented.
- No merge to production, deployment or Nexus publication occurs without explicit owner approval.
- Testing and pipeline acceptance remain pending while validation is paused.


**Current implementation status:** IMPLEMENTED IN SOURCE / RUNTIME VERIFICATION PENDING. Operator-invoked quarantine and recovery-candidate record commands are available in `scripts/release-disposition.mjs`; they fail closed on inconsistent evidence and never perform promotion, deployment, rollback or Nexus publication. See [release rejection, quarantine and recovery](release-rejection-quarantine-recovery.md). Acceptance remains pending while validation is paused.
