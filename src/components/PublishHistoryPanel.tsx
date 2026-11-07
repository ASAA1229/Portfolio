import { useCallback, useEffect, useState } from "react";
import { History, RotateCcw } from "lucide-react";

type ProfileId = "abhishek" | "ammu" | "bava" | "sai";

const PROFILES: ReadonlyArray<{ id: ProfileId; label: string }> = [
  { id: "abhishek", label: "Abhishek" },
  { id: "ammu", label: "Amulya" },
  { id: "bava", label: "Anjini Kumar" },
  { id: "sai", label: "Sai" },
];

interface HistoryEntry {
  resumeId: string;
  publishedAt: string;
  displayName: string;
  headline: string;
  kind: "publish" | "rollback";
  restoredPublishedAt?: string;
  resumeStillStored: boolean;
}

interface HistoryResponse {
  profileId: ProfileId;
  currentResumeId: string | null;
  /** publishedAt of the version the next rollback restores (server-computed). */
  rollbackTarget: string | null;
  entries: HistoryEntry[]; // newest first, append-only
  error?: string;
}

/**
 * Per-profile publish history with an explicit, confirmed rollback (PORT-US-013/036).
 * Snapshots contain only the public fields; private notes and originals never appear.
 */
export function PublishHistoryPanel({
  busy,
  refreshKey,
  onRolledBack,
}: {
  busy: boolean;
  /** Bump to reload after publishes/unpublishes elsewhere on the page. */
  refreshKey: number;
  onRolledBack: (message: string) => void | Promise<void>;
}) {
  const [profileId, setProfileId] = useState<ProfileId>("abhishek");
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (id: ProfileId) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/resumes/history?profileId=${encodeURIComponent(id)}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as HistoryResponse | null;
      if (!response.ok || !payload) throw new Error(payload?.error ?? "Could not load history.");
      setHistory(payload);
    } catch (reason) {
      setHistory(null);
      setError(reason instanceof Error ? reason.message : "Could not load history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(profileId);
  }, [load, profileId, refreshKey]);

  async function rollBack(entry: HistoryEntry) {
    const profile = PROFILES.find((item) => item.id === profileId)?.label ?? profileId;
    if (
      !window.confirm(
        `Roll ${profile}'s public resume back to the version published ${new Date(entry.publishedAt).toLocaleString()} ("${entry.displayName}")? The current version stays stored privately.`,
      )
    )
      return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/resumes/rollback", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Rollback failed.");
      await onRolledBack(
        `${profile}'s public resume was rolled back to the version published ${new Date(entry.publishedAt).toLocaleString()}.`,
      );
      await load(profileId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Rollback failed.");
      setLoading(false);
    }
  }

  const entries = history?.entries ?? [];
  // History is append-only; the rollback button sits on the newest publication
  // entry of the version the server would restore.
  const target = entries.findIndex(
    (entry) => entry.kind === "publish" && entry.publishedAt === history?.rollbackTarget,
  );

  return (
    <section
      className="mt-8 border border-white/10 bg-white/[0.025] p-5"
      aria-labelledby="publish-history-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            id="publish-history-heading"
            className="flex items-center gap-2 text-xl font-semibold"
          >
            <History className="size-5" aria-hidden="true" /> Publish history
          </h2>
          <p className="mt-1 text-sm text-white/45">
            Append-only: every publication and rollback is recorded and nothing is rewritten. Public
            pages and the AI assistant use only the current version.
          </p>
        </div>
        <label className="text-xs text-white/55">
          Profile
          <select
            value={profileId}
            onChange={(event) => setProfileId(event.target.value as ProfileId)}
            className="mt-2 block min-h-11 border border-white/15 bg-black/30 px-3 text-sm text-white"
          >
            {PROFILES.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 border border-red-300/25 bg-red-300/5 p-3 text-sm text-red-200"
        >
          {error}
        </p>
      )}
      {loading && !history ? (
        <p className="mt-4 text-sm text-white/45">Loading history…</p>
      ) : entries.length === 0 ? (
        <p className="mt-4 text-sm text-white/45">
          No resume has been published for this profile yet.
        </p>
      ) : (
        <ol className="mt-4 grid gap-2">
          {entries.map((entry, index) => {
            const isCurrent = index === 0 && entry.resumeId === history?.currentResumeId;
            return (
              <li
                key={`${entry.resumeId}-${entry.publishedAt}`}
                className="flex flex-wrap items-center justify-between gap-3 border border-white/10 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {entry.kind === "rollback" && (
                      <span className="mr-2 border border-amber-300/25 px-2 py-0.5 text-xs text-amber-100">
                        Rollback
                      </span>
                    )}
                    {entry.displayName || "Untitled"}
                    {isCurrent && (
                      <span className="ml-2 border border-emerald-300/25 px-2 py-0.5 text-xs text-emerald-200">
                        Current
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    {new Date(entry.publishedAt).toLocaleString()}
                    {entry.headline ? ` · ${entry.headline}` : ""}
                    {entry.kind === "rollback" && entry.restoredPublishedAt
                      ? ` · restored the version from ${new Date(entry.restoredPublishedAt).toLocaleString()}`
                      : ""}
                    {!entry.resumeStillStored && " · resume deleted — cannot be restored"}
                  </p>
                </div>
                {index === target && (
                  <button
                    type="button"
                    disabled={busy || loading || !entry.resumeStillStored}
                    onClick={() => void rollBack(entry)}
                    className="inline-flex min-h-10 items-center gap-2 border border-amber-300/30 px-3 text-sm text-amber-100 disabled:opacity-50"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" /> Roll back to this version
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
