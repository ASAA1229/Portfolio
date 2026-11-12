import { Link, useRouterState } from "@tanstack/react-router";
import { Bot, Clapperboard, Menu, X, ArrowUpRight, UsersRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AiIntro } from "@/components/AiIntro";
import type { PersonPortfolio } from "@/lib/person-portfolios";
import logoImage from "../../../logo.png";
import { monogramFor } from "@/lib/monogram";
import { NAV_SECTIONS, sectionHref, themeCssVariables, themeForPreset } from "@/config/site-config";
import { navigationLabel } from "@/lib/cms-content";
import { usePublishedContent } from "@/lib/published-content";

export interface PortfolioNavbarProps {
  person?: PersonPortfolio | null;
}

interface NavItem {
  to: string;
  label: string;
  exact?: boolean;
}

export function PortfolioNavbar({ person }: PortfolioNavbarProps) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const [menu, setMenu] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);
  const [abhishekAiOpen, setAbhishekAiOpen] = useState(false);

  useEffect(() => {
    setMenu(false);
  }, [path]);

  useEffect(() => {
    if (!menu) return;
    mobileNavRef.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [menu]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !menu) return;
      setMenu(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [menu]);

  const isPerson = Boolean(person);
  const personId = person?.id;
  // Same string-typed route form as the section links below.
  const projectsTo: string = isPerson && personId ? `/people/${personId}/projects` : "/projects";

  // Exact 8 items in required order, from the shared site configuration (PORT-US-040).
  // Labels can be overridden per profile through published CMS content (PORT-US-035).
  const publishedContent = usePublishedContent(isPerson && personId ? personId : "abhishek");
  const hiddenSections = new Set(publishedContent?.appearance?.hiddenSections ?? []);
  const links: NavItem[] = NAV_SECTIONS.filter(
    (section) => section.page === "home" || !hiddenSections.has(section.page),
  ).map((section) => ({
    to: sectionHref(isPerson ? personId : undefined, section),
    label: navigationLabel(publishedContent, section.page, section.label),
    ...(section.exact ? { exact: true } : {}),
  }));
  // Published theme preset: fixed token values only, so the style block cannot carry owner input.
  const themePreset = publishedContent?.appearance?.theme;
  const themeStyle =
    themePreset && themePreset !== "crimson"
      ? `.site-shell { ${themeCssVariables(themeForPreset(themePreset))} }`
      : null;

  const homeTo = isPerson && personId ? `/people/${personId}` : "/";
  const contactTo = isPerson && personId ? `/people/${personId}/contact` : "/contact";
  // Each person gets their own monogram; the GA. logo image belongs to Abhishek only.
  const personMonogram = person ? monogramFor(person.name) : null;
  const brandLabel =
    isPerson && person?.displayName ? `${person.displayName} portfolio home` : "Guda Abhishek home";

  const handleAiIntroClick = () => {
    setMenu(false);
    if (isPerson) {
      window.dispatchEvent(new Event("portfolio:open-ai-intro"));
    } else {
      setAbhishekAiOpen(true);
    }
  };

  return (
    <header className="site-nav sticky inset-x-0 top-0 z-40">
      {themeStyle && <style data-profile-theme={themePreset}>{themeStyle}</style>}
      <div className="site-container site-nav-inner flex min-h-[92px] items-center justify-between gap-3 sm:gap-5">
        {/* Left section: Brand logo */}
        <Link
          to={homeTo}
          className="site-nav-brand flex shrink-0 items-center"
          aria-label={brandLabel}
        >
          {personMonogram ? (
            <span className="brand-monogram site-nav-monogram" aria-hidden="true">
              {personMonogram}
              <span className="text-primary">.</span>
            </span>
          ) : (
            <img
              src={logoImage}
              alt="GA."
              className="site-nav-logo h-10 w-auto max-w-[88px] object-contain sm:h-11"
              width={88}
              height={44}
              fetchPriority="high"
              decoding="async"
            />
          )}
        </Link>

        {/* Center section: Primary navigation (all 8 items in exact order) */}
        <nav aria-label="Main navigation" className="site-primary-nav hidden items-center lg:flex">
          {links.map(({ to, label, exact }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: Boolean(exact) }}
              activeProps={{ className: "site-nav-link-active" }}
              aria-current={
                (exact ? path === to : path === to || path.startsWith(`${to}/`))
                  ? "page"
                  : undefined
              }
              className="site-nav-link"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right section: Utility buttons and profile controls */}
        <div className="site-nav-actions flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* 1. AI Intro button */}
          <Button
            type="button"
            variant="outline"
            className="site-nav-ai min-h-11 gap-1.5 px-3 text-xs font-semibold sm:px-3.5 sm:text-sm"
            onClick={handleAiIntroClick}
            aria-label="Open AI Introduction"
          >
            <Bot className="size-4 shrink-0" aria-hidden="true" />
            <span>AI Intro</span>
          </Button>

          {/* 2. Movie button (Clapperboard icon button to the projects page) */}
          <Button
            asChild
            variant="outline"
            size="icon"
            className="site-nav-movie min-h-11 min-w-11"
            title="Explore projects"
          >
            <Link
              to={projectsTo}
              aria-label={`Explore ${person?.displayName ?? "Abhishek"} projects`}
            >
              <Clapperboard className="size-4" aria-hidden="true" />
            </Link>
          </Button>

          {/* 3. Choose profile control */}
          <Button
            asChild
            variant="outline"
            size="icon"
            className="site-profile-link min-h-11 min-w-11"
            title="Choose portfolio profile"
          >
            <Link to="/profiles" aria-label="Choose portfolio profile">
              <UsersRound className="size-4" aria-hidden="true" />
            </Link>
          </Button>

          {/* 4. Let's talk contact button */}
          <Button asChild variant="outline" className="site-nav-talk hidden xl:inline-flex">
            <Link to={contactTo}>
              Let&apos;s talk <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>

          {/* 5. Hamburger menu button */}
          <Button
            ref={menuButtonRef}
            variant="outline"
            size="icon"
            className="site-nav-menu min-h-11 min-w-11 lg:hidden"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            aria-controls="portfolio-navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {/* Responsive mobile & tablet navigation overlay */}
      {menu && (
        <nav
          ref={mobileNavRef}
          id="portfolio-navigation"
          aria-label="Mobile portfolio navigation"
          className="site-container site-mobile-nav grid grid-cols-2 gap-2 py-4 lg:hidden"
        >
          {links.map(({ to, label, exact }) => (
            <Button key={to} asChild variant="ghost" className="min-h-11 justify-start text-sm">
              <Link
                to={to}
                activeOptions={{ exact: Boolean(exact) }}
                activeProps={{ className: "text-violet font-semibold" }}
                aria-current={
                  (exact ? path === to : path === to || path.startsWith(`${to}/`))
                    ? "page"
                    : undefined
                }
                onClick={() => setMenu(false)}
              >
                {label}
              </Link>
            </Button>
          ))}

          <Button
            type="button"
            variant="ghost"
            className="min-h-11 justify-start gap-2 text-sm"
            onClick={handleAiIntroClick}
          >
            <Bot className="size-4" aria-hidden="true" />
            <span>AI Intro</span>
          </Button>

          <Button asChild variant="ghost" className="min-h-11 justify-start gap-2 text-sm">
            <Link to={projectsTo} onClick={() => setMenu(false)}>
              <Clapperboard className="size-4" aria-hidden="true" />
              <span>Explore projects</span>
            </Link>
          </Button>

          <Button asChild variant="ghost" className="min-h-11 justify-start gap-2 text-sm">
            <Link to="/profiles" onClick={() => setMenu(false)}>
              <UsersRound className="size-4" aria-hidden="true" />
              <span>Choose profile</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="ghost"
            className="min-h-11 justify-start gap-1 text-sm xl:hidden"
          >
            <Link to={contactTo} onClick={() => setMenu(false)}>
              Let&apos;s talk <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </nav>
      )}

      {/* Embedded modal trigger for Abhishek AI Intro when activated from navbar */}
      {!isPerson && abhishekAiOpen && (
        <AiIntroModal open={abhishekAiOpen} onOpenChange={setAbhishekAiOpen} />
      )}
    </header>
  );
}

function AiIntroModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <div className="sr-only">
      <AiIntro controlledOpen={open} onControlledOpenChange={onOpenChange} />
    </div>
  );
}
