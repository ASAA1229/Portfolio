import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LockKeyhole, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Private Admin Access" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Sign-in methods offered by the server (SSO is optional; the password form is the default).
  const [methods, setMethods] = useState({ sso: false, password: true });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("sso") === "failed") {
      setError(
        "SSO sign-in was not completed. Check your authenticator code and role, then retry.",
      );
    }
    fetch("/api/admin/login/options", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((options: { sso?: boolean; password?: boolean } | null) => {
        if (options)
          setMethods({ sso: options.sso === true, password: options.password !== false });
      })
      .catch(() => undefined);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Unable to sign in.");
        return;
      }
      window.location.assign("/admin/resumes");
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-login-backdrop flex min-h-screen items-center justify-center bg-[#09090d] px-4 py-12 text-white">
      <div className="admin-login-card w-full max-w-md border border-white/10 bg-white/[0.03] p-7 shadow-2xl sm:p-9">
        <div className="mb-8 flex size-12 items-center justify-center border border-violet-400/30 bg-violet-400/10 text-violet-200">
          <LockKeyhole className="size-5" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-violet-300">
          Restricted workspace
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Private admin access</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          Sign in to manage private resume records. This area is not linked from the public
          portfolio.
        </p>
        {methods.sso && (
          <a
            href="/api/admin/sso/start"
            className="mt-8 flex min-h-12 w-full items-center justify-center gap-2 bg-violet-300 px-4 text-sm font-semibold text-black transition hover:bg-violet-200"
          >
            <ShieldCheck className="size-4" /> Sign in with ASAA SSO
          </a>
        )}
        {methods.sso && !methods.password && error && (
          <p role="alert" className="mt-4 text-sm text-red-300">
            {error}
          </p>
        )}
        {methods.password && (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <label htmlFor="admin-password" className="block text-xs font-medium text-white/75">
              Admin password
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-12 w-full border border-white/15 bg-black/30 px-4 text-sm outline-none transition focus:border-violet-300"
              placeholder="Enter your admin password"
            />
            {error && (
              <p role="alert" className="text-sm text-red-300">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || Array.from(password).length < 12}
              className="flex min-h-12 w-full items-center justify-center gap-2 bg-violet-300 px-4 text-sm font-semibold text-black transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShieldCheck className="size-4" /> {busy ? "Verifying…" : "Authenticate"}
            </button>
          </form>
        )}
        <p className="mt-6 border-t border-white/10 pt-5 text-[11px] leading-5 text-white/65">
          Minimum 12-character password · eight-hour signed session · HttpOnly cookie · server-side
          authorization
        </p>
      </div>
    </section>
  );
}
