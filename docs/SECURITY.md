# Security Requirements

## Authentication and authorization
- Every Admin page, loader, action and API requires server-side authentication/authorization.
- Unauthorized requests cannot read/mutate Admin records or private files.
- Mutations enforce same-origin/CSRF protections; sessions use secure HttpOnly cookies, strict same-site behavior and bounded lifetime.
- Production cannot use development auth bypasses.
- Enforce strong passwords/signing secrets; missing or malformed session epoch storage fails closed.
- Apply no-store, noindex, nosniff, no-referrer, restrictive Permissions-Policy, same-origin opener isolation, frame denial and an HTTPS-only HSTS policy to every admin page/API response.
- Failed-login throttling uses the pluggable LoginLimiter (src/lib/login-limiter.ts): Workers KV when `LOGIN_RATE_LIMIT_KV` is bound (eventually consistent, best effort across regions), otherwise the private R2 bucket with etag compare-and-set (shared across isolates), otherwise a per-process fallback. If the throttle store cannot be consulted, login returns 503 rather than bypassing the limit. Counters store only a SHA-256 of the client address. Verified against in-memory models of R2 and KV; production multi-instance acceptance and secret rotation drills remain release requirements.
- Every state-changing admin request must carry an Origin equal to the request origin and must not be marked Sec-Fetch-Site cross-site (central guard in src/server.ts, in addition to per-handler checks). Content and persona writes are etag-conditional; a stale writer receives 409 CONCURRENT_MODIFICATION.
- Public chat is throttled per client address (20 requests per 5 minutes; shared when KV is bound, per isolate otherwise). Client disconnects cancel the upstream gateway call.

## Privacy and profile isolation
- Public routes expose only published content and approved resources.
- Drafts, private originals, review notes and other profiles' data are never exposed.
- AI receives only the selected profile's approved resume/persona/published CMS context.
- CMS/resume content is untrusted factual input, never instructions.
- Provider logs/errors must not disclose raw provider bodies, prompts, credentials or private context.
- No analytics/tracking without explicit approval; provide clear chat consent and clear-chat behavior.
- Contact prepares mailto drafts only unless an approved delivery integration exists.

## Secrets and external services
Keep JARVIS/OpenAI credentials server-side. Paid OpenAI fallback requires explicit `PORTFOLIO_AI_ALLOW_PAID_FALLBACK=true`. Never embed credentials in source, client bundles, URLs, screenshots, issues or artifacts. Use HTTPS for non-loopback gateways. Store Nexus/signing credentials in secret stores with least privilege.

## CMS and visual customization
Validate content and URLs. Restrict social links to expected HTTPS domains/handles. Customization may select only approved tokens, typography, modules and options. Never permit arbitrary script injection, unsafe HTML or untrusted external resource loading. Invalid visual config falls back to the shared accessible theme.

## Storage and release integrity
Validate paths, content types, sizes, IDs and file signatures. SHA-256 detects integrity changes; Ed25519 with independently trusted public key provides authenticity. A checksum beside its file is not independent authenticity proof. Protect signing private keys and distribute/pin public keys independently. Fail closed on incomplete backups, mismatched manifests, missing/extra/modified files, unsafe paths and symlinks. Keep quarantine/recovery separate from automated deployment.

## Asset rights
Preserve dependency licenses/notices. Use owner-provided or approved portraits/media. Do not label generated/stylized portraits as authentic photographs. Review terms before redistribution or reuse.


## Open production-security acceptance — 2026-11-13

The presence of authentication, validation and security-control source code is not production acceptance. Before release, verify on the exact candidate and production-like environment:

- Admin authentication on every page, loader, action and API; direct URL/API bypass attempts; owner-only authorization and profile/resource scope.
- Session creation, secure cookie attributes, expiry, revocation, secret rotation and behavior when required secret/epoch configuration is absent or malformed.
- Shared/distributed login throttling across multiple instances; process-local throttling alone is insufficient.
- CSRF/same-origin enforcement, request-size limits, upload signature/content-type/size checks, canonical path handling and symlink/path traversal defenses.
- Public/private separation for drafts, resume originals, image originals, backups, audit records, AI context and all four profile IDs.
- Production JARVIS gateway authentication, HTTPS, timeouts, cancellation, safe error handling and explicit paid OpenAI fallback opt-in.
- Dependency vulnerability triage, SBOM review, signing-key custody and independent trust of release signatures/digests.

Record test evidence, environment and exact commit SHA. Do not run security scans or production probes while the owner-directed validation pause remains active.


## Verification evidence — 2026-11-14

Automated, local, against in-memory storage models: all 45 admin API routes and 8 admin pages reject unauthenticated callers with a private 404 plus the full security header set; encoded, mixed-case, dot-segment and null-byte paths do not bypass the boundary; forged, truncated, expired, revoked (logout-all epoch) and secret-rotated sessions are rejected; missing or weak secrets, absent storage and malformed epoch storage fail closed; the development bypass is ignored unless explicitly in a development environment; every mutating route refuses missing, foreign, null and cross-site origins even with a valid session; login cookies are HttpOnly, SameSite=Strict, Secure on HTTPS with a bounded Max-Age; the shared throttle blocks across isolates and fails closed. Findings fixed are listed in PROJECT_STATUS.md. Not performed: penetration testing, production configuration review, dependency review of dev-only advisories (10 moderate remain), signing-key custody review.
