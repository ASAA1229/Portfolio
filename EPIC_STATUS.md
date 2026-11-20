# Portfolio Epic Status Register

**Updated:** 2026-11-19 | **Branch:** `new`  
**Source of truth:** this register for epic-level status; detailed evidence remains in the repository's project status and CI records.

| Epic | Workstream | Development | Testing | Integration | Acceptance / release | Pending focus |
|---|---|---|---|---|---|---|
| PORT-E01 | Build stability and engineering foundation | Implemented locally | Local results recorded; flaky proof and exact-head CI remain | CI configured; latest run unobserved in this record | Not accepted | Stabilize/re-run tests and verify exact SHA |
| PORT-E02 | Four profiles and content architecture | Implemented | Local four-profile lifecycle matrix recorded | Profile isolation tested locally | Not accepted | Owner factual review and content reconciliation |
| PORT-E03 | Cinematic UI, navigation and responsive behavior | Implemented | Local axe/Playwright keyboard, zoom, reflow and target-size evidence recorded | Local only | Not accepted | Cross-device/browser acceptance and final review |
| PORT-E04 | Profile content and career sections | Implemented | Person-field coverage test recorded | Static/dynamic reconciliation pending | Not accepted | Confirm all profile facts and content completeness |
| PORT-E05 | Resume manager and document processing | Partial | Local lifecycle tests on R2 model/Miniflare | Hosted R2 not tested | Not accepted | Hosted storage integration and acceptance |
| PORT-E06 | Image/media manager and galleries | Partial | Local lifecycle tests on R2 model/Miniflare | Hosted R2 not tested | Not accepted | Hosted storage integration and acceptance |
| PORT-E07 | AI intro, chat and voice | Partial | Gateway contract tests use stubbed gateway | Real JARVIS gateway untested | Not accepted | Provider/gateway verification or explicit deferral |
| PORT-E08 | Accessibility, security and performance | Source hardening | axe/security matrix recorded; INP exceeds 200 ms target | Proxy/storage integration pending | Not accepted | Resolve performance target and verify integrations |
| PORT-E09 | QA, publishing and release | Pending | Matrix incomplete | Not assessed | Not authorized | Complete UAT, publishing evidence and owner release approval |

## Status rules

- Existing local evidence is not CI, hosted integration, physical-device or owner-acceptance evidence.
- Do not promote an epic to complete from source presence or questionnaire selections.
- Sets 1–12 selections (“all of the above”) add candidate requirements to be mapped; they do not change the status cells above.
- See [PENDING_WORK_REGISTER.md](PENDING_WORK_REGISTER.md) for carried-forward and cross-project reconciliation work.
- The approved ASAA Master Requirements Baseline v1.0 remains unchanged. Documentation/planning only; no implementation, testing, deployment, merge, paid services or release is authorized.


## Evidence reconciliation — 2026-11-20

| Area | Current verified state | Remaining evidence |
|---|---|---|
| CI / artifact integrity on `new` | Passed, run 44727824158 | Re-run on exact candidate SHA |
| Verify Portfolio / artifact integrity on `dev` | Failures observed in runs 44589114817, 44585802361 and 44585802292 | Diagnose and rerun current head |
| Profile pages and profile switching | Implementation exists | Full route, data, responsive and device acceptance |
| Admin uploads | Implementation exists | Security, authorization, file validation and storage tests |
| AI intro/chat | Implementation exists/planned integration | End-to-end runtime and API-key security verification |
| Deployment and operations | Not release-verified | Hosting, monitoring, backup/recovery and owner acceptance |
| Release acceptance | Not accepted; NO-GO | Close current CI, security, runtime and owner gates |

A green `new` workflow must not be generalized to `dev`, `main`, physical devices or production acceptance. See [Project Status](docs/PROJECT_STATUS.md) and [Pending Work](PENDING_WORK_REGISTER.md).
