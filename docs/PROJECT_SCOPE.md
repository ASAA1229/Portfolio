# Portfolio Project Scope

**Project:** Portfolio — cinematic multi-profile personal/professional portfolio  
**Repository:** https://github.com/ASAA1229/Portfolio  
**Scope version:** 2026-11-14 | **Status:** planning scope; verify current branch/runtime before implementation claims

## Mission
Present accurate personal/professional profiles, career history, skills, projects, credentials and contact pathways through a polished, accessible multi-profile experience.

## Users
Public visitors, recruiters and clients; authorized owner/admin for private content, resume and media management.

## In scope
- Four profile experiences: Abhishek, Amulya/Ammu, Anjini/Bava and Sai/Darling.
- Home, About, Skills, Projects and project details, Experience, Certifications, Education and Contact.
- Shared cinematic design, navigation, responsive behavior and accessibility.
- Profile-specific typed data and strict fact/content isolation.
- Resume upload, private review/draft, approval, publishing and rollback.
- Image/media upload, private storage, profile galleries, approval and unpublish.
- AI introduction, grounded chatbot and optional browser voice.
- SEO/publishing, security, performance, testing and operational readiness.

## Conditional / excluded
Video/portrait refreshes depend on supplied assets and compatible formats. OCR/scanned-PDF extraction and unsupported parser behavior are not assumed. No publication, deployment or merge without explicit approval. Never expose private resume files or unapproved media publicly.

## Architecture and constraints
Maintain shared page/layout components with profile-scoped content and routes. Preserve existing routes and interactions. Keep content truthful and owner-approved. Prior roadmap records source-level work while validation was paused; source-complete does not mean tested or accepted.

## Current status summary
Latest main-branch commit surfaced in repository metadata is 2026-11-04. The roadmap includes completed source changes and outstanding validation items. Reconcile main/dev and the current local project before making maturity claims. See `roadmap.md` and `docs/EPIC_STATUS.md`.
