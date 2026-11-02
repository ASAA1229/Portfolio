import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { PortfolioNavbar } from "@/components/navigation/PortfolioNavbar";
import { PortfolioChat } from "@/components/PortfolioChat";
import { SocialLinks, ResumeAction } from "@/components/SitePrimitives";
import { CONTACT } from "@/lib/portfolio-data";

export function SiteShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (state) => state.location.pathname });

  if (
    path === "/portfolio" ||
    path === "/profiles" ||
    path.startsWith("/admin") ||
    path.startsWith("/people/") ||
    path.startsWith("/api/")
  ) {
    return children;
  }

  return (
    <div className="site-shell">
      <a
        href="#page-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-background focus:p-4"
      >
        Skip to content
      </a>

      <PortfolioNavbar />

      <div id="page-content">{children}</div>

      <footer className="site-footer">
        <div className="site-container">
          <div className="flex flex-wrap items-center justify-between gap-8">
            <div>
              <p className="font-mono text-xs text-violet">THE NEXT CHAPTER</p>
              <h2 className="mt-3 text-4xl font-semibold">Let&apos;s build something meaningful.</h2>
              <a
                href={`mailto:${CONTACT.email}`}
                className="mt-4 inline-block break-all text-sm text-muted-foreground hover:text-foreground"
              >
                {CONTACT.email} <ArrowUpRight className="inline size-4" />
              </a>
            </div>
            <div className="flex flex-wrap gap-3">
              <SocialLinks />
              <ResumeAction />
            </div>
          </div>
          <div className="mt-10 flex flex-wrap justify-between gap-4 border-t border-border pt-6 text-[10px] leading-5 text-muted-foreground">
            <p>© 2026 Guda Abhishek. All rights reserved. Netflix-inspired portfolio concept.</p>
            <Link to="/portfolio" search={{ profile: "guest" }}>
              Explore The Series <ArrowUpRight className="inline size-3" />
            </Link>
          </div>
        </div>
      </footer>
      <PortfolioChat />
    </div>
  );
}
