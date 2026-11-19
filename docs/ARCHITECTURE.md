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
One storage adapter contract supports R2, local disk and in-memory development/test providers. Private originals, published copies, indexes, histories and backup artifacts have separate trust boundaries. Backups must include all referenced binaries. Multi-object writes use compensation and a durable recovery journal where implemented; an in-process queue serializes one isolate and a conditional-write lease object (src/lib/storage-lock.ts, R2 `onlyIf` create-only and etag-matched steal, 120 s TTL) serializes isolates when the provider enforces preconditions; providers that ignore them (local disk, memory) degrade to the in-process queue. Content and persona documents are read-modify-write with etag-conditional puts (409 on conflict). Hosted R2 semantics remain unverified; tests use an in-memory model (src/test/helpers/memory-r2.ts).

Profile portraits/galleries are profile-scoped; project media is scoped by profile ID and exact project slug. Public pages use approved published feeds with curated assets as deliberate fallback. Static series artwork and logos are brand assets, not personal profile images.

## Visual system
The shared Series visual language uses profile-scoped theme tokens, responsive spacing, strong image-led hero sections and selective glass surfaces. Glassmorphism is reserved for navigation, profile-selection cards, the home hero copy panel and private admin entry/navigation. Content-heavy reading surfaces remain solid or high-opacity to preserve contrast and reduce visual noise. Translucent treatments include opaque fallbacks and reduced-transparency handling; profile theme variables remain scoped to each shell.

## Architecture guardrails
- Never represent generated portraits as authentic likenesses.
- CMS customization cannot inject scripts, unsafe markup or untrusted external resources.
- Provider credentials stay server-side.
- Unknown profile/project URLs return a real not-found response.
- Preserve the difference between omitted and explicitly empty CMS collections.
- Keep development, testing, staging and production distinct.

## Asset inventory
Active image directories are `public/images/profiles/{abhishek,amulya,anjini,sai}`. The image manager uploads private/pending resources; publication serves approved assets through profile-scoped endpoints. Keep licensing/attribution details in [Security](SECURITY.md).


## Release acceptance gaps — 2026-11-13

The architecture is implemented in substantial part, but these operational properties are not yet accepted as production-safe:

- Hosted R2/object-storage behavior, cross-instance concurrency, conditional writes/distributed locking and multi-object transaction compensation require real-environment validation.
- Storage recovery must be exercised against interrupted writes, missing/orphaned originals, stale public copies, corrupted indexes, incomplete backups and restore conflicts.
- Admin identity/session enforcement, production secrets, session expiry/revocation and shared rate limiting require production-like verification.
- CMS field coverage and publication precedence must be demonstrated end-to-end for every supported field and all four profile IDs.
- JARVIS remains an optional server-side gateway integration; production gateway reachability, authentication, timeout, cancellation, privacy filtering and fallback behavior require acceptance.
- SEO, accessibility, performance, profile isolation and release artifacts require exact-candidate evidence.

These are acceptance gaps, not a request to replace the existing architecture or introduce a multi-tenant SaaS scope.


## Changes recorded 2026-11-14

- **Storage contracts:** `ObjectBucket`, `StoredObjectBody`, `StoredObject` and `PutOptions` (src/lib/storage-adapter.ts) are the single shape shared by `RecoveryBucket`, `BackupStorage`, the adapters and the server's private bucket type.
- **Login throttling:** `LoginLimiter` (src/lib/login-limiter.ts) with memory, R2 compare-and-set and KV implementations; selection order KV binding `LOGIN_RATE_LIMIT_KV`, private R2 bucket, per-process fallback. A separate per-client chat limiter protects the AI gateway.
- **Request guards:** a central same-origin and Sec-Fetch-Site guard precedes every admin handler; request-body wrappers preserve the abort signal so visitor disconnects cancel upstream AI calls.
- **SEO routes:** /sitemap.xml and /robots.txt are served by the Worker from published CMS state; root and person project pages return real 404 statuses for unknown or archived slugs.
- **CMS model:** strengths, leadership and training join basics, projects, skills, experience, education, certifications, seo, navigation and appearance. `PERSON_FIELD_COVERAGE` documents every public person field as cms, image-manager, resume or curated identity.
- **Local development:** the disk-backed bucket is only available under the Vite dev server (`__PORTFOLIO_VITE_DEV_SERVER__`).
- **Delivery:** npm is the authoritative package manager; `npm run verify` composes the local gate; performance budgets live in scripts/performance-budget.json.
