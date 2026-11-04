# On-site change detection

This utility compares a customer-side directory with an approved release baseline. It is read-only: it never modifies scanned files, restores content, or deploys packages.

## Workflow

1. Create the baseline from a trusted, verified release directory.
2. Transfer the baseline JSON through an authenticated channel and keep it read-only.
3. Scan the customer/on-site directory to create a fresh snapshot.
4. Compare the baseline and snapshot to produce a JSON change report.

## Commands

```sh
node scripts/on-site-change-detection.mjs baseline ./released ./baseline.json [./change-detection-ignore.json]
node scripts/on-site-change-detection.mjs scan ./customer-install ./snapshot.json [./change-detection-ignore.json]
node scripts/on-site-change-detection.mjs compare ./baseline.json ./snapshot.json ./change-report.json
```

The compare command exits with status 0 when no changes are detected, 2 when differences are found, and 1 for an execution/validation failure. Exit 64 indicates incorrect command usage.

## Ignore policy

Optional JSON file:

```json
{
  "schemaVersion": 1,
  "paths": ["logs", "runtime/cache", "customer-overrides/local.json"]
}
```

Entries are exact relative paths; a directory entry excludes its descendants. Wildcards are intentionally unsupported to avoid ambiguous matching. Keep the ignore policy under change control and use the same policy for baseline and on-site scans.

## Classification

- **unchanged** — path, size, and SHA-256 match.
- **modified** — path exists in both locations but size or SHA-256 differs.
- **missing** — path exists in the baseline but not in the on-site snapshot.
- **unexpected** — path exists on-site but not in the baseline.

Symlinks, special files, unreadable paths, and incomplete scans fail closed. A failed scan does not write a snapshot, preventing partial results from being mistaken for a clean environment.

## Operational safeguards

- Run with the least-privileged account that can read the target directory; do not run as administrator/root by default.
- Capture the baseline only after release-manifest and package verification succeeds.
- Protect the baseline and ignore policy with access controls and independent integrity checks.
- Reports contain file paths and hashes; review before sharing with customers.
- This first version compares file contents only. Hardware and storage inventory are deliberately out of scope.
