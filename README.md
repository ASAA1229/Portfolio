# ABHISHEK: THE SERIES — Portfolio

A cinematic, Netflix-inspired, multi-profile portfolio and owner-managed content platform for **Abhishek**, **Amulya (Ammu)**, **Anjini (Bava)** and **Sai (Darling)**.

## Project health

**Current release status: NO-GO.** On branch `new` typecheck (0 errors), lint (0 problems), 472 Vitest tests (1 skipped; the suite is flaky, with timeouts in the image/resume lifecycle tests being fixed), 17 Playwright browser E2E tests, production build, bundle budget and manifest verification pass locally (2026-11-14); INP is measured and still above its 200 ms target; no hosted CI run, staging deployment, hosted R2 acceptance, manual accessibility review or owner sign-off exists yet. See [authoritative project status](docs/PROJECT_STATUS.md), [remaining stories](docs/USER_STORIES.md) and [release gates](docs/RELEASE_READINESS.md).

## What it does
- Presents four profile-specific public experiences with shared navigation, design language and reusable sections.
- Supports home, about, skills, projects and project details, experience, education, certifications and contact.
- Provides an owner-only Admin CMS for content, images, resumes, personas, backups, audit and publication history.
- Publishes approved content/resources to the correct profile without source-code edits; drafts and private originals remain private.
- Uses the owner's JARVIS gateway for profile-grounded AI; paid OpenAI fallback requires explicit opt-in.
- Includes SEO, sitemap/robots, release integrity and controlled operational recovery.

## Profile routes
| Profile | Route |
|---|---|
| Abhishek | `/` |
| Amulya / Ammu | `/people/ammu` |
| Anjini / Bava | `/people/bava` |
| Sai / Darling | `/people/sai` (`/people/darling` alias) |

## Run locally
Prerequisites: Node.js 24 (or the version required by the package manifest), npm and Git.

```sh
git clone https://github.com/ASAA1229/Portfolio.git
cd Portfolio
git switch new
npm ci
cp .env.example .env.local
npm run dev
```

In Windows PowerShell, use `Copy-Item .env.example .env.local`. Open the local URL printed by the dev server. Do not commit `.env.local` or credentials.

## AI configuration
Configure `JARVIS_AI_URL` and `JARVIS_AI_KEY` as server-side environment variables. Paid OpenAI fallback is disabled by default and requires both `OPENAI_API_KEY` and `PORTFOLIO_AI_ALLOW_PAID_FALLBACK=true`. Without a provider, the API returns a safe unavailable response and the UI may use profile-grounded offline answers. Never expose keys in React code or `VITE_*` variables.

## Documentation
- [Architecture](docs/ARCHITECTURE.md) — system boundaries, profile model, CMS and storage.
- [Requirements](docs/REQUIREMENTS.md) — product objective, epics, stories, acceptance and status history.
- [Development](docs/DEVELOPMENT.md) — setup, routing, contribution and validation rules.
- [Operations](docs/OPERATIONS.md) — CI/CD, artifact integrity, backup/recovery and releases.
- [Security](docs/SECURITY.md) — authentication, privacy, secrets, signing and asset governance.
- [User stories](docs/USER_STORIES.md) — authoritative story status, priorities and acceptance criteria.
- [Release readiness](docs/RELEASE_READINESS.md) — blockers, evidence requirements and release gates.

## Delivery status — 2026-11-13
See [authoritative project status](docs/PROJECT_STATUS.md) for exact commands, counts and the gap register. Run `npm run verify` for the local gate; earlier GitHub run numbers (#617, #43420111801) are superseded history. Release remains NO-GO.
The active documentation/source branch is `new` (observed head: `14f94a194c6bfcba9ed3f5e5dd1e036b8d82ebc6`). Implementation is substantial, but production release is **not approved or verified**. Source implementation, tests authored, tests executed and owner acceptance are separate states. Validation remains paused by owner direction: do not run tests, builds, typechecks, lint, security scans, browser/device/accessibility checks, CI/Jenkins or release validation until explicitly resumed. Do not merge to `dev`/`main`, deploy or release without explicit approval. See [User Stories](docs/USER_STORIES.md) and [Release Readiness](docs/RELEASE_READINESS.md) for the authoritative remaining-work baseline.


---

## ASAA Master Requirements Baseline v1.0 — 2026-11-14

Approved planning/governance reference for the four ASAA projects and shared ecosystem capabilities. Round 6 consolidation is complete at framework level. Individual requirement mapping, full source reconciliation, branch/runtime verification, named owners, dependency validation, acceptance criteria, evidence-based gaps and delivery estimates remain pending. Approval does not authorize implementation, testing, deployment, paid services or merges.

See `docs/ASAA_MASTER_REQUIREMENTS_BASELINE.md`, `docs/PROJECT_SCOPE.md` and `docs/EPIC_STATUS.md` for the current project scope and epic tracker.
