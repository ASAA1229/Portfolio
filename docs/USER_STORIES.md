# Portfolio — User Stories and Acceptance Criteria

**Branch:** `new`  
**Baseline:** `32ee3bf7b89fabcb33bc8d69848587e8416a4f12`  
**Status convention:** OPEN until the criteria are verified with recorded evidence.

Epic mapping: [EPICS.md](EPICS.md)  
POC baseline and remaining work: [POC.md](POC.md)

## PORT-E01 — Shared UI and Four-Profile Experience

### PORT-US-001 — Consistent shared design
**As a visitor,** I want all four profile pages to use a consistent design system, so that the portfolio feels like one cohesive product.

**Acceptance criteria**
- All profiles use the shared layout, navigation, typography, spacing and responsive rules.
- Profile-specific styling is limited to documented content or intentional theme differences.
- A change to a shared component is reflected consistently across all profiles.
- Visual regression checks cover desktop, tablet and mobile sizes.

### PORT-US-002 — Profile-specific content and imagery
**As a visitor,** I want each profile to show the correct person's content and images, so that information is not mixed between profiles.

**Acceptance criteria**
- Each profile loads its own approved biography, skills, projects, experience, education and certifications.
- Images resolve to the correct profile and have meaningful alt text.
- Missing assets use a safe fallback and do not break layout.
- No profile-specific private/admin data is rendered publicly.

## PORT-E02 — Routing, Navigation and Content Integrity

### PORT-US-003 — Reliable profile navigation
**As a visitor,** I want to navigate between profiles and their sections, so that I can find relevant information easily.

**Acceptance criteria**
- Profile and section links navigate to the correct route.
- Direct URL load and browser refresh work for every supported route.
- Invalid profile, section or project slug returns a deliberate not-found experience.
- Active navigation state reflects the current route.

### PORT-US-004 — Complete portfolio sections
**As a visitor,** I want working project, skills, experience, education, certification and contact pages, so that I can explore the complete portfolio.

**Acceptance criteria**
- Each section renders for the correct profile where applicable.
- Project detail pages load the correct project by slug.
- Empty sections have an intentional empty state rather than a broken page.
- Contact links are valid and do not expose private data.

## PORT-E03 — AI Portfolio Assistant

### PORT-US-005 — Profile-aware AI introduction
**As a visitor,** I want the AI introduction to describe the selected profile accurately, so that I receive relevant information.

**Acceptance criteria**
- The assistant receives only the selected profile's approved context.
- Claims about skills, experience, education and projects are grounded in stored data.
- Unknown information is acknowledged rather than invented.
- Switching profiles updates the assistant context.

### PORT-US-006 — Secure server-side AI requests
**As the owner,** I want AI provider credentials kept server-side, so that public visitors cannot retrieve or misuse them.

**Acceptance criteria**
- The API key is read only from a server-side environment variable.
- No key appears in client bundles, source control, logs or error responses.
- Missing key, invalid key, timeout, rate limit and provider failure produce safe user feedback.
- Request size and input validation are enforced.

## PORT-E04 — Admin, Resume and Image Management

### PORT-US-007 — Protected admin access
**As the owner,** I want admin routes protected by server-side authentication and authorization, so that only authorized users can manage portfolio content.

**Acceptance criteria**
- Unauthenticated requests cannot access admin data or mutations.
- Authorization is checked on every server-side loader, action and API.
- Session expiry and logout invalidate access.
- Unauthorized attempts do not disclose whether protected files or records exist.

### PORT-US-008 — Safe resume upload and extraction
**As the owner,** I want to upload a profile resume and extract structured information, so that portfolio updates are easier to maintain.

**Acceptance criteria**
- Only explicitly supported PDF/DOCX formats are accepted.
- Extension, MIME/content, size and parser errors are validated safely.
- Extracted fields are mapped to the selected profile only.
- Extracted data is presented for review before public publication.
- Original resume files remain private and are not exposed by public routes.

### PORT-US-009 — Safe profile image management
**As the owner,** I want to update profile images through the admin workflow, so that approved assets can be maintained safely.

**Acceptance criteria**
- Upload type, size and file name are validated.
- Files cannot escape the intended storage location.
- Failed updates do not leave partially updated profile state.
- Public pages display the new approved image and a safe fallback on failure.

