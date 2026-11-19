import { QueryClient } from "@tanstack/react-query";
import { createRouter, isRedirect, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { Route as LegacyPortfolioRoute } from "@/routes/portfolio";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
  it("matches the profile picker and all current primary pages", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    for (const path of [
      "/",
      "/profiles",
      "/about",
      "/skills",
      "/projects",
      "/projects/neo-ai",
      "/experience",
      "/certifications",
      "/education",
      "/contact",
    ]) {
      expect(router.matchRoutes(path).at(-1)?.routeId, path).not.toBe(rootRouteId);
    }
  });
  it("redirects the legacy /portfolio URL permanently to the multi-page home", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/portfolio").at(-1)?.routeId).toBe("/portfolio");

    let thrown: unknown;
    try {
      (LegacyPortfolioRoute.options.beforeLoad as () => void)();
    } catch (error) {
      thrown = error;
    }
    expect(isRedirect(thrown)).toBe(true);
    expect((thrown as { options: { to?: string; statusCode?: number } }).options).toMatchObject({
      to: "/",
      statusCode: 301,
    });
  });
});
