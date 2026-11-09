import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersonContent, PersonShell } from "@/components/PersonPortfolio";
import { PERSON_PORTFOLIOS, PERSON_SECTIONS } from "@/lib/person-portfolios";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    activeOptions: _activeOptions,
    activeProps: _activeProps,
    ...props
  }: {
    to: string;
    params?: Record<string, string>;
    children: React.ReactNode;
    activeOptions?: unknown;
    activeProps?: unknown;
    [key: string]: unknown;
  }) => {
    const href = Object.entries(params ?? {}).reduce(
      (path, [key, value]) => path.replace(`$${key}`, value),
      to,
    );
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: "/people/ammu" } }),
}));

// No published resume: the curated profile data is rendered.
vi.mock("@/lib/published-resume", () => ({
  usePublishedProfileResume: () => null,
  usePublishedProfilePortrait: () => null,
}));

const people = [PERSON_PORTFOLIOS.ammu, PERSON_PORTFOLIOS.bava, PERSON_PORTFOLIOS.sai];

describe("person portfolio pages share Abhishek's chapter template", () => {
  for (const profile of people) {
    const others = people.filter((other) => other.id !== profile.id);
    for (const { id: section } of PERSON_SECTIONS) {
      it(`${profile.id}/${section} renders a cinematic chapter hero and only its own identity`, () => {
        const { container, unmount } = render(
          <PersonContent profile={profile} section={section} />,
        );
        const hero = container.querySelector("section.chapter-hero");
        expect(hero).not.toBeNull();
        expect(hero?.querySelector(".chapter-kicker")?.textContent).toMatch(/^0\d \/ /);
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        const text = container.textContent ?? "";
        for (const other of others) {
          expect(text).not.toContain(other.name);
          if (other.email) expect(text).not.toContain(other.email);
        }
        expect(text).not.toMatch(/Guda Abhishek/);
        unmount();
      });
    }
  }

  it("projects page uses the featured production + series layout", () => {
    const profile = PERSON_PORTFOLIOS.ammu;
    const { container } = render(<PersonContent profile={profile} section="projects" />);
    expect(container.querySelector(".featured-project h2")?.textContent).toBe(
      profile.projects[0]!.title,
    );
    if (profile.projects.length > 1) {
      expect(screen.getByRole("heading", { name: "Other work in the series." })).toBeTruthy();
      expect(container.querySelectorAll(".showcase-project")).toHaveLength(
        profile.projects.length - 1,
      );
    }
  });

  it("contact page shows the end card with the person's initials and an email draft form", () => {
    const profile = PERSON_PORTFOLIOS.ammu;
    const { container } = render(<PersonContent profile={profile} section="contact" />);
    expect(container.querySelector(".endcard-mark")?.textContent).toBe(`${profile.initials}.`);
    if (profile.email) {
      expect(container.querySelector(`a[href="mailto:${profile.email}"]`)).not.toBeNull();
      expect(screen.getByLabelText(/your email/i)).toBeTruthy();
      expect(
        screen.getByRole("button", { name: new RegExp(`copy ${profile.displayName}`, "i") }),
      ).toBeTruthy();
    }
  });

  it("footer matches the shared structure without another person's details", () => {
    const profile = PERSON_PORTFOLIOS.sai;
    const { container } = render(
      <PersonShell profile={profile}>
        <div />
      </PersonShell>,
    );
    const footer = container.querySelector("footer.site-footer");
    expect(footer?.textContent).toContain("Let's build something meaningful.");
    expect(footer?.textContent).toContain(`© 2026 ${profile.name}`);
    expect(footer?.querySelector('a[href="/people/sai/projects"]')).not.toBeNull();
    // Sai has no LinkedIn/GitHub URLs: no social buttons are rendered.
    expect(footer?.textContent).not.toMatch(/LinkedIn|GitHub/);
  });
});
