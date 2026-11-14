import { createFileRoute } from "@tanstack/react-router";
import { buildRobots } from "@/lib/seo";
import { configuredSiteUrl } from "@/lib/seo-head";

// Replaces the former static public/robots.txt so the Sitemap line can be absolute.
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        new Response(buildRobots(configuredSiteUrl() ?? new URL(request.url).origin), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