## PORT-E05 — CI Quality and Automated Testing

### PORT-US-010 — Repeatable quality checks
**As a maintainer,** I want build, lint and test checks to run consistently, so that regressions are detected before release.

**Acceptance criteria**
- Clean install, production build, lint and all configured tests pass on the exact commit.
- Failures identify the command and actionable cause.
- Critical route, admin, AI and integrity flows have automated coverage.
- A passing workflow is linked to the exact commit SHA.

### PORT-US-011 — Browser acceptance
**As a maintainer,** I want the portfolio checked in a real browser, so that route and interaction issues missed by unit tests are detected.

**Acceptance criteria**
- All four profiles and key section routes load.
- Navigation, chat, contact and admin protection behave as expected.
- Direct route refresh and invalid-route behavior are verified.
- Responsive and keyboard-accessibility checks are recorded.

## PORT-E06 — Build Provenance and Artifact Integrity

### PORT-US-012 — Traceable release manifest
**As a release owner,** I want each package to include a manifest and SHA-256 inventory, so that its contents and origin can be verified.

**Acceptance criteria**
- Manifest records artifact identity, build number, source commit and packaged file inventory.
- Each file has a deterministic relative path, size and SHA-256 digest.
- Archive checksum sidecar is generated and verified.
- Manifest provenance is compared with the expected build identity.

### PORT-US-013 — Reject modified artifacts
**As a release owner,** I want modified or mismatched packages to fail verification, so that untrusted builds are not delivered.

**Acceptance criteria**
- Incorrect archive name, size or digest is rejected.
- Missing, extra, modified and unsafe-path entries are rejected.
- Manifest-ignore policy authenticity is checked before trusting its rules.
- Signature verification uses a public key obtained independently from the package.

## PORT-E07 — Jenkins and Nexus Delivery

### PORT-US-014 — Publish through Jenkins
**As a release engineer,** I want Jenkins to build and publish the package, so that releases are repeatable and traceable.

**Acceptance criteria**
- Pipeline records build number and full source commit.
- Nexus credentials are retrieved from Jenkins Credentials, never hardcoded.
- Existing artifacts are not silently overwritten.
- Upload is followed by download and SHA-256 comparison.
- A real Jenkins run and Nexus artifact URL are recorded as evidence.

### PORT-US-015 — Retrieve a verified Nexus release
**As a release engineer,** I want to retrieve a specific customer/version artifact from Nexus, so that the intended release can be verified and delivered.

**Acceptance criteria**
- Artifact coordinates identify the intended project, version/build and customer where applicable.
- Retrieval does not rely on ambiguous latest-version selection.
- Manifest, checksum and archive are downloaded and validated.
- Missing or inaccessible artifacts produce actionable errors without leaking credentials.

## PORT-E08 — Customer Verification and On-Site Change Detection

### PORT-US-016 — Verify customer package before use
**As a customer operator,** I want to verify the package before extraction and use, so that tampering is detected early.

**Acceptance criteria**
- The trusted manifest-ignore policy is authenticated first.
- The manifest is verified against the authenticated policy.
- Archive name, size and SHA-256 are verified before extraction.
- Extracted files are compared against the manifest inventory.
- Verification fails closed on missing, modified, extra or unsafe files.

### PORT-US-017 — Detect on-site changes
**As a support engineer,** I want to compare the installed environment with its approved baseline, so that local modifications can be investigated.

**Acceptance criteria**
- The tool reports changed, missing, additional and ignored paths distinctly.
- Hashing is deterministic and does not modify customer files.
- Reports include timestamp, baseline identity and actionable mismatch details.
- Permission and unreadable-file errors are reported rather than silently skipped.

## PORT-E09 — Production Readiness and Operations

### PORT-US-018 — Safe deployment and rollback
**As the owner,** I want a documented release and rollback process, so that production changes can be recovered safely.

**Acceptance criteria**
- Production secrets are configured through the hosting provider's secret store.
- Release artifact, manifest, checksum and commit are traceable.
- Rollback steps and recovery owner are documented and tested where possible.
- Production release requires explicit owner approval.
