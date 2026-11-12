import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminNavigation } from "@/components/AdminNavigation";
import { Bot, History, RotateCcw, Save, Send, EyeOff } from "lucide-react";
import {
  buildPersonaPrompt,
  PERSONA_LIMITS,
  type PersonaConfig,
  type PersonaDocument,
  type PersonaProfileId,
} from "@/lib/persona";

export const Route = createFileRoute("/admin/personas")({
  head: () => ({
    meta: [
      { title: "Private AI Persona Manager" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: PersonaManager,
});

const PROFILES: ReadonlyArray<{ id: PersonaProfileId; label: string }> = [
  { id: "abhishek", label: "Abhishek" },
  { id: "ammu", label: "Amulya (Ammu)" },
  { id: "bava", label: "Anjini Kumar (Bava)" },
  { id: "sai", label: "Sai (Darling)" },
];

const EMPTY: PersonaConfig = { displayName: "", tone: "", instructions: "", knowledgeNotes: "" };

function PersonaManager() {
  const [profileId, setProfileId] = useState<PersonaProfileId>("abhishek");
  const [doc, setDoc] = useState<PersonaDocument | null>(null);
  const [form, setForm] = useState<PersonaConfig>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const applyDocument = useCallback((next: PersonaDocument) => {
    setDoc(next);
    const published = next.history.find((entry) => entry.version === next.publishedVersion);
    const source = next.draft ?? published?.config ?? EMPTY;
    setForm({
      displayName: source.displayName,
      tone: source.tone,
      instructions: source.instructions,
      knowledgeNotes: source.knowledgeNotes,
    });
  }, []);

  const load = useCallback(
    async (id: PersonaProfileId) => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/personas?profileId=${encodeURIComponent(id)}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as {
          persona?: PersonaDocument;
          error?: string;
        } | null;
        if (!response.ok || !payload?.persona) throw new Error(payload?.error ?? "Could not load.");
        applyDocument(payload.persona);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not load the persona.");
      } finally {
        setBusy(false);
      }
    },
    [applyDocument],
  );

  useEffect(() => {
    setMessage("");
    void load(profileId);
  }, [load, profileId]);

  async function act(action: "draft" | "publish" | "rollback" | "unpublish", extra = {}) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/personas/${action}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId, ...extra }),
      });
      const payload = (await response.json().catch(() => null)) as {
        persona?: PersonaDocument;
        error?: string;
      } | null;
      if (!response.ok || !payload?.persona) throw new Error(payload?.error ?? "Request failed.");
      applyDocument(payload.persona);
      setMessage(
        action === "draft"
          ? "Draft saved privately. Publish it to use it in the assistant."
          : action === "publish"
            ? "Published. The assistant now uses this persona for this profile."
            : action === "rollback"
              ? "Earlier version restored as a new published version."
              : "Unpublished. The assistant uses the default persona for this profile.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  const update = (key: keyof PersonaConfig) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const label = PROFILES.find((item) => item.id === profileId)?.label ?? profileId;
  const history = [...(doc?.history ?? [])].reverse();

  return (
    <main className="site-container max-w-5xl py-10 sm:py-14">
      <AdminNavigation current="/admin/personas" />
      <p className="font-mono text-xs text-primary">CONTENT WORKFLOW · PRIVATE</p>
      <h1 className="mt-3 flex items-center gap-3 text-4xl font-semibold">
        <Bot className="size-8 text-primary" aria-hidden="true" /> AI Persona Manager
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        Configure how each profile&apos;s assistant introduces itself and answers. Personas shape
        tone and emphasis only — they can never override the platform&apos;s factual-grounding,
        privacy and security rules, and each profile&apos;s persona is used only for that profile.
      </p>

      <label className="mt-8 block max-w-xs text-sm">
        Profile
        <select
          value={profileId}
          onChange={(event) => setProfileId(event.target.value as PersonaProfileId)}
          className="mt-2 block min-h-11 w-full rounded border border-border bg-background px-3"
        >
          {PROFILES.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.label}
            </option>
          ))}
        </select>
      </label>

      <p className="mt-4 text-sm text-muted-foreground" role="status">
        {doc?.publishedVersion
          ? `Published: version ${doc.publishedVersion}.`
          : "Not published — the assistant uses the default persona."}
        {doc?.draft
          ? ` Unpublished draft saved ${new Date(doc.draft.updatedAt).toLocaleString()}.`
          : ""}
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded border border-red-300/30 p-3 text-sm text-red-200">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-4 rounded border border-emerald-300/30 p-3 text-sm">
          {message}
        </p>
      )}

      <form
        className="mt-6 grid gap-5 rounded-lg border border-border bg-card p-5 sm:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          void act("draft", { config: form });
        }}
      >
        <Field
          label="Assistant name"
          value={form.displayName}
          max={PERSONA_LIMITS.displayName}
          onChange={update("displayName")}
          required
        />
        <Field
          label="Tone and response style"
          value={form.tone}
          max={PERSONA_LIMITS.tone}
          onChange={update("tone")}
        />
        <Field
          label="Style guidance"
          value={form.instructions}
          max={PERSONA_LIMITS.instructions}
          onChange={update("instructions")}
          multiline
        />
        <Field
          label="Additional approved facts"
          value={form.knowledgeNotes}
          max={PERSONA_LIMITS.knowledgeNotes}
          onChange={update("knowledgeNotes")}
          multiline
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy || !form.displayName.trim()}
            className="inline-flex min-h-11 items-center gap-2 rounded border border-border px-4 disabled:opacity-50"
          >
            <Save className="size-4" aria-hidden="true" /> Save draft
          </button>
          <button
            type="button"
            disabled={busy || !doc?.draft}
            onClick={() => {
              if (window.confirm(`Publish the saved draft for ${label}?`)) void act("publish");
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-primary-foreground disabled:opacity-50"
          >
            <Send className="size-4" aria-hidden="true" /> Publish draft
          </button>
          <button
            type="button"
            disabled={busy || !doc?.publishedVersion}
            onClick={() => {
              if (window.confirm(`Unpublish ${label}'s persona?`)) void act("unpublish");
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded border border-border px-4 disabled:opacity-50"
          >
            <EyeOff className="size-4" aria-hidden="true" /> Unpublish
          </button>
        </div>
      </form>

      <section className="mt-8" aria-labelledby="persona-preview">
        <h2 id="persona-preview" className="text-xl font-semibold">
          Preview (what is added below the platform rules)
        </h2>
        <pre className="mt-3 whitespace-pre-wrap rounded border border-border bg-black/30 p-4 text-xs leading-6">
          {form.displayName.trim()
            ? buildPersonaPrompt(form)
            : "Enter an assistant name to preview the persona."}
        </pre>
      </section>

      <section className="mt-8" aria-labelledby="persona-history">
        <h2 id="persona-history" className="flex items-center gap-2 text-xl font-semibold">
          <History className="size-5" aria-hidden="true" /> Version history (append-only)
        </h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No published versions yet.</p>
        ) : (
          <ol className="mt-3 grid gap-2">
            {history.map((entry) => (
              <li
                key={entry.version}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    Version {entry.version} · {entry.config.displayName}
                    {entry.kind === "rollback" && entry.restoredVersion
                      ? ` (restored version ${entry.restoredVersion})`
                      : ""}
                    {entry.version === doc?.publishedVersion && (
                      <span className="ml-2 rounded border border-emerald-300/30 px-2 py-0.5 text-xs">
                        Current
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.publishedAt).toLocaleString()}
                  </p>
                </div>
                {entry.version !== doc?.publishedVersion && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Restore version ${entry.version} for ${label}?`)) {
                        void act("rollback", { version: entry.version });
                      }
                    }}
                    className="inline-flex min-h-10 items-center gap-2 rounded border border-amber-300/30 px-3 text-sm disabled:opacity-50"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" /> Restore
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  max,
  onChange,
  multiline = false,
  required = false,
}: {
  label: string;
  value: string;
  max: number;
  onChange: (value: string) => void;
  multiline?: boolean;
  required?: boolean;
}) {
  const className = "mt-2 w-full rounded border border-border bg-background p-3 text-sm";
  return (
    <label className="block text-sm">
      {label}
      {multiline ? (
        <textarea
          value={value}
          maxLength={max}
          rows={5}
          onChange={(event) => onChange(event.target.value)}
          className={className}
        />
      ) : (
        <input
          value={value}
          maxLength={max}
          required={required}
          onChange={(event) => onChange(event.target.value)}
          className={`${className} min-h-11`}
        />
      )}
      <span className="mt-1 block text-xs text-muted-foreground">
        {value.length}/{max}
      </span>
    </label>
  );
}
