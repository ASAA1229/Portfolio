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


---

## Discovery expansion — Sets 7–12 (2026-11-19)

The questionnaire phase is closed at Set 12. The user selected “all of the above” for every question in Sets 1–12. These selections are **candidate requirements for reconciliation**, not evidence of implementation, a committed delivery promise, or a change to Master Requirements Baseline v1.0.

New cross-cutting candidate requirement domains to map into the existing epic hierarchy:
- Shared architecture, bounded project ownership, API/event contracts, service identities, common directory, configuration and secrets, notifications, documents, search, workflow, audit, observability, reporting and shared AI services.
- Data architecture, domain ownership, master/reference data, validation, synchronization, consistency, privacy, classification, retention/deletion, import/export, migration, lineage, analytics, offline handling and AI data governance.
- Security governance, identity/authentication/authorization, privileged access, application/API/network/device/repository security, secure SDLC, supply-chain controls, encryption, monitoring, vulnerability/incident response, third-party controls and AI/JARVIS safeguards.
- CI/CD, build/test automation, artifact provenance, environment promotion, IaC, deployment strategies, rollback, infrastructure/platform cost controls, multi-platform support and pipeline observability.
- Quality engineering across requirements, acceptance criteria, unit/integration/API/UI/E2E/regression/performance/security/accessibility/compatibility/mobile/desktop/data/AI testing, test data, defects, release gates and UAT.

Reconciliation rules:
1. Preserve all existing epic IDs, evidence, status distinctions and repository-specific architecture.
2. Map applicable candidate requirements to Project → Epic → Sub-epic → Feature → User Story → Tasks → Acceptance Criteria → Dependencies → Status → Evidence.
3. Do not mark a capability implemented, tested, integrated, accepted or released from questionnaire selections alone.
4. Keep PLANNED / NOT ASSESSED / IMPLEMENTED-NEEDS-TESTING / TESTED / INTEGRATED / ACCEPTED / RELEASED distinctions explicit.
5. The approved Master Requirements Baseline v1.0 remains unchanged; any new baseline requires separate approval.
6. Planning/documentation only. No code, tests, deployment, merge, paid service, production change or release is authorized by this update.


Project epic coverage: PORT-E01–E09. Apply the candidate domains as cross-cutting sub-epics/features where applicable; do not create duplicate epics or change existing development/testing/integration/acceptance values without new evidence.
