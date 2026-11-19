# ASAA Branching and Promotion Policy

**Effective:** 2026-11-14  
**Applies to:** ASAA, Portfolio, JARVIS and Templates

## Protected branches

- `main` is the production/release branch and must remain protected.
- `dev` is the integration branch and must remain protected.
- Do not push direct changes to either protected branch.
- Do not open routine work pull requests directly against `dev` or `main`.

## Standard work branches

- `new`: default target for all new work and pull requests.
- `fix`: isolated defect correction work.
- `test`: test and verification work.
- `dev`: protected integration branch; changes arrive only through an approved promotion PR.
- `main`: protected production/release branch; changes arrive only through an approved promotion PR from the authorized integration path.

## Required flow

1. Create or update work on an appropriate working branch.
2. Open the work PR with **base = `new`**.
3. Review and validate the change on `new`.
4. Promote `new` to `dev) only through an explicit, reviewed promotion PR and required checks.
5. Promote `dev` to `main` only through an explicit, reviewed release PR and required checks.
6. Never bypass required reviews, checks, or branch protections.

## Protection requirements

Configure GitHub branch protection/rulesets for both `dev` and `main`: require pull requests, required reviews, required status checks, up-to-date branches where appropriate, restrict force pushes and deletion, and prevent bypass except explicitly authorized administrators.

**Configuration status:** this document records the required policy. Actual GitHub protection settings must be inspected and verified separately; this document alone does not prove that protections are enabled.

## Scope and approval

This policy governs repository change routing. Approval of the ASAA Master Requirements Baseline v1.0 is for planning/governance and does not itself authorize implementation, testing, deployment, paid services, merging or release.
