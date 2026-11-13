# Portfolio — Testing and QA Strategy

Current status: [PROJECT_STATUS.md](PROJECT_STATUS.md) · Release gate: [RELEASE_READINESS.md](RELEASE_READINESS.md)

## Test architecture observed

- Vitest + jsdom configured in vitest.config.ts.
- Test files use src/**/*.test.ts and src/**/*.test.tsx.
- npm test runs Vitest and Node's built-in test runner for scripts/on-site-change-detection.test.mjs.
- 34 test files are present on new.
- @vitest/coverage-v8 is installed, but package scripts define no coverage command or threshold.
- No dedicated Playwright/Cypress browser E2E dependency or script is configured in package.json.
- Existing tests cover authentication, CMS, AI provider, routing, SEO, image/resume failure paths, resource lifecycle, backup and storage recovery.

## Latest exact-head CI evidence

[Latest run #43420111801](https://github.com/ASAA1229/Portfolio/actions/runs/43420111801), candidate `b30436b3a8f4595b7d9780b849867c353f328b53`:

| Check | Result |
|---|---|
| npm ci | PASS |
| CycloneDX SBOM | PASS |
| Production build | PASS |
| Typecheck | FAIL — 15 diagnostics / 5 files |
| ESLint | SKIPPED |
| Vitest + Node tests | SKIPPED |
| Artifact verification | SKIPPED |
| Artifact upload | SKIPPED |

Previous baseline run #617 had 89 diagnostics across 10 files. The latest candidate has reduced the reported errors to 15 across 5 files, but still fails. Remaining error groups: Admin route literals (`/admin/` vs `/admin`), backup test mock shape, backup `StorageMutation` content type, and `RecoveryBucket.get` mock return type (repeated call-site incompatibilities). Lint, unit/integration tests and artifact verification remain skipped. No successful exact-head full pipeline is evidenced.

## Required test layers

- **Unit:** validators, mappings, fallback, profile scoping, serialization, crypto helpers and state transitions; positive, negative and boundary cases.
- **Integration:** storage adapter contracts, transaction journal, compensation, backup/restore, CMS publication and resource lifecycle.
- **API/security:** every Admin endpoint unauthenticated, expired/invalid session, cross-origin and valid owner session; direct URL/API bypass, private file access, upload constraints, path traversal and rate limits.
- **UI/component:** Admin navigation, editing, preview, publish, resource upload/recovery, loading/empty/error/offline states, keyboard and accessible names.
- **Browser E2E:** use an approved browser automation layer if compatible with current tooling and cost constraints; cover all four public profiles and Admin workflows with isolated test storage and non-production credentials.
- **Security/accessibility/performance:** dependency/SBOM triage; WCAG 2.2 AA automated plus manual review; record LCP, INP, CLS, bundle/image payloads and representative device/network conditions.

## Commands

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run audit:images
```

Do not claim a command passed without exact output and candidate SHA. CI runs automatically on pushes to new; concurrency may cancel close-spaced runs. Cancelled is not passed.

## Defect priorities

P0: security, data loss/corruption, authorization bypass, critical workflow failure or typecheck/build blocker.  
P1: broken workflows, integration/reliability, accessibility, performance or CI/artifact defects.  
P2: non-blocking enhancements and future scope.

Each failure record must include SHA, command/workflow, environment, exact error, affected story, remediation commit and rerun evidence.
