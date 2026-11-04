import { useEffect, useState, type ChangeEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ImagePlus, RefreshCw, ShieldCheck, Trash2, UploadCloud } from "lucide-react";

type ImageRecord = { id: string; filename: string; contentType: string; size: number; uploadedAt: string; status: "pending" | "approved"; profileId: "abhishek" | "ammu" | "bava" | "sai"; alt: string; slot?: "gallery" | "portrait" };
const profiles = [{ id: "abhishek", label: "Abhishek" }, { id: "ammu", label: "Amulya" }, { id: "bava", label: "Anjini Kumar" }, { id: "sai", label: "Sai" }] as const;

export const Route = createFileRoute("/admin/images")({
  head: () => ({ meta: [{ title: "Private Portfolio Image Manager" }, { name: "robots", content: "noindex, nofollow, noarchive" }] }),
  component: ImageManager,
});

function ImageManager() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [profileId, setProfileId] = useState<ImageRecord["profileId"]>("abhishek");
  const [alt, setAlt] = useState("");
  const [slot, setSlot] = useState<"gallery" | "portrait">("gallery");
  const [publishOnUpload, setPublishOnUpload] = useState(false);

  async function loadImages() {
    const response = await fetch("/api/admin/images", { credentials: "same-origin", cache: "no-store" });
    if (response.status === 404 || response.status === 401) throw new Error("Not authenticated");
    const payload = await response.json() as { images?: ImageRecord[]; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Could not load images.");
    setImages(payload.images ?? []);
  }
  useEffect(() => {
    let active = true;
    loadImages()
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load image manager."); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);
  function selectFile(event: ChangeEvent<HTMLInputElement>) { setFile(event.target.files?.[0] ?? null); }

  async function upload() {
    setError(""); setMessage("");
    if (!file) { setError("Choose an image first."); return; }
    if (!alt.trim()) { setError("Add descriptive alt text before uploading."); return; }
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) { setError("Image must be between 1 byte and 10 MB."); return; }
    setBusy(true);
    try { const form = new FormData(); form.set("file", file); form.set("profileId", profileId); form.set("alt", alt.trim()); form.set("slot", slot); form.set("publishOnUpload", String(publishOnUpload)); const response = await fetch("/api/admin/images", { method: "POST", body: form, credentials: "same-origin" }); const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error ?? "Upload failed."); await loadImages(); setFile(null); setAlt(""); setSlot("gallery"); setMessage(publishOnUpload ? "Image uploaded and published to the selected profile." : "Image uploaded privately as pending review. Publish it when ready."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Upload failed."); } finally { setBusy(false); }
  }
  async function action(id: string, operation: "publish" | "unpublish" | "delete") {
    if (operation === "delete" && !window.confirm("Delete this image from private and public storage?")) return;
    if (operation === "unpublish" && !window.confirm("Remove this image from public galleries but keep the private original?")) return;
    setBusy(true); setError(""); setMessage("");
    try { const response = await fetch(`/api/admin/images/${id}${operation === "publish" || operation === "unpublish" ? `/${operation}` : ""}`, { method: operation === "delete" ? "DELETE" : "POST", credentials: "same-origin" }); const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error ?? "Could not update image."); await loadImages(); setMessage(operation === "publish" ? "Image published to the selected profile." : operation === "unpublish" ? "Image removed from public galleries; the private original is retained." : "Image deleted."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update image."); } finally { setBusy(false); }
  }
  if (checking) return <main className="site-container py-16">Checking private image manager…</main>;
  return <main className="site-container max-w-5xl py-10 sm:py-14">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><p className="font-mono text-xs text-primary">CONTENT WORKFLOW · TEST MODE</p><h1 className="mt-3 text-4xl font-semibold">Portfolio Image Manager</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">Upload image updates without changing source code. This manager is directly accessible in the current testing configuration. Choose review-first or publish immediately; published images can be rolled back to private pending status.</p></div><button className="inline-flex min-h-11 items-center gap-2 rounded border border-border px-4" disabled={busy} onClick={() => void loadImages()}><RefreshCw className="size-4"/> Refresh</button></header>
    <section className="mb-10 rounded-lg border border-border bg-card p-5 sm:p-7"><h2 className="flex items-center gap-2 text-2xl"><ImagePlus className="size-5"/> Upload image</h2><div className="mt-6 grid gap-5 md:grid-cols-2">
      <label className="grid gap-2 text-sm">Profile<select className="min-h-11 rounded border border-border bg-background px-3" value={profileId} onChange={(event) => setProfileId(event.target.value as ImageRecord["profileId"])}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select></label>
      <label className="grid gap-2 text-sm">Placement<select className="min-h-11 rounded border border-border bg-background px-3" value={slot} onChange={(event) => setSlot(event.target.value as "gallery" | "portrait")}><option value="gallery">Gallery photo</option><option value="portrait">Main profile portrait</option></select></label>
      <label className="grid gap-2 text-sm">Image file (JPEG, PNG, WebP or AVIF; max 10 MB)<input className="min-h-11 rounded border border-border p-2" type="file" accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif" onChange={selectFile}/>{file && <span className="text-xs text-muted-foreground">{file.name} · {(file.size / 1024).toFixed(1)} KB</span>}</label>
      <label className="grid gap-2 text-sm md:col-span-2">Alternative text<input className="min-h-11 rounded border border-border bg-background px-3" maxLength={300} value={alt} onChange={(event) => setAlt(event.target.value)} placeholder="Describe the image for screen-reader users"/></label>
      <label className="flex items-start gap-3 text-sm md:col-span-2"><input type="checkbox" checked={publishOnUpload} onChange={(event) => setPublishOnUpload(event.target.checked)} className="mt-1 size-4 accent-primary"/><span><span className="font-medium">Publish immediately after upload</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">The image becomes public on the selected profile as soon as the upload succeeds. Leave unchecked to review first.</span></span></label>
    </div><button className="mt-5 inline-flex min-h-11 items-center gap-2 rounded bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50" disabled={busy} onClick={() => void upload()}><UploadCloud className="size-4"/> {publishOnUpload ? "Upload & publish" : "Upload privately"}</button></section>
    {error && <p role="alert" className="mb-5 rounded border border-destructive p-4 text-sm">{error}</p>}{message && <p role="status" className="mb-5 rounded border border-border p-4 text-sm">{message}</p>}
    <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl">Uploaded images</h2><span className="text-sm text-muted-foreground">{images.length} total</span></div>
    {images.length === 0 ? <p className="rounded border border-border p-8 text-sm text-muted-foreground">No images uploaded yet.</p> : <div className="grid gap-4 md:grid-cols-2">{images.map((image) => <article key={image.id} className="rounded-lg border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{image.filename}</h3><p className="mt-1 text-xs text-muted-foreground">{profiles.find((item) => item.id === image.profileId)?.label} · {image.slot === "portrait" ? "Main portrait" : "Gallery"} · {(image.size / 1024).toFixed(1)} KB</p><p className="mt-2 text-sm">{image.alt}</p></div><span className="shrink-0 rounded border border-border px-2 py-1 text-xs">{image.status === "approved" ? "Published" : "Pending"}</span></div><div className="mt-4 flex flex-wrap gap-2">{image.status !== "approved" && <button className="inline-flex min-h-10 items-center gap-2 rounded bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50" disabled={busy} onClick={() => void action(image.id, "publish")}><ShieldCheck className="size-4"/> Publish</button>}{image.status === "approved" && <button className="inline-flex min-h-10 items-center gap-2 rounded border border-border px-3 text-sm disabled:opacity-50" disabled={busy} onClick={() => void action(image.id, "unpublish")}>Unpublish / rollback</button>}<button className="inline-flex min-h-10 items-center gap-2 rounded border border-border px-3 text-sm disabled:opacity-50" disabled={busy} onClick={() => void action(image.id, "delete")}><Trash2 className="size-4"/> Delete</button></div></article>)}</div>}
    <p className="mt-8 text-xs leading-6 text-muted-foreground">Publishing makes the image publicly retrievable through an approved-image endpoint. Do not upload confidential images or images you do not have permission to publish.</p>
  </main>;
}