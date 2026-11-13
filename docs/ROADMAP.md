# Portfolio — Roadmap and Epic Delivery Plan

Current status: [PROJECT_STATUS.md](PROJECT_STATUS.md) · Stories: [USER_STORIES.md](USER_STORIES.md) · Release: [RELEASE_READINESS.md](RELEASE_READINESS.md)

## Delivery principles
- Preserve functioning architecture and make the smallest safe change.
- Prioritize integrity, authorization and core functionality.
- A source change is not complete until tests and exact-candidate evidence pass.
- Work on new only; no unapproved merge, deployment, Nexus publication or release.
- Treat credentials, infrastructure and device access as explicit dependencies.

## Epic sequence

| Sequence | Epic | Priority | Stories / gaps | Dependencies | Exit criteria |
|---|---|---|---|---|---|
| E00 | Engineering baseline and CI recovery | P0 | GAP-001; PORT-US-052 | None | Strict typecheck, lint, tests and CI green |
| E01 | Storage integrity and recovery | P0 | PORT-US-045/051; GAP-002 | E00; isolated R2 | Failure, concurrency, backup and restore evidence |
| E02 | Admin security and privacy | P0 | PORT-US-046; GAP-003 | E00; shared limiter capability | Every Admin API protected; session and authorization acceptance |
| E03 | Complete CMS and resources | P0 | PORT-US-043/049/050; GAP-004/005 | E00–E02 | Four-profile content and resource workflows accepted |
| E04 | AI and SEO reliability | P1 | PORT-US-034/037/044; GAP-006/007 | E00–E03 | Profile-scoped AI and published-only SEO verified |
| E05 | Accessibility, compatibility and performance | P1 | PORT-US-053; GAP-008/009 | Stable UI | WCAG 2.2 AA and measured performance budgets |
| E06 | CI/CD, provenance and artifacts | P1 | PORT-US-054; GAP-010 | E00 | GitHub Actions and real Jenkins run pass; artifacts verified |
| E07 | Deployment, monitoring and DR | P1 | PORT-US-055; GAP-011/012 | E01, E02, E06; approved environment | Staging, backup/restore, monitoring and rollback rehearsal |
| E08 | Governance and documentation quality | P1/P2 | GAP-013–016 | Owner approval for governance changes | Controlled promotion, authoritative docs, asset rights |

## Incremental plan

1. Fix the 89 exact-head TypeScript diagnostics without weakening strict compiler settings; rerun typecheck, lint, tests and build.
2. Unify storage adapter/backup/recovery contracts; validate journal schema, idempotent recovery, compensation and concurrency.
3. Review every Admin page/loader/action/API and add shared throttling suitable for multi-instance deployment.
4. Build a complete four-profile field-to-admin matrix; validate content and image/resume lifecycle.
5. Validate JARVIS auth/privacy/timeout/cancellation/fallback and SEO/canonical/sitemap/404 behavior.
6. Complete WCAG 2.2 AA, device/screen-reader review and measured LCP/INP/CLS budgets.
7. Validate GitHub Actions and an actual Jenkins agent; verify SBOM, provenance, signature/policy, checksums and artifact read-back.
8. Validate approved staging deployment, monitoring, backup/restore and rollback.

Statuses are maintained only in PROJECT_STATUS.md and USER_STORIES.md. Historical implementation notes remain dated in REQUIREMENTS.md.
