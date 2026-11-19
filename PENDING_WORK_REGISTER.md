# Portfolio Pending Work and Epic Reconciliation Register

**Updated:** 2026-11-19  
**Branch:** `new`  
**Scope:** documentation and planning only  
**Baseline:** ASAA Master Requirements Baseline v1.0 remains unchanged.

## Status interpretation

- **Existing evidence-backed work:** preserve the state in the current epic/status register.
- **Pending verification:** implementation may exist, but the required test, CI, integration, device, owner or release evidence is incomplete.
- **Candidate requirement:** selected during Sets 1–12; requires applicability, decomposition, ownership and acceptance criteria before it becomes an approved backlog commitment.
- **Not assessed:** no reliable evidence has been recorded; do not infer completion.

## Carried-forward project-specific pending work

Stabilize and independently rerun the flaky test suite; obtain exact-head CI evidence; complete hosted R2 verification for resume/media workflows; verify real AI gateway/JARVIS integration or explicitly defer it; resolve INP target overrun; complete factual review of all four profiles and static/dynamic content reconciliation; complete publishing matrix, owner acceptance and release authorization.

## Cross-cutting reconciliation work

- Reconcile all answers from Sets 1–12 with the approved baseline and existing project requirements.
- Map relevant architecture, shared services, APIs/events, identity, configuration, secrets, notifications, documents, search, workflows, audit, monitoring, analytics and AI requirements.
- Map data ownership, data models, integrity, synchronization, privacy, retention, deletion, migration, backup, recovery, lineage and offline requirements.
- Map security governance, threat modelling, access controls, secure development, supply-chain controls, vulnerability management, incident response and AI safety requirements.
- Map CI/CD, build and artifact provenance, automated testing, deployment, infrastructure, rollback, resilience, cost controls and operational monitoring.
- Map functional, non-functional, accessibility, compatibility, performance, security, regression, end-to-end, AI and user-acceptance testing.
- Identify duplicates, conflicts, missing requirements, external dependencies, risks and assumptions.
- Assign owners and dependencies; define measurable acceptance criteria and evidence links.
- Reconcile the epic register, status register, project scope, user stories, roadmap and tracker so they do not contradict one another.

## Governance and authorization

The answers “all of the above” represent candidate requirements, not proof that features exist or authorization to implement them. Do not change implementation status without repository/runtime/test evidence. Do not modify application code, run tests, deploy, merge, purchase services or release as part of this documentation update. Any new master baseline or implementation phase requires separate approval.

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

