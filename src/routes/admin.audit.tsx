import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminNavigation } from "@/components/AdminNavigation";
import { History, RefreshCw } from "lucide-react";
import type { AdminAuditEntry } from "@/lib/admin-audit";

// Owner-only audit history. The server enforces admin authorization for both
// this page and GET /api/admin/audit; entries contain ids and actions only.
export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Private Admin Audit History" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: AuditHistory,
});

function AuditHistory() {
  const [entries, setEntries] = useState<AdminAuditEntry[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | "success" | "rejected" | "failed">("all");
  const visibleEntries = (entries ?? []).filter((entry) => {
    const normalized = query.trim().toLowerCase();
    const matchesQuery = !normalized || [entry.action, entry.actor, entry.outcome, entry.targets.join(" "), String(entry.status)].some((value) => value.toLowerCase().includes(normalized));
    return matchesQuery && (outcomeFilter === "all" || entry.outcome === outcomeFilter);
  });

  async function load(signal?: AbortSignal) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/audit", {
        credentials: "same-origin",
        cache: "no-store",
        signal: signal ?? null,
      });
      const payload = (await response.json().catch(() => null)) as {
        entries?: AdminAuditEntry[];
        error?: string;
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Audit history could not be loaded.");
      setEntries(payload?.entries ?? []);
    } catch (reason) {
      if ((reason as Error).name !== "AbortError") {
        setError(reason instanceof Error ? reason.message : "Audit history could not be loaded.");
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);

  return (
    <main className="site-container max-w-5xl py-10 sm:py-14">
      <AdminNavigation current="/admin/audit" />
      <p className="font-mono text-xs text-primary">CONTENT WORKFLOW · PRIVATE</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <h1 className="flex items-center gap-3 text-4xl font-semibold">
          <History className="size-8" aria-hidden="true" /> Audit history
        </h1>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded border border-border px-4 disabled:opacity-50"
          disabled={busy}
          onClick={() => void load()}
        >
          <RefreshCw className="size-4" aria-hidden="true" /> Refresh
        </button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
        <label className="text-xs text-muted-foreground">Search activity
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Action, actor, target ID…" className="mt-2 min-h-11 w-full rounded border border-border bg-background px-3 text-sm text-foreground" />
        </label>
        <label className="text-xs text-muted-foreground">Outcome
          <select value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value as typeof outcomeFilter)} className="mt-2 min-h-11 w-full rounded border border-border bg-background px-3 text-sm text-foreground">
            <option value="all">All outcomes</option><option value="success">Success</option><option value="rejected">Rejected</option><option value="failed">Failed</option>
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Showing {visibleEntries.length} of {entries?.length ?? 0} loaded entries.</p>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        Newest first, up to 500 entries. Older entries are sealed into archives in private storage.
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded border border-red-400/40 p-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {entries && visibleEntries.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          No audit entries match the current filters.
        </p>
      )}
      {entries && entries.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Admin audit entries</caption>
            <thead className="bg-card">
              <tr>
                <th scope="col" className="p-3">
                  Time
                </th>
                <th scope="col" className="p-3">
                  Action
                </th>
                <th scope="col" className="p-3">
                  Targets
                </th>
                <th scope="col" className="p-3">
                  Actor
                </th>
                <th scope="col" className="p-3">
                  Outcome
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="whitespace-nowrap p-3">{new Date(entry.at).toLocaleString()}</td>
                  <td className="p-3 font-mono text-xs">{entry.action}</td>
                  <td className="break-all p-3 font-mono text-xs">
                    {entry.targets.join(", ") || "—"}
                  </td>
                  <td className="p-3">{entry.actor}</td>
                  <td className="p-3">
                    {entry.outcome} ({entry.status})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
