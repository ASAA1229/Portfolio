import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import { routeTree } from "@/routeTree.gen";
import { PERSON_PORTFOLIOS, PERSON_SECTIONS } from "@/lib/person-portfolios";

/**
 * Automated WCAG 2.x A/AA checks (axe-core) over every public route for all four profiles and
 * every Admin screen, rendered through the real router.
 *
 * Limits, stated honestly: jsdom has no layout or stylesheet engine, so colour contrast, reflow,
 * focus visibility and target size cannot be evaluated here. `color-contrast` is therefore
 * disabled and those criteria still need a browser audit (scripts/a11y-browser-audit.mjs) and
 * manual keyboard/screen-reader review. Passing this suite is necessary, not sufficient.
 */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ROOT_PAGES = [
  "/",
  "/about",
  "/skills",
  "/projects",
  "/projects/neo-ai",
  "/experience",
  "/certifications",
  "/education",
  "/contact",
  "/profiles",
  "/privacy",
];
const PERSON_PAGES = Object.values(PERSON_PORTFOLIOS).flatMap((person) => [
  `/people/${person.id}`,
  ...PERSON_SECTIONS.map((section) => `/people/${person.id}/${section.id}`),
  `/people/${person.id}/projects/${person.projects[0]!.slug}`,
]);
const ADMIN_PAGES = [
  "/admin/login",
  "/admin",
  "/admin/content",
  "/admin/personas",
  "/admin/resumes",
  "/admin/images",
  "/admin/backup",
  "/admin/audit",
];

async function renderRoute(path: string) {
  // Admin screens render their signed-out/empty states; the API is unavailable in unit tests.
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 401 }));
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  const view = render(<RouterProvider router={router} />);
  await new Promise((resolve) => setTimeout(resolve, 100));
  return view;
}

async function audit(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
    },
    // Only violations are consumed; skipping pass/incomplete result processing cuts axe time a lot.
    resultTypes: ["violations"],
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes
        .slice(0, 2)
        .map((node) => node.target.join(" "))
        .join(", ")}`,
  );
}

describe.each([
  ["public root pages", ROOT_PAGES],
  ["public profile pages (ammu, bava, sai)", PERSON_PAGES],
  ["Admin screens", ADMIN_PAGES],
])("axe-core: %s", (_name, paths) => {
  it.each(paths)(
    "%s has no automatically detectable violations",
    async (path) => {
      const { container } = await renderRoute(path);
      expect(await audit(container)).toEqual([]);
    },
    30_000,
  );
});

describe("structural accessibility requirements", () => {
  it("every page has exactly one main landmark, one h1 and a bypass-blocks skip link", async () => {
    for (const path of ["/", "/about", "/profiles", "/privacy", "/people/ammu", "/admin/login"]) {
      const { container, unmount } = await renderRoute(path);
      expect(container.querySelectorAll("main"), path).toHaveLength(1);
      expect(container.querySelectorAll("h1").length, path).toBeGreaterThanOrEqual(1);
      // Pages inside the shared shell repeat the navigation, so they must offer a bypass link.
      // The profile picker and the single-form login have no repeated blocks (WCAG 2.4.1 n/a).
      if (!["/profiles", "/admin/login"].includes(path)) {
        const skip = screen.getAllByRole("link", { name: /skip to content/i })[0]!;
        expect(skip.getAttribute("href")).toMatch(/^#(page|person)-content$/);
        expect(container.querySelector(skip.getAttribute("href")!), path).not.toBeNull();
      }
      unmount();
    }
  });

  it("images always carry an alt attribute", async () => {
    for (const path of ["/", "/people/bava", "/people/sai/projects"]) {
      const { container, unmount } = await renderRoute(path);
      for (const image of container.querySelectorAll("img")) {
        expect(image.hasAttribute("alt"), `${path} ${image.getAttribute("src")}`).toBe(true);
      }
      unmount();
    }
  });

  it("document language is declared and motion/focus styles are provided", () => {
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    expect(root).toContain('lang="en"');
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/:focus-visible/);
  });
});
