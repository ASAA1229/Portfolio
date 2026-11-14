# Portfolio POC — Product Objective and Approved Scope

**Current status:** [PROJECT_STATUS.md](PROJECT_STATUS.md)  
**Stories:** [USER_STORIES.md](USER_STORIES.md) · **Roadmap:** [ROADMAP.md](ROADMAP.md)

## Objective

Build **ABHISHEK: THE SERIES**, a cinematic four-profile personal portfolio platform with a private owner-operated Admin/CMS that manages approved profile content, resumes, images, personas and publication history without routine source edits.

This is a personal portfolio platform for four profiles, not an approved multi-tenant SaaS/client website builder.

## Profiles

| Profile | Route |
|---|---|
| Abhishek | / |
| Amulya / Ammu | /people/ammu |
| Anjini / Bava | /people/bava |
| Sai / Darling | /people/sai |

Each profile has isolated facts, content, approved media, resume, contact links and AI context.

## In-scope capabilities

- Public multi-page profile experiences: home, about, skills, projects/details, experience, education, certifications and contact.
- Shared cinematic design system, responsive navigation and profile-specific presentation.
- Owner-only Admin authentication, authorization and audit history.
- CMS edit, draft/preview, validation, publish/unpublish, history and rollback.
- Private resume upload, extraction/review, structured mapping and approved publishing.
- Image upload, profile/gallery/project placement, version history, safe restore and public/private separation.
- Backup, restore, integrity inspection and recovery.
- Optional server-side JARVIS gateway for profile-scoped AI; paid OpenAI fallback only with explicit opt-in.
- SEO metadata, canonical URLs, sitemap, robots and correct not-found responses.
- CI, provenance, SBOM, checksums, artifact verification and optional gated Nexus publication.
- Accessibility, responsive compatibility, performance, monitoring and operational recovery.

## Architecture and constraints

- React 19, TypeScript, TanStack Start/Router, Vite, Node-compatible server runtime and Tailwind/Radix UI.
- Cloudflare Workers configuration and private R2 resume bucket binding exist.
- Local-disk and in-memory storage adapters support development/test.
- Current GitHub Actions/Jenkins scripts use npm and package-lock; bun.lock also exists and package-manager authority requires review.
- No unnecessary paid services or runtime dependencies. Public browsing must work when JARVIS is unavailable.
- Secrets remain server-side. Never expose private resumes, drafts, backups, audit data or another profile's content.
- Contact prepares user-controlled mailto drafts; do not claim message delivery.
- Never represent AI-stylized/generated images as authentic photographs.

## Out of scope without owner approval

Multi-tenant SaaS, public self-service registration, billing, unapproved paid AI fallback, new paid infrastructure, production deployment, public release, Nexus publication or branch promotion.

## POC success criteria

All four profiles are accurate and isolated; Admin securely manages approved content/resources; storage/recovery is reliable; AI/SEO is safe; quality/security/accessibility/performance pass; and deployment, backup and rollback are demonstrated in an approved staging environment. Current release is NO-GO.


## POC status — 2026-11-14

The POC scope is unchanged. Success criteria met locally: four profiles isolated in content, resume, image, persona and AI context (tested); Admin manages all public person fields except curated identity; storage recovery and backup/restore proven against an R2 model; AI and SEO behave safely under tested failure modes. Not yet met: hosted storage acceptance, manual accessibility and performance acceptance on devices, and an approved staging deployment with backup and rollback rehearsal. Release remains NO-GO (see PROJECT_STATUS.md).
