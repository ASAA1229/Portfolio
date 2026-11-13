# Development Guide

## Prerequisites and setup
Use Node.js 24 (or the exact package manifest version), npm and Git.

```sh
git clone https://github.com/ASAA1229/Portfolio.git
cd Portfolio
git switch new
npm ci
cp .env.example .env.local
npm run dev
```
PowerShell equivalent: `Copy-Item .env.example .env.local`. Do not commit real environment files.

## Branch and contribution rules
- Authorized working branch: `new`.
- Do not merge to `dev`/`main`, deploy, publish or release without explicit owner approval.
- Do not rewrite pushed history; this repository is connected to Lovable and commits may sync into the editor.
- Keep changes scoped; preserve architecture unless a requirement justifies change.
- Update consolidated docs when requirements, architecture, setup or operations change.

## Routing
TanStack Start uses file-based routes in `src/routes`; `src/routes/__root.tsx` is the sole root shell. Do not create Next.js/Remix route directories. `src/routeTree.gen.ts` is generated and must not be edited manually.

## Environment
- `JARVIS_AI_URL`, `JARVIS_AI_KEY`: server-side JARVIS gateway.
- `PORTFOLIO_AI_ALLOW_PAID_FALLBACK=true` and `OPENAI_API_KEY`: only with explicit owner opt-in.
- `VITE_SITE_URL`: canonical site origin where configured.
- Storage and Admin secrets belong in ignored local env or hosting secret manager, never client variables.

## Engineering checks
Use package.json scripts as the source of truth for typecheck, lint, tests, build and asset audit. Validate exact candidate SHA and record command, environment, result and output when validation is authorized.

## Current execution baseline — 2026-11-13
- Work only on branch `new`; source-code baseline before documentation updates: `14f94a194c6bfcba9ed3f5e5dd1e036b8d82ebc6`.
- Documentation/story maintenance is authorized. Keep changes scoped to the Portfolio objective and preserve the current architecture.
- Do not merge to `dev`/`main`, deploy, publish artifacts, enable Nexus or change production resources without separate explicit approval.

## Validation authorization
The owner has authorized validation as part of the ASAA Project Maturity Improvement & Gap Closure initiative on branch `new`. Run appropriate local and CI checks against the exact candidate, record results and fix regressions. This does **not** authorize production probing, provisioning, deployment, Nexus publication, branch protection changes or release. Current status: [PROJECT_STATUS.md](PROJECT_STATUS.md); QA evidence: [TESTING.md](TESTING.md).

## Implementation principles
Keep profile data typed and scoped; use shared schemas; expose only published public-safe data; protect private binaries; provide deliberate loading/empty/error states; maintain keyboard/focus/semantic/reduced-motion behavior; derive SEO from published content; avoid unnecessary runtime external dependencies.
