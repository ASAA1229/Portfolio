# Release rejection, quarantine and recovery (PORT-E08)

## Purpose

This procedure records an operator's decision to reject a release and the evidence for a proposed recovery target. It is deliberately separate from CI promotion, deployment and artifact publication.

**Safety boundary:** these commands do not move or delete artifacts, change Git branches, deploy, promote, publish to Nexus, or roll back a running environment. A recovery record is evidence for a human-approved manual action, not an execution command.

## Release evidence index

Create an index from the six release files after the normal build and customer-verification steps have produced them:

```sh
node scripts/release-index.mjs \
  portfolio-build.tar.gz \
  portfolio-manifest.json \
  portfolio-build.tar.gz.sha256 \
  portfolio-dependencies.cdx.json \
  portfolio-manifest-ignore.json \
  portfolio-manifest-ignore.json.sha256 \
  release-index.json
```

The command records each file's basename, byte size and SHA-256 digest, plus the project/source/CI provenance from the manifest. It rejects mismatched artifact or policy checksum sidecars and refuses to overwrite an existing output file.

Keep the release index beside the exact evidence files it describes. Do not edit the index or replace files after indexing; regenerate a new index for a changed evidence set.

## Reject and quarantine a release

After preserving the release evidence, an operator can create a quarantine record:

```sh
node scripts/release-disposition.mjs quarantine \
  release-index.json \
  ./release-evidence \
  "Explain the rejection and the observed evidence" \
  "operator-id" \
  ./release-dispositions
```

The release root must contain the six files named by the index. Before writing a record, the command verifies:
- release index schema and required evidence descriptors;
- each evidence file is a regular, non-symlink file with the indexed size and SHA-256;
- manifest project/source/CI provenance matches the index;
- manifest artifact metadata matches the packaged artifact;
- artifact and manifest-ignore policy checksum sidecars match their files;
- any supplied release identity agrees with the manifest provenance.

A successful command creates a new JSON record exclusively (it will not overwrite an existing path) with event `QUARANTINED`, operator, reason, release identity, evidence fingerprints and explicit false controls for promotion, deployment and Nexus publication. The record states `artifactMoved: false`: the evidence remains in place and must be retained under the team's controlled storage procedure.

A failed validation exits non-zero and does not create a quarantine record. Records are protected with owner-only file permissions on supported systems, but are not cryptographically signed or tamper-proof; preserve them in controlled, access-restricted storage and retain their hashes.

## Record a recovery candidate

Select a previously verified, known-good release for the same project. Its release identity must differ from the quarantined release. Then record the proposed recovery:

```sh
node scripts/release-disposition.mjs recover \
  ./release-dispositions/<quarantine-record>.json \
  ./known-good/release-index.json \
  ./known-good/evidence \
  "Explain why this known-good release is the recovery candidate" \
  "operator-id" \
  ./release-dispositions
```

The command validates the quarantine record and re-verifies all six files in the known-good release. It then records the known-good artifact fingerprint and SHA-256 of the quarantine record. It does not execute rollback.

## Human approval and manual recovery

1. Preserve the rejected artifact, index, quarantine record and customer/CI failure report.
2. Investigate the recorded reason and determine whether the known-good release is appropriate for the affected environment.
3. Obtain explicit owner approval for the target release and the specific rollback action.
4. Follow the hosting/environment's documented manual rollback procedure and verify the resulting environment through the approved operational process.
5. Record the approval reference, operator, target release identity, execution time and outcome in the operational change record.
6. Keep production branch changes, deployment and Nexus publication as separate explicitly approved actions.

Do not infer approval from a quarantine or recovery record. Never automatically promote a known-good candidate or deploy it.

## Current implementation and verification status

- `scripts/release-index.mjs` creates the evidence index and validates checksum sidecars.
- `scripts/release-disposition.mjs` implements `quarantine` and `recover` record creation.
- These commands are operator-invoked; they are not wired into automatic promotion or deployment.
- Tests, builds, CI execution, Jenkins execution, production rollback and Nexus publication remain paused/not performed. Do not treat this implementation as runtime-verified or release-accepted until validation is explicitly resumed.
