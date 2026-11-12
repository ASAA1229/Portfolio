# ABHISHEK: THE SERIES — Portfolio

A cinematic, Netflix-inspired, multi-profile portfolio and owner-managed content platform for **Abhishek**, **Amulya (Ammu)**, **Anjini (Bava)** and **Sai (Darling)**.

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

## Delivery status
Implementation continues on `new`. Source implementation, tests authored, tests executed and owner acceptance are separate states. Validation is paused by owner direction: do not run tests, builds, typechecks, lint, security scans, browser/device/accessibility checks, CI/Jenkins or release validation until explicitly resumed. Do not merge to `dev`/`main`, deploy or release without explicit approval.
