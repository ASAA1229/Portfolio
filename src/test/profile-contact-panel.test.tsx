import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileContactPanel } from "@/components/ProfileContactPanel";

describe("ProfileContactPanel", () => {
  it("renders details, resume download and validates the mailto draft form", () => {
    render(
      <ProfileContactPanel
        contact={{
          displayName: "Ammu",
          email: "ammu@example.com",
          phone: "+91 90000 00000",
          location: "Hyderabad",
          resumeHref: "/files/ammu.pdf",
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "ammu@example.com" })).toHaveAttribute(
      "href",
      "mailto:ammu@example.com",
    );
    expect(screen.getByRole("link", { name: /resume/i })).toHaveAttribute(
      "href",
      "/files/ammu.pdf",
    );
    expect(screen.getByRole("button", { name: "Copy Ammu's email" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /email ammu/i }));
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });

  it("shows a pending note and no form when no contact details exist", () => {
    render(<ProfileContactPanel contact={{ displayName: "Sai" }} />);
    expect(screen.getByText(/contact details will be added/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /email sai/i })).toBeNull();
  });
});
