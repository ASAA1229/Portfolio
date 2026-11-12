export type LifecycleFinding = {
  code:
    | "RESUME_ORIGINAL_MISSING"
    | "RESUME_FILE_ORPHANED"
    | "RESUME_PUBLIC_FEED_INVALID"
    | "RESUME_PUBLIC_FEED_OUT_OF_SYNC"
    | "IMAGE_ORIGINAL_MISSING"
    | "IMAGE_ORIGINAL_ORPHANED"
    | "IMAGE_PUBLIC_COPY_MISSING"
    | "IMAGE_PUBLIC_COPY_STALE"
    | "IMAGE_PUBLIC_COPY_ORPHANED"
    | "IMAGE_VERSION_PAIR_INCOMPLETE";
  resource: "resume" | "image" | "image-version";
  id: string;
  severity: "error" | "warning";
};

export interface ResourceLifecycleInput {
  resumes: { id: string; status: "pending" | "approved"; profileId?: string }[];
  resumeFeedIds: string[] | null;
  resumePrivateFileIds: string[];
  images: { id: string; status: "pending" | "approved" }[];
  imagePrivateFileIds: string[];
  imagePublicFileIds: string[];
  supersededImageKeys: string[];
}

export interface ResourceLifecycleReport {
  healthy: boolean;
  summary: {
    resumes: number;
    publishedResumes: number;
    images: number;
    publishedImages: number;
    findings: number;
    errors: number;
    warnings: number;
  };
  findings: LifecycleFinding[];
}

/** Compare storage objects with the authoritative private indexes without mutating data. */
export function inspectResourceLifecycle(input: ResourceLifecycleInput): ResourceLifecycleReport {
  const findings: LifecycleFinding[] = [];
  const add = (code: LifecycleFinding["code"], resource: LifecycleFinding["resource"], id: string, severity: LifecycleFinding["severity"] = "error") =>
    findings.push({ code, resource, id, severity });

  const resumeIds = new Set(input.resumes.map((item) => item.id));
  const publishedResumeIds = input.resumes
    .filter((item) => item.status === "approved" && !!item.profileId && item.profileId !== "unassigned")
    .map((item) => item.id)
    .sort();
  const resumeFiles = new Set(input.resumePrivateFileIds);
  for (const id of resumeIds) if (!resumeFiles.has(id)) add("RESUME_ORIGINAL_MISSING", "resume", id);
  for (const id of resumeFiles) if (!resumeIds.has(id)) add("RESUME_FILE_ORPHANED", "resume", id, "warning");
  if (input.resumeFeedIds === null) {
    add("RESUME_PUBLIC_FEED_INVALID", "resume", "approved-resumes.json");
  } else {
    const actual = [...input.resumeFeedIds].sort();
    if (
      actual.length !== publishedResumeIds.length ||
      actual.some((id, index) => id !== publishedResumeIds[index]) ||
      new Set(actual).size !== actual.length
    ) add("RESUME_PUBLIC_FEED_OUT_OF_SYNC", "resume", "approved-resumes.json");
  }

  const imageIds = new Set(input.images.map((item) => item.id));
  const approvedImageIds = new Set(input.images.filter((item) => item.status === "approved").map((item) => item.id));
  const privateImageIds = new Set(input.imagePrivateFileIds);
  const publicImageIds = new Set(input.imagePublicFileIds);
  for (const id of imageIds) {
    if (!privateImageIds.has(id)) add("IMAGE_ORIGINAL_MISSING", "image", id);
    if (approvedImageIds.has(id) && !publicImageIds.has(id)) add("IMAGE_PUBLIC_COPY_MISSING", "image", id);
    if (!approvedImageIds.has(id) && publicImageIds.has(id)) add("IMAGE_PUBLIC_COPY_STALE", "image", id);
  }
  for (const id of privateImageIds) if (!imageIds.has(id)) add("IMAGE_ORIGINAL_ORPHANED", "image", id, "warning");
  for (const id of publicImageIds) if (!approvedImageIds.has(id)) {
    add(imageIds.has(id) ? "IMAGE_PUBLIC_COPY_STALE" : "IMAGE_PUBLIC_COPY_ORPHANED", "image", id, "warning");
  }

  const versionKeys = new Set(input.supersededImageKeys);
  const versionIds = new Set(
    input.supersededImageKeys
      .map((key) => key.replace(/\.json$/, ""))
      .filter((key) => !key.endsWith(".json")),
  );
  for (const key of versionIds) {
    const hasBytes = versionKeys.has(key);
    const hasMetadata = versionKeys.has(`${key}.json`);
    if (hasBytes !== hasMetadata) add("IMAGE_VERSION_PAIR_INCOMPLETE", "image-version", key.split("/").at(-1) ?? key, "warning");
  }

  const errors = findings.filter((item) => item.severity === "error").length;
  const warnings = findings.length - errors;
  return {
    healthy: findings.length === 0,
    summary: {
      resumes: input.resumes.length,
      publishedResumes: publishedResumeIds.length,
      images: input.images.length,
      publishedImages: approvedImageIds.size,
      findings: findings.length,
      errors,
      warnings,
    },
    findings,
  };
}
