import { useState, type ChangeEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DatabaseBackup, Download, Upload } from "lucide-react";
import { validateBackup } from "@/lib/admin-backup";

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
  } | null>(null);
  const [confirmText, setConfirmText] = useState("");

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
    if (file.size > 2 * 1024 * 1024) {
      setError("Backup files are limited to 2 MB.");
      return;
    }
    try {
      const backup = JSON.parse(await file.text()) as unknown;
      // Validate in the browser first; the server validates again before writing.
      const validated = validateBackup(backup);
      if (!validated.ok) throw new Error(validated.errors.join(" "));
      setPending({ name: file.name, backup, documents: validated.entries.length });
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
        error?: string;
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Restore failed.");
      setMessage(`Restored ${payload?.restored?.length ?? 0} documents from ${pending.name}.`);
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
      <p className="font-mono text-xs text-primary">CONTENT WORKFLOW · PRIVATE</p>
      <h1 className="mt-3 flex items-center gap-3 text-4xl font-semibold">
        <DatabaseBackup className="size-8" aria-hidden="true" /> Backup &amp; restore
      </h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        Export content, personas, resume metadata, publish histories and the image index as one JSON
        file, or restore them from a previous export. Resume and image files themselves are not
        included and stay in private storage.
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
              {pending.name}: {pending.documents} valid documents. Type <strong>RESTORE</strong> to
              confirm.
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
    </main>
  );
}
