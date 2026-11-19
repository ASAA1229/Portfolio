import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortfolioNavbar } from "@/components/navigation/PortfolioNavbar";
import { monogramFor } from "@/lib/monogram";
import { PersonShell } from "@/components/PersonPortfolio";
import { SiteShell } from "@/components/SiteShell";
import { PERSON_PORTFOLIOS } from "@/lib/person-portfolios";
import { clearPublishedContentCache } from "@/lib/published-content";

let mockPath = "/";

// Mock router state
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
    ariaLabel,
    "aria-label": ariaLabelProp,
    activeOptions: _activeOptions,
    activeProps: _activeProps,
    search: _search,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
    ariaLabel?: string;
    "aria-label"?: string;
    activeOptions?: unknown;
    activeProps?: unknown;
    search?: unknown;
    [key: string]: unknown;
  }) => (
    <a href={to} className={className} aria-label={ariaLabel ?? ariaLabelProp} {...props}>
      {children}
    </a>
  ),
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: mockPath } }),
}));

describe("PortfolioNavbar standardization", () => {
  it("renders GA monogram with red period dot for Abhishek", () => {
    mockPath = "/";
    const { container } = render(<PortfolioNavbar />);
    const brandLink = screen.getByRole("link", { name: /guda abhishek home/i });
    expect(brandLink).toBeInTheDocument();
    expect(brandLink.getAttribute("href")).toBe("/");

    const logo = container.querySelector(".site-nav-logo");
    expect(logo).toBeInTheDocument();
    expect(logo?.getAttribute("alt")).toBe("GA.");
  });

  it("renders all 8 primary navigation items in exact required order for Abhishek", () => {
    mockPath = "/";
    const { container } = render(<PortfolioNavbar />);
    const primaryNav = container.querySelector("nav.site-primary-nav");
    expect(primaryNav).toBeInTheDocument();

    const links = Array.from(primaryNav?.querySelectorAll("a") ?? []);
    const labels = links.map((link) => link.textContent?.trim());
    const expectedOrder = [
      "Home",
      "About",
      "Skills",
      "Projects",
      "Experience",
      "Certifications",
      "Education",
      "Contact",
    ];

    expect(labels).toEqual(expectedOrder);

    const hrefs = links.map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      "/",
      "/about",
      "/skills",
      "/projects",
      "/experience",
      "/certifications",
      "/education",
      "/contact",
    ]);
  });

  it("renders all 8 navigation items with profile-specific routes for Ammu", () => {
    mockPath = "/people/ammu";
    const { container } = render(<PortfolioNavbar person={PERSON_PORTFOLIOS.ammu} />);
    const primaryNav = container.querySelector("nav.site-primary-nav");
    expect(primaryNav).toBeInTheDocument();

    const links = Array.from(primaryNav?.querySelectorAll("a") ?? []);
    const labels = links.map((link) => link.textContent?.trim());
    expect(labels).toEqual([
      "Home",
      "About",
      "Skills",
      "Projects",
      "Experience",
      "Certifications",
      "Education",
      "Contact",
    ]);

    const hrefs = links.map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      "/people/ammu",
      "/people/ammu/about",
      "/people/ammu/skills",
      "/people/ammu/projects",
      "/people/ammu/experience",
      "/people/ammu/certifications",
      "/people/ammu/education",
      "/people/ammu/contact",
    ]);
  });

  it("renders AI Intro, Movie button, Choose Profile, and Let's talk controls", () => {
    mockPath = "/";
    const { container } = render(<PortfolioNavbar />);

    // 1. AI Intro button
    const aiIntroBtn = screen.getByRole("button", { name: /ai intro: open the ai introduction/i });
    expect(aiIntroBtn).toBeInTheDocument();
    expect(aiIntroBtn.textContent).toContain("AI Intro");

    // 2. Movie button links to the current projects page
    const movieBtn = container.querySelector(".site-nav-movie");
    expect(movieBtn).toBeInTheDocument();
    expect(movieBtn?.getAttribute("href")).toBe("/projects");

    // 3. Choose profile button
    const chooseProfile = screen.getByRole("link", { name: /choose portfolio profile/i });
    expect(chooseProfile).toBeInTheDocument();
    expect(chooseProfile.getAttribute("href")).toBe("/profiles");

    // 4. Let's talk button
    const talkLink = screen.getByRole("link", { name: /let's talk/i });
    expect(talkLink).toBeInTheDocument();
    expect(talkLink.getAttribute("href")).toBe("/contact");

    // 5. Hamburger menu button
    const menuBtn = screen.getByRole("button", { name: /open navigation/i });
    expect(menuBtn).toBeInTheDocument();
  });

  it("toggles mobile menu and supports Escape key dismissal", () => {
    mockPath = "/";
    const { container } = render(<PortfolioNavbar />);

    const menuBtn = screen.getByRole("button", { name: /open navigation/i });
    expect(container.querySelector("#portfolio-navigation")).toBeNull();

    // Click to open
    fireEvent.click(menuBtn);
    expect(container.querySelector("#portfolio-navigation")).toBeInTheDocument();

    // Escape closes menu
    fireEvent.keyDown(document, { key: "Escape" });
    expect(container.querySelector("#portfolio-navigation")).toBeNull();
  });

  it("integrates seamlessly into SiteShell (Abhishek root shell)", () => {
    mockPath = "/about";
    const { container } = render(
      <SiteShell>
        <div>Page Content</div>
      </SiteShell>,
    );

    const header = container.querySelector("header.site-nav");
    expect(header).toBeInTheDocument();
    expect(header?.querySelector(".site-nav-logo")?.getAttribute("alt")).toBe("GA.");
    expect(header?.querySelector(".site-primary-nav")).toBeInTheDocument();
    expect(header?.querySelector(".site-nav-movie")).toBeInTheDocument();
    expect(header?.querySelector(".site-nav-ai")).toBeInTheDocument();
  });

  it("integrates seamlessly into PersonShell (Ammu personal portfolio shell)", () => {
    mockPath = "/people/ammu/experience";
    const { container } = render(
      <PersonShell profile={PERSON_PORTFOLIOS.ammu}>
        <div>Ammu Experience Content</div>
      </PersonShell>,
    );

    const header = container.querySelector("header.site-nav");
    expect(header).toBeInTheDocument();
    // Ammu's shell shows her own monogram, never Abhishek's GA. logo.
    expect(header?.querySelector(".site-nav-logo")).toBeNull();
    expect(header?.querySelector(".site-nav-monogram")?.textContent).toBe("DA.");
    expect(header?.querySelector(".site-nav-brand")?.getAttribute("aria-label")).toMatch(/Amulya/);
    expect(header?.querySelector(".site-primary-nav")).toBeInTheDocument();
    expect(header?.querySelector(".site-nav-movie")).toBeInTheDocument();
    expect(header?.querySelector(".site-nav-ai")).toBeInTheDocument();
  });

  it("derives a distinct monogram for every person profile", () => {
    expect(monogramFor(PERSON_PORTFOLIOS.ammu.name)).toBe("DA");
    expect(monogramFor(PERSON_PORTFOLIOS.bava.name)).toBe("EK");
    expect(monogramFor(PERSON_PORTFOLIOS.sai.name)).toBe("DR");
  });
});

describe("PortfolioNavbar published appearance", () => {
  it("hides owner-hidden sections and applies the published accent preset", async () => {
    mockPath = "/people/ammu";
    clearPublishedContentCache();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          profileId: "ammu",
          content: { appearance: { theme: "emerald", hiddenSections: ["certifications"] } },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    try {
      const person = PERSON_PORTFOLIOS["ammu"]!;
      const { container, findByText } = render(<PortfolioNavbar person={person} />);
      await vi.waitFor(() =>
        expect(container.querySelector("style[data-profile-theme='emerald']")).not.toBeNull(),
      );
      const primaryNav = container.querySelector("nav.site-primary-nav")!;
      expect(primaryNav.textContent).not.toContain("Certifications");
      expect(primaryNav.textContent).toContain("Home");
      expect(await findByText("Contact", { selector: "nav.site-primary-nav a" })).toBeTruthy();
    } finally {
      fetchMock.mockRestore();
      clearPublishedContentCache();
    }
  });
});
