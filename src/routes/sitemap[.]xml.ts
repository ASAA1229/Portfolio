import { createFileRoute } from "@tanstack/react-router";
import { buildSitemap } from "@/lib/seo";
import { configuredSiteUrl } from "@/lib/seo-head";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        new Response(buildSitemap(configuredSiteUrl() ?? new URL(request.url).origin), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
