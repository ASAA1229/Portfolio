# Portfolio Epic Register — 2026-11-14

| ID | Epic | Development | Testing | Integration | Acceptance/release |
|---|---|---|---|---|---|
| PORT-E01 | Build stability and engineering foundation | Implemented locally | typecheck 0, lint 0, build pass; Vitest 472 passed/1 skipped, flaky (fix proof in progress, d36d9f6 agent-pushed); Playwright 17/17; CI deferred to test phase | CI configured; run unobserved | Not accepted |
| PORT-E02 | Four profiles/content architecture | Implemented | Four-profile CMS lifecycle matrix passes locally | Profile isolation tests local | Not accepted |
| PORT-E03 | Cinematic UI/navigation/responsive | Implemented | axe and Playwright keyboard/zoom/reflow/target-size pass locally | Local only | Not accepted |
| PORT-E04 | Profile content/career sections | Implemented (all person fields CMS-managed) | PERSON_FIELD_COVERAGE test passes; owner factual review pending | Static/dynamic reconcile pending | Not accepted |
| PORT-E05 | Resume manager/document processing | Partial | Lifecycle suites pass on in-memory R2 model and Miniflare (11 tests); hosted R2 not tested | Private/public boundary tested locally | Not accepted |
| PORT-E06 | Image/media manager/galleries | Partial | Image lifecycle suites pass on R2 model and Miniflare; hosted R2 not tested | Gallery integration tested locally | Not accepted |
| PORT-E07 | AI intro/chat/voice | Partial | 29 gateway contract tests with stubbed gateway | Real JARVIS gateway untested | Not accepted |
| PORT-E08 | Accessibility/security/performance | Source hardening | axe 0 violations; 104-case security matrix; CLS 0.005; INP 216-344 ms is OVER the 200 ms target | Proxy/storage pending | Not accepted |
| PORT-E09 | QA/publishing/release | Pending | Matrix incomplete | Not assessed | Not authorized |

Historical roadmap states testing was paused during a development-only period. Do not silently treat source changes as tested or accepted.

**Reconciled 2026-11-14 (documentation owner):** development, testing, integration and acceptance columns updated to the verified evidence in PROJECT_STATUS.md. Local evidence is not CI evidence (no GitHub Actions run observed; `gh` unauthenticated) and nothing here is CI VERIFIED.

**Reconciled 2026-11-15 (documentation owner):** development, testing, integration and acceptance columns updated to the verified evidence in PROJECT_STATUS.md. Local evidence is not CI evidence (no GitHub Actions run observed; `gh` unauthenticated) and nothing here is CI VERIFIED.
