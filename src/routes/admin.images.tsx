import { useEffect, useState, type ChangeEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminNavigation } from "@/components/AdminNavigation";
import { ImagePlus, RefreshCw, ShieldCheck, Trash2, UploadCloud } from "lucide-react";

type ImageRecord = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  status: "pending" | "approved";
  profileId: "abhishek" | "ammu" | "bava" | "sai";
  alt: string;
  slot?: "gallery" | "portrait";
};
type ImageListPayload = {
  images?: ImageRecord[];
  error?: string;
  storageMode?: "local-disk" | "persistent";
};

const profiles = [
  { id: "abhishek", label: "Abhishek" },
  { id: "ammu", label: "Amulya" },
  { id: "bava", label: "Anjini Kumar" },
  { id: "sai", label: "Sai" },
] as const;

export const Route = createFileRoute("/admin/images")({
  head: () => ({
    meta: [
      { title: "Private Portfolio Image Manager" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: ImageManager,
});

async function readApiResponse<T extends { error?: string; detail?: string }>(
  response: Response,
): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    throw new Error(
      [payload?.error, payload?.detail].filter(Boolean).join(" — ") ||
        `Image service request failed (HTTP ${response.status}).`,
    );
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("The image service returned an invalid response.");
  }
  return payload;
}

function ImageManager() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [activeImageIds, setActiveImageIds] = useState<Set<string>>(() => new Set());
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [profileId, setProfileId] = useState<ImageRecord["profileId"]>("abhishek");
  const [alt, setAlt] = useState("");
  const [slot, setSlot] = useState<"gallery" | "portrait">("gallery");
  const [publishOnUpload, setPublishOnUpload] = useState(false);
  // Bumped after a replacement so preview thumbnails refetch the new file.
  const [previewVersion, setPreviewVersion] = useState(0);
  const [storageMode, setStorageMode] = useState<"local-disk" | "persistent" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileFilter, setProfileFilter] = useState<"all" | ImageRecord["profileId"]>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ImageRecord["status"]>("all");
  const visibleImages = images.filter((image) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery = !query || [image.filename, image.alt, image.profileId, image.slot ?? "gallery"].some((value) => value.toLowerCase().includes(query));
    return matchesQuery && (profileFilter === "all" || image.profileId === profileFilter) && (statusFilter === "all" || image.status === statusFilter);
  });

  async function loadImages(signal?: AbortSignal) {
    const response = await fetch("/api/admin/images", {
      credentials: "same-origin",
      cache: "no-store",
      signal: signal ?? null,
    });
    const payload = await readApiResponse<ImageListPayload>(response);
    const nextImages = Array.isArray(payload.images) ? payload.images : [];
    setImages(nextImages);
    setStorageMode(payload.storageMode ?? "persistent");

    // Mirror the public feed's selection rules so Admin can distinguish approved
    // resources from resources currently selected by public profile components.
    try {
      const publicResponse = await fetch("/api/published-images", {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: signal ?? null,
      });
      const publicPayload = publicResponse.ok
        ? (await publicResponse.json()) as { images?: Array<{ id?: string; profileId?: string; slot?: string }> }
        : null;
      const publicImages = Array.isArray(publicPayload?.images) ? publicPayload.images : [];
      const selected = new Set<string>();
      const latestPortraitByProfile = new Map<string, string>();
      for (const image of publicImages) {
        if (typeof image.id !== "string" || typeof image.profileId !== "string") continue;
        if (image.slot === "portrait") latestPortraitByProfile.set(image.profileId, image.id);
        else if (image.slot === "gallery") selected.add(image.id);
      }
      for (const id of latestPortraitByProfile.values()) selected.add(id);
      setActiveImageIds(selected);
    } catch {
      // Keep the inventory usable; an unavailable public feed is not proof
      // that a private approved image is currently live.
      if (!signal?.aborted) setActiveImageIds(new Set());
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadImages(controller.signal)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Could not load image manager.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => controller.abort();
  }, []);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  async function refreshImages() {
    setBusy(true);
    setError("");
    try {
      await loadImages();
      setMessage("Image list refreshed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not refresh images.");
    } finally {
      setBusy(false);
    }
  }

  async function upload() {
    setError("");
    setMessage("");
    if (!file) {
      setError("Choose an image first.");
      return;
    }
    if (!alt.trim()) {
      setError("Add descriptive alt text before uploading.");
      return;
    }
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
      setError("Image must be between 1 byte and 10 MB.");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("profileId", profileId);
      form.set("alt", alt.trim());
      form.set("slot", slot);
      form.set("publishOnUpload", String(publishOnUpload));

      const response = await fetch("/api/admin/images", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      await readApiResponse<{ error?: string; image?: ImageRecord }>(response);
      await loadImages();
      setFile(null);
      setAlt("");
      setSlot("gallery");
      setPublishOnUpload(false);
      setMessage(
        publishOnUpload
          ? "Image uploaded and published to the selected profile."
          : "Image uploaded privately as pending review. Publish it when ready.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function action(id: string, operation: "publish" | "unpublish" | "delete") {
    if (
      operation === "delete" &&
      !window.confirm("Delete this image from private and public storage?")
    )
      return;
    if (
      operation === "unpublish" &&
      !window.confirm("Remove this image from public galleries but keep the private original?")
    )
      return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/admin/images/${id}${operation === "publish" || operation === "unpublish" ? `/${operation}` : ""}`,
        {
          method: operation === "delete" ? "DELETE" : "POST",
          credentials: "same-origin",
        },
      );
      await readApiResponse<{ error?: string }>(response);
      await loadImages();
      setMessage(
        operation === "publish"
          ? "Image published to the selected profile."
          : operation === "unpublish"
            ? "Image removed from public galleries; the private original is retained."
            : "Image deleted.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update image.");
    } finally {
      setBusy(false);
    }
  }

  async function replaceImage(id: string, replacement: File | undefined) {
    if (!replacement) return;
    if (!window.confirm(`Replace this image's file with "${replacement.name}"?`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.set("file", replacement);
      const response = await fetch(`/api/admin/images/${id}/replace`, {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      await readApiResponse<{ error?: string }>(response);
      await loadImages();
      setPreviewVersion((value) => value + 1);
      setMessage("Image file replaced. The previous file is kept privately until cleanup.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not replace image.");
    } finally {
      setBusy(false);
    }
  }

  async function cleanupStorage() {
    if (!window.confirm("Permanently delete superseded and orphaned image files?")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/images/cleanup", {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = await readApiResponse<{ error?: string; removed?: number }>(response);
      setMessage(`Cleanup removed ${payload.removed ?? 0} unused file(s).`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Cleanup failed.");
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return <main className="site-container py-16">Checking private image manager…</main>;
  }

  return (
    <main className="site-container max-w-5xl py-10 sm:py-14">
      <AdminNavigation current="/admin/images" />
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-primary">CONTENT WORKFLOW · PRIVATE</p>
          <h1 className="mt-3 text-4xl font-semibold">Portfolio Image Manager</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Upload image updates without changing source code. Images can be reviewed before
            publication, unpublished without deleting the private original, or removed when no
            longer needed.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded border border-border px-4 disabled:opacity-50"
          disabled={busy}
          onClick={() => void refreshImages()}
        >
          <RefreshCw className="size-4" /> Refresh
        </button>
      </header>

      {storageMode === "local-disk" && (
        <p role="status" className="mb-5 rounded border border-border p-4 text-sm">
          Local development storage is active. Uploads are saved on this computer in the
          project&apos;s <code>.local-storage/</code> folder and survive dev-server restarts. The
          deployed site uses the Cloudflare R2 RESUME_BUCKET instead.
        </p>
      )}

      <section className="mb-10 rounded-lg border border-border bg-card p-5 sm:p-7">
        <h2 className="flex items-center gap-2 text-2xl">
          <ImagePlus className="size-5" /> Upload image
        </h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2 [&>*]:min-w-0 [&_input]:min-w-0 [&_select]:min-w-0">
          <label className="grid gap-2 text-sm">
            Profile
            <select
              className="min-h-11 rounded border border-border bg-background px-3"
              value={profileId}
              onChange={(event) => setProfileId(event.target.value as ImageRecord["profileId"])}
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Placement
            <select
              className="min-h-11 rounded border border-border bg-background px-3"
              value={slot}
              onChange={(event) => setSlot(event.target.value as "gallery" | "portrait")}
            >
              <option value="gallery">Gallery photo</option>
              <option value="portrait">Main profile portrait</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Image file (JPEG, PNG, WebP or AVIF; max 10 MB)
            <input
              className="min-h-11 rounded border border-border p-2"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif"
              onChange={selectFile}
            />
            {file && (
              <span className="text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024).toFixed(1)} KB
              </span>
            )}
          </label>
          <label className="grid gap-2 text-sm md:col-span-2">
            Alternative text
            <input
              className="min-h-11 rounded border border-border bg-background px-3"
              maxLength={300}
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
              placeholder="Describe the image for screen-reader users"
            />
          </label>
          <label className="flex items-start gap-3 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={publishOnUpload}
              onChange={(event) => setPublishOnUpload(event.target.checked)}
              className="mt-1 size-4 accent-primary"
            />
            <span>
              <span className="font-medium">Publish immediately after upload</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                The image becomes public on the selected profile as soon as the upload succeeds.
                Leave unchecked to review first.
              </span>
            </span>
          </label>
        </div>
        <button
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50"
          disabled={busy}
          onClick={() => void upload()}
        >
          <UploadCloud className="size-4" />{" "}
          {publishOnUpload ? "Upload & publish" : "Upload privately"}
        </button>
      </section>

      {error && (
        <p role="alert" className="mb-5 rounded border border-destructive p-4 text-sm">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mb-5 rounded border border-border p-4 text-sm">
          {message}
        </p>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px_190px]">
        <label className="text-xs text-muted-foreground">Search images
          <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Filename, alt text, profile…" className="mt-2 min-h-11 w-full rounded border border-border bg-background px-3 text-sm text-foreground" />
        </label>
        <label className="text-xs text-muted-foreground">Profile
          <select value={profileFilter} onChange={(event) => setProfileFilter(event.target.value as typeof profileFilter)} className="mt-2 min-h-11 w-full rounded border border-border bg-background px-3 text-sm text-foreground">
            <option value="all">All profiles</option>
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Publication status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="mt-2 min-h-11 w-full rounded border border-border bg-background px-3 text-sm text-foreground">
            <option value="all">All statuses</option><option value="pending">Pending review</option><option value="approved">Published</option>
          </select>
        </label>
      </div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl">Uploaded images</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Showing {visibleImages.length} of {images.length}</span>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded border border-border px-3 text-sm disabled:opacity-50"
            disabled={busy}
            onClick={() => void cleanupStorage()}
          >
            <Trash2 className="size-4" /> Clean up unused files
          </button>
        </div>
      </div>

      {images.length === 0 ? (
        <p className="rounded border border-border p-8 text-sm text-muted-foreground">
          No images uploaded yet.
        </p>
      ) : visibleImages.length === 0 ? (
        <p className="rounded border border-border p-8 text-sm text-muted-foreground">
          No images match these filters. Change the search, profile or publication status.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleImages.map((image) => (
            <article key={image.id} className="rounded-lg border border-border bg-card p-4">
              <img
                src={`/api/admin/images/${image.id}/file?v=${previewVersion}`}
                alt={image.alt || `Preview of ${image.filename}`}
                loading="lazy"
                className="mb-3 aspect-[4/3] w-full rounded border border-border object-cover"
                onError={(event) => {
                  // Missing private file: hide the broken thumbnail instead of showing an icon.
                  event.currentTarget.hidden = true;
                }}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words font-semibold">{image.filename}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {profiles.find((item) => item.id === image.profileId)?.label} ·{" "}
                    {image.slot === "portrait" ? "Main portrait" : "Gallery"} ·{" "}
                    {(image.size / 1024).toFixed(1)} KB
                  </p>
                  <p className="mt-2 text-sm">{image.alt}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded border border-border px-2 py-1 text-xs">
                    {image.status === "approved" ? "Published" : "Pending review"}
                  </span>
                  {image.status === "approved" && (
                    <span className={`rounded border px-2 py-1 text-[11px] ${activeImageIds.has(image.id) ? "border-emerald-400/40 text-emerald-300" : "border-amber-400/40 text-amber-200"}`}>
                      {activeImageIds.has(image.id) ? "Live on profile" : "Published · not selected"}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {image.status !== "approved" && (
                  <button
                    className="inline-flex min-h-10 items-center gap-2 rounded bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void action(image.id, "publish")}
                  >
                    <ShieldCheck className="size-4" /> Publish
                  </button>
                )}
                {image.status === "approved" && (
                  <button
                    className="inline-flex min-h-10 items-center gap-2 rounded border border-border px-3 text-sm disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void action(image.id, "unpublish")}
                  >
                    Unpublish / rollback
                  </button>
                )}
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded border border-border px-3 text-sm disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void action(image.id, "delete")}
                >
                  <Trash2 className="size-4" /> Delete
                </button>
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded border border-border px-3 text-sm">
                  <UploadCloud className="size-4" aria-hidden="true" /> Replace file
                  <input
                    type="file"
                    className="sr-only"
                    disabled={busy}
                    accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif"
                    onChange={(event) => {
                      const replacement = event.target.files?.[0];
                      event.target.value = "";
                      void replaceImage(image.id, replacement);
                    }}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs leading-6 text-muted-foreground">
        Publishing makes the image publicly retrievable through an approved-image endpoint. Do not
        upload confidential images or images you do not have permission to publish.
      </p>
    </main>
  );
}
