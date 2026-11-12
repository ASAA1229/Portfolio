# Architecture

## System overview
A single multi-profile web application with shared UI primitives and isolated profile data. Abhishek is the root site; Amulya/Ammu, Anjini/Bava and Sai/Darling are routed under `/people/$person`. Shared navigation, typography, spacing, accessible controls and page templates provide consistency while each profile retains its own facts, assets, resume, persona and AI context.

## Application layers
- **UI:** React, reusable components, semantic visual tokens, Radix primitives and bundled Lucide icons.
- **Routing/rendering:** TanStack Start file-based routing; `src/routes/__root.tsx` is the sole root shell.
- **Server/API:** server loaders/actions and API routes enforce authentication, profile scope and publication boundaries.
- **Content:** typed curated profile data plus persisted CMS documents; approved published data overlays curated defaults.
- **AI:** server-side chat endpoint; JARVIS primary, paid OpenAI fallback only by explicit opt-in.
- **SEO:** route metadata helpers, canonical URLs, Open Graph/social metadata, sitemap and robots routes.
- **Delivery:** GitHub Actions/Jenkins, build provenance, checksums, SBOM and optional Nexus Raw publication.

## Profile isolation
Stable profile IDs scope public content, resumes, images, projects, personas and AI requests. A request for one profile must never return another profile's private or public resource. Abhishek remains at `/`; other profiles use `/people/$person`. `/profiles` is an optional picker; legacy `/portfolio` redirects to `/`.

## CMS publication lifecycle
1. Owner creates/edits a draft.
2. Server validates data and Admin previews the draft.
3. Owner explicitly publishes.
4. Public loaders read only published content and approved resource feeds.
5. History supports inspection and controlled rollback/restore.
6. Unpublish removes public visibility; private originals remain protected under retention/deletion policy.

Omitted CMS collections mean no override and permit curated fallback. Explicit empty arrays mean the owner intentionally cleared a collection. Root basics prefer explicit CMS basics; structured resume sections prefer approved resume, then CMS, then curated fallback. Person basics prefer CMS, then approved resume, then curated fallback; structured person sections prefer approved resume, then CMS, then curated fallback.

## Storage and media
One storage adapter contract supports R2, local disk and in-memory development/test providers. Private originals, published copies, indexes, histories and backup artifacts have separate trust boundaries. Backups must include all referenced binaries. Multi-object writes use compensation and a durable recovery journal where implemented; per-isolate serialization is not distributed locking/CAS. Distributed concurrency and hosted R2 semantics remain acceptance gaps.

Profile portraits/galleries are profile-scoped; project media is scoped by profile ID and exact project slug. Public pages use approved published feeds with curated assets as deliberate fallback. Static series artwork and logos are brand assets, not personal profile images.

## Architecture guardrails
- Never represent generated portraits as authentic likenesses.
- CMS customization cannot inject scripts, unsafe markup or untrusted external resources.
- Provider credentials stay server-side.
- Unknown profile/project URLs return a real not-found response.
- Preserve the difference between omitted and explicitly empty CMS collections.
- Keep development, testing, staging and production distinct.

## Asset inventory
Active image directories are `public/images/profiles/{abhishek,amulya,anjini,sai}`. The image manager uploads private/pending resources; publication serves approved assets through profile-scoped endpoints. Keep licensing/attribution details in [Security](SECURITY.md).
