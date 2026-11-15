# Portfolio — Testing and QA Strategy

Current status: [PROJECT_STATUS.md](PROJECT_STATUS.md) · Release gate: [RELEASE_READINESS.md](RELEASE_READINESS.md)

## Test architecture (2026-11-14)

- Vitest 4 with jsdom (default) or node (per-file `// @vitest-environment node`), configured in vitest.config.ts with a 30 s test timeout for filesystem-heavy suites (the image/resume lifecycle tests still hit timeouts intermittently; see Known limits).
- `npm test` runs Vitest and the Node test runner for scripts/on-site-change-detection.test.mjs.
- 42 Vitest files and 4 Node tests; 472 Vitest tests passed and 1 was skipped on the coordinator's best run (2026-11-14). The suite is FLAKY: 2 of 4 reruns had timeouts in the image/resume lifecycle tests, a fix is in progress and is not yet verified.
- Playwright (`npm run test:e2e`, config in playwright.config.ts, specs in e2e/): 17/17 passed locally against the production build served under Node with in-memory storage. admin.spec.ts covers Admin login, throttle, CSRF, edit/publish/public view, image upload, backup and logout-everywhere; accessibility.spec.ts has 8 checks for keyboard, zoom, reflow and target size. A CI `e2e` job exists in .github/workflows/artifact-integrity.yml and has not been observed to run.
- src/test/miniflare-r2.test.ts runs storage, limiter and Admin flows against Miniflare's R2 emulator (11 tests passed). The in-memory R2 model (src/test/helpers/memory-r2.ts) replaced the local disk bucket in the resource lifecycle suites (commit 62803ad).
- src/test/helpers/memory-r2.ts models the documented Cloudflare R2 behaviours (etags, `onlyIf` conditional puts, paged listing) with failure injection and forced interleaving. It models the API; it is not evidence about the hosted service.
- Suites added or extended in this initiative: storage-r2-contract (failure injection at every operation, crashed-isolate recovery, multi-isolate lease, backup/restore round trip and rollback), login-limiter, admin-security-matrix (every admin route and page, encoded paths, sessions, CSRF, distributed throttle), cms-profile-matrix (four-profile lifecycle, field groups, concurrency), chat-gateway-contract (Worker plus route, four-profile isolation, timeout, cancellation), seo-http (published-only sitemap, 404 statuses), a11y-pages (axe over all public routes, three profiles and Admin).
- Coverage tooling (@vitest/coverage-v8) is installed but no threshold is configured.
- Real-browser checks: `npm run check:browser -- <url>` (scripts/browser-audit.mjs, now measuring INP with web-vitals) and `npm run check:budget`; authenticated Admin journeys are covered by the Playwright suite above.

## Latest local evidence (branch new, 2026-11-14)

| Check | Result |
|---|---|
| npm ci | PASS |
| Typecheck | PASS, 0 diagnostics (baseline 15) |
| ESLint | PASS, 0 problems (baseline 637) |
| Vitest | 42 files, 472 passed, 1 skipped on the best run; FLAKY (timeouts in 2 of 4 reruns; baseline 185 passed, 40 failed) |
| Playwright E2E | PASS, 17 of 17 (Admin journeys and 8 accessibility checks) |
| Miniflare R2 emulator suite | PASS, 11 tests (inside Vitest) |
| Node tests | PASS, 4 of 4 |
| Production build | PASS |
| Bundle budget | PASS, client JS 314.2 KB gzip, CSS 25.1 KB gzip |
| npm audit --audit-level=high | PASS, 0 high; production dependencies 0 advisories |
| Artifact manifest and customer verifier | PASS, 208 files (simulated provenance variables; coordinator rerun; was 198 before e2e/ was added) |
| Real-browser audit | 34 loads (17 pages x mobile and desktop): 0 axe violations including contrast; worst CLS 0.005 (fonts self-hosted; was 0.128); INP measured and OVER the 200 ms target (216 ms last full run, up to 344 ms earlier), not met on every run |
| GitHub Actions / Jenkins | Not observed for these commits (`gh` is unauthenticated; nothing is CI VERIFIED) |
| Documentation-owner rerun, 2026-11-14 (head c91bd10) | `npm run typecheck` exit 0; `npm run lint` exit 0; Vitest and E2E not rerun by the documentation owner (a code agent was editing tests in the same tree) |

Run `npm run verify` to repeat the first block (package-manager guard, typecheck, lint, test, build, budget). The browser audit needs a locally served build: `NITRO_PRESET=node-server npm run build`, then `PORT=4173 node .output/server/index.mjs`, then `npm run check:browser -- http://localhost:4173 report.json` (uses an installed Chrome or Edge via BROWSER_CHANNEL; downloads nothing).

Known limits: jsdom cannot evaluate contrast, reflow or focus visibility (covered only by the browser audit script and the Playwright accessibility checks); the R2 model proves application logic, not hosted R2 consistency; no screen-reader or physical-device testing was performed.

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
npm run check:budget
npm run audit:deps
npm run check:pm
npm run verify
```

Do not claim a command passed without exact output and candidate SHA. CI runs automatically on pushes to new; concurrency may cancel close-spaced runs. Cancelled is not passed.

## Defect priorities

P0: security, data loss/corruption, authorization bypass, critical workflow failure or typecheck/build blocker.  
P1: broken workflows, integration/reliability, accessibility, performance or CI/artifact defects.  
P2: non-blocking enhancements and future scope.

Each failure record must include SHA, command/workflow, environment, exact error, affected story, remediation commit and rerun evidence.


## Update 2026-11-15

Commit d36d9f6 changes the suites to survive load (concurrent sweeps, cheaper axe, worker cap). Not yet verified by a repeated clean run; the flaky-test fix proof and INP measurement are in progress. Verification reruns are deferred to the test phase.
