# Security Requirements

## Authentication and authorization
- Every Admin page, loader, action and API requires server-side authentication/authorization.
- Unauthorized requests cannot read/mutate Admin records or private files.
- Mutations enforce same-origin/CSRF protections; sessions use secure HttpOnly cookies, strict same-site behavior and bounded lifetime.
- Production cannot use development auth bypasses.
- Enforce strong passwords/signing secrets; missing or malformed session epoch storage fails closed.
- Apply no-store, noindex, nosniff, no-referrer, restrictive Permissions-Policy, same-origin opener isolation, frame denial and an HTTPS-only HSTS policy to every admin page/API response.
- The current failed-login throttle is process-local; it is not distributed protection. Add and verify a platform-backed shared limiter before production exposure, and retain production secret rotation/configuration and production-like session acceptance as release requirements.

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
