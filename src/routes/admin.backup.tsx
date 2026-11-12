import { useEffect, useState, type ChangeEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminNavigation } from "@/components/AdminNavigation";
import { DatabaseBackup, Download, Upload } from "lucide-react";
import { MAX_BACKUP_BYTES, validateBackup } from "@/lib/admin-backup";

export const Route = createFileRoute("/admin/backup")({
  head: () => ({
    meta: [
      { title: "Private Portfolio Backup" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: BackupManager,
});

function BackupManager() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{
    name: string;
    backup: unknown;
    documents: number;
    files: number;
    missingFiles: number;
  } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [adapters, setAdapters] = useState<string[]>([]);
  const [migrateConfirm, setMigrateConfirm] = useState("");
  const [direction, setDirection] = useState<"local-disk:r2" | "r2:local-disk">("local-disk:r2");
  const [recovery, setRecovery] = useState<{
    pending: boolean;
    state: string | null;
    createdAt: string | null;
    affectedObjects: number;
  } | null>(null);
  const [recoveryConfirm, setRecoveryConfirm] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/storage", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { available?: string[] } | null) => setAdapters(payload?.available ?? []))
      .catch(() => setAdapters([]));
    fetch("/api/admin/storage/recovery", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: typeof recovery) => setRecovery(payload))
      .catch(() => setRecovery(null));
    return () => controller.abort();
  }, []);

  async function refreshRecovery() {
    const response = await fetch("/api/admin/storage/recovery", {
      credentials: "same-origin",
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as typeof recovery;
    if (!response.ok || !payload) throw new Error("Could not read storage recovery status.");
    setRecovery(payload);
  }

  async function recoverStorage() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/storage/recovery", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: recoveryConfirm }),
      });
      const payload = (await response.json().catch(() => null)) as {
        recovered?: boolean;
        state?: string | null;
        pending?: boolean;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Storage recovery failed.");
      setMessage(payload?.pending
        ? "Recovery ran, but a journal is still pending. Do not repeat affected edits; inspect storage and retry recovery."
        : payload?.state === "preparing"
          ? "An incomplete journal was cleared. Target objects had not entered the write phase."
          : payload?.state === "committed"
            ? "The operation was already committed. Stale recovery snapshots were cleaned without reverting it."
            : payload?.recovered
              ? "Pending storage changes were restored to their pre-operation state."
              : "No pending storage recovery was required.");
      setRecoveryConfirm("");
      await refreshRecovery();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Storage recovery failed.");
      await refreshRecovery().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function migrate() {
    const [from, to] = direction.split(":");
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/storage/migrate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from, to, confirm: migrateConfirm }),
      });
      const payload = (await response.json().catch(() => null)) as {
        documents?: number;
        files?: number;
        missingFiles?: string[];
        error?: string;
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Migration failed.");
      setMessage(
        `Copied ${payload?.documents ?? 0} documents and ${payload?.files ?? 0} files from ${from} to ${to}.` +
          (payload?.missingFiles?.length
            ? ` ${payload.missingFiles.length} referenced files were missing in the source.`
            : ""),
      );
      setMigrateConfirm("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Migration failed.");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/backup", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Backup export failed.");
      }
      const backup = (await response.json()) as {
        exportedAt: string;
        entries: Record<string, unknown>;
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `portfolio-admin-backup-${backup.exportedAt.slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      setMessage(
        `Exported ${Object.keys(backup.entries).length} documents. Store the file securely: it contains drafts.`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Backup export failed.");
    } finally {
      setBusy(false);
    }
  }

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    setMessage("");
    setPending(null);
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setError("Backup files are limited to 95 MB.");
      return;
    }
    try {
      const backup = JSON.parse(await file.text()) as unknown;
      // Validate in the browser first; the server validates again before writing.
      const validated = await validateBackup(backup);
      if (!validated.ok) throw new Error(validated.errors.join(" "));
      setPending({
        name: file.name,
        backup,
        documents: validated.entries.length,
        files: validated.files.length,
        missingFiles: validated.missingFiles.length,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That file is not a valid backup.");
    }
  }

  async function restore() {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/backup/restore", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: confirmText, backup: pending.backup }),
      });
      const payload = (await response.json().catch(() => null)) as {
        restored?: string[];
        files?: number;
        missingFiles?: string[];
        error?: string;
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Restore failed.");
      const missing = payload?.missingFiles?.length ?? 0;
      setMessage(
        `Restored ${payload?.restored?.length ?? 0} items (${payload?.files ?? 0} files) from ${pending.name}.` +
          (missing ? ` ${missing} referenced files were not in the backup.` : ""),
      );
      setPending(null);
      setConfirmText("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Restore failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="site-container max-w-3xl py-10 sm:py-14">
      <AdminNavigation current="/admin/backup" />
      <p className="font-mono text-xs text-primary">CONTENT WORKFLOW · PRIVATE</p>
      <h1 className="mt-3 flex items-center gap-3 text-4xl font-semibold">
        <DatabaseBackup className="size-8" aria-hidden="true" /> Backup &amp; restore
      </h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        Export content, personas, resume metadata, publish histories, the image index, the admin
        audit log and the resume and image files themselves (with SHA-256 checks) as one JSON file,
        or restore from a previous export. A failed restore is rolled back completely.
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded border border-red-400/40 p-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-4 rounded border border-border p-3 text-sm">
          {message}
        </p>
      )}

      <section className="mt-8 rounded-lg border border-border bg-card p-5">
        <h2 className="text-2xl">Export</h2>
        <button
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded border border-border px-4"
          disabled={busy}
          onClick={() => void download()}
        >
          <Download className="size-4" aria-hidden="true" /> Download backup
        </button>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <h2 className="text-2xl">Storage recovery</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Multi-object writes keep a private recovery journal before changing stored objects.
          If a provider failure prevents automatic rollback, this action replays the saved snapshots.
        </p>
        {recovery ? (
          <div className="mt-3 space-y-2 text-sm">
            <p>
              {recovery.pending
                ? `Pending journal: ${recovery.state ?? "unknown"} · ${recovery.affectedObjects} affected objects`
                : "No pending recovery journal."}
            </p>
            {recovery.createdAt && <p className="text-muted-foreground">Started: {recovery.createdAt}</p>}
            {recovery.pending && (
              <>
                <label className="block max-w-xs">
                  Type RECOVER to restore the pre-operation state
                  <input
                    className="mt-1 w-full rounded border border-border bg-background p-2"
                    value={recoveryConfirm}
                    onChange={(event) => setRecoveryConfirm(event.target.value)}
                    aria-label="Type RECOVER to confirm storage recovery"
                  />
                </label>
                <button
                  className="inline-flex min-h-11 items-center rounded border border-border px-4 disabled:opacity-50"
                  disabled={busy || recoveryConfirm !== "RECOVER"}
                  onClick={() => void recoverStorage()}
                >
                  Recover pending storage operation
                </button>
              </>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Storage recovery status is unavailable.</p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <h2 className="text-2xl">Restore</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Restoring replaces the matching documents with the versions in the file.
        </p>
        <input
          className="mt-4 block text-sm"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void choose(event)}
          disabled={busy}
        />
        {pending && (
          <div className="mt-4 space-y-3 text-sm">
            <p>
              {pending.name}: {pending.documents} valid documents and {pending.files} verified files
              {pending.missingFiles ? ` (${pending.missingFiles} referenced files missing)` : ""}.
              Type <strong>RESTORE</strong> to confirm.
            </p>
            <input
              className="w-full max-w-xs rounded border border-border bg-background p-2"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              aria-label="Type RESTORE to confirm"
            />
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-primary-foreground disabled:opacity-50"
              disabled={busy || confirmText !== "RESTORE"}
              onClick={() => void restore()}
            >
              <Upload className="size-4" aria-hidden="true" /> Restore backup
            </button>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <h2 className="text-2xl">Storage migration</h2>
        {adapters.length < 2 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Available storage here: {adapters.length ? adapters.join(", ") : "none"}. Migration
            needs both the local disk store and the R2 bucket in the same runtime; otherwise move
            data by downloading a backup here and restoring it in the other environment.
          </p>
        ) : (
          <div className="mt-3 space-y-3 text-sm">
            <label className="block">
              Direction
              <select
                className="mt-1 block min-h-11 rounded border border-border bg-background px-3"
                value={direction}
                onChange={(event) => setDirection(event.target.value as typeof direction)}
              >
                <option value="local-disk:r2">Local disk → R2</option>
                <option value="r2:local-disk">R2 → Local disk</option>
              </select>
            </label>
            <input
              className="w-full max-w-xs rounded border border-border bg-background p-2"
              value={migrateConfirm}
              onChange={(event) => setMigrateConfirm(event.target.value)}
              aria-label="Type MIGRATE to confirm"
              placeholder="Type MIGRATE"
            />
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded border border-border px-4 disabled:opacity-50"
              disabled={busy || migrateConfirm !== "MIGRATE"}
              onClick={() => void migrate()}
            >
              Copy admin data
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
