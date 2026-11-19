import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResumeAction } from "@/components/SitePrimitives";
import { getLocalResumeOptions } from "@/lib/local-resumes";

vi.mock("@/lib/published-resume", () => ({
  usePublishedProfileResume: () => null,
  usePublishedProjectImages: () => [],
}));

vi.mock("@/lib/local-resumes", () => ({
  getLocalResumeOptions: vi.fn(),
}));

describe("ResumeAction", () => {
  beforeEach(() => {
    vi.mocked(getLocalResumeOptions).mockReturnValue([
      { name: "2026-04-resume.pdf", url: "/assets/new-resume.pdf" },
      { name: "2025-02-resume.pdf", url: "/assets/old-resume.pdf" },
    ]);
  });

  it("downloads the latest local file and keeps older files viewable and downloadable", () => {
    render(<ResumeAction profileId="ammu" />);

    const downloadLatest = screen.getByRole("link", { name: "Download resume" });
    expect(downloadLatest).toHaveAttribute("href", "/assets/new-resume.pdf");
    expect(downloadLatest).toHaveAttribute("download", "2026-04-resume.pdf");

    fireEvent.click(screen.getByRole("button", { name: "View versions" }));
    expect(screen.getAllByRole("link", { name: "View" })[0]).toHaveAttribute(
      "href",
      "/assets/new-resume.pdf",
    );
    const downloadOlder = screen.getAllByRole("link", { name: "Download" })[1];
    expect(downloadOlder).toHaveAttribute("href", "/assets/old-resume.pdf");
    expect(downloadOlder).toHaveAttribute("download", "2025-02-resume.pdf");
  });
});
