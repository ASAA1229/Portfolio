import { describe, expect, it } from "vitest";
import { inspectResourceLifecycle } from "@/lib/resource-lifecycle";

const base = {
  resumes: [{ id: "resume-1", status: "approved" as const, profileId: "abhishek" }],
  resumeFeedIds: ["resume-1"],
  resumePrivateFileIds: ["resume-1"],
  images: [{ id: "image-1", status: "approved" as const }],
  imagePrivateFileIds: ["image-1"],
  imagePublicFileIds: ["image-1"],
  supersededImageKeys: [
    "private-admin/images/superseded/image-1/1234567890123-ab12cd34",
    "private-admin/images/superseded/image-1/1234567890123-ab12cd34.json",
  ],
};

describe("resource lifecycle inspection (PORT-US-051)", () => {
  it("reports a complete published resource lifecycle as healthy", () => {
    expect(inspectResourceLifecycle(base)).toMatchObject({
      healthy: true,
      summary: { resumes: 1, publishedResumes: 1, images: 1, publishedImages: 1, findings: 0 },
    });
  });

  it("detects missing originals, missing public copies and feed drift", () => {
    const report = inspectResourceLifecycle({
      ...base,
      resumeFeedIds: [],
      resumePrivateFileIds: [],
      imagePrivateFileIds: [],
      imagePublicFileIds: [],
    });
    expect(report.findings.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "RESUME_ORIGINAL_MISSING",
        "RESUME_PUBLIC_FEED_OUT_OF_SYNC",
        "IMAGE_ORIGINAL_MISSING",
        "IMAGE_PUBLIC_COPY_MISSING",
      ]),
    );
    expect(report.healthy).toBe(false);
  });

  it("identifies orphaned and stale files without proposing destructive mutations", () => {
    const report = inspectResourceLifecycle({
      ...base,
      images: [{ id: "image-1", status: "pending" }],
      imagePublicFileIds: ["image-1", "orphan-public"],
      imagePrivateFileIds: ["image-1", "orphan-private"],
      resumePrivateFileIds: ["resume-1", "orphan-resume"],
    });
    expect(report.findings.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "RESUME_FILE_ORPHANED",
        "IMAGE_ORIGINAL_ORPHANED",
        "IMAGE_PUBLIC_COPY_STALE",
        "IMAGE_PUBLIC_COPY_ORPHANED",
      ]),
    );
  });

  it("flags incomplete immutable image-version pairs", () => {
    const report = inspectResourceLifecycle({
      ...base,
      supersededImageKeys: ["private-admin/images/superseded/image-1/1234567890123-ab12cd34"],
    });
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "IMAGE_VERSION_PAIR_INCOMPLETE",
        resource: "image-version",
      }),
    );
  });

  it("treats an unreadable public resume feed as an integrity error", () => {
    const report = inspectResourceLifecycle({ ...base, resumeFeedIds: null });
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "RESUME_PUBLIC_FEED_INVALID",
        severity: "error",
      }),
    );
  });
});
