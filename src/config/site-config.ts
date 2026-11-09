/**
 * Typed site configuration (PORT-US-040).
 *
 * The values mirror the current design exactly (no visual change). Shared shells
 * and the navbar read navigation from here, so a future client template can swap
 * branding, sections and labels through configuration instead of editing shared
 * components. Theme tokens are the canonical list of what src/styles.css defines
 * on :root; `themeCssVariables()` renders an override block for a custom theme.
 */
import type { ContentPage } from "@/lib/cms-content";

export interface ThemeTokens {
  colors: {
    background: string;
    foreground: string;
    card: string;
    primary: string;
    /** Brand color lightened for small text (WCAG AA on dark surfaces). */
    primaryText: string;
    primaryForeground: string;
    muted: string;
    mutedForeground: string;
  };
  fonts: { display: string; sans: string; mono: string };
  /** Base corner radius; component radii derive from it. */
  radius: string;
}

export const DEFAULT_THEME: ThemeTokens = {
  colors: {
    background: "oklch(0.191 0 0)",
    foreground: "oklch(0.96 0.01 260)",
    card: "oklch(0.211 0.006 285.9)",
    primary: "oklch(0.584 0.233 27.9)",
    primaryText: "#ff3b42",
    primaryForeground: "oklch(1 0 0)",
    muted: "oklch(0.2 0.015 270)",
    mutedForeground: "oklch(0.76 0.015 260)",
  },
  fonts: {
    display: '"Barlow Condensed", sans-serif',
    sans: '"Sora", sans-serif',
    mono: '"JetBrains Mono", monospace',
  },
  radius: "0.375rem",
};

/** CSS custom-property block for a theme (used only when a non-default theme is applied). */
export function themeCssVariables(theme: ThemeTokens): string {
  const { colors, fonts } = theme;
  return [
    `--background: ${colors.background};`,
    `--foreground: ${colors.foreground};`,
    `--card: ${colors.card};`,
    `--primary: ${colors.primary};`,
    `--primary-text: ${colors.primaryText};`,
    `--primary-foreground: ${colors.primaryForeground};`,
    `--muted: ${colors.muted};`,
    `--muted-foreground: ${colors.mutedForeground};`,
    `--font-display: ${fonts.display};`,
    `--font-sans: ${fonts.sans};`,
    `--font-mono: ${fonts.mono};`,
    `--radius: ${theme.radius};`,
  ].join(" ");
}

export interface NavSection {
  page: ContentPage;
  /** Default label; owners can override labels per profile in the CMS. */
  label: string;
  /** Path segment after the profile root ("" for home). */
  path: string;
  exact?: boolean;
}

/** The eight primary sections, in the required order. */
export const NAV_SECTIONS: readonly NavSection[] = [
  { page: "home", label: "Home", path: "", exact: true },
  { page: "about", label: "About", path: "/about" },
  { page: "skills", label: "Skills", path: "/skills" },
  { page: "projects", label: "Projects", path: "/projects" },
  { page: "experience", label: "Experience", path: "/experience" },
  { page: "certifications", label: "Certifications", path: "/certifications" },
  { page: "education", label: "Education", path: "/education" },
  { page: "contact", label: "Contact", path: "/contact" },
];

/** Route for a section: Abhishek's site lives at the root, others under /people/<id>. */
export function sectionHref(profileId: string | undefined, section: NavSection): string {
  if (!profileId || profileId === "abhishek") return section.path || "/";
  return `/people/${profileId}${section.path}`;
}

export interface SiteConfig {
  siteName: string;
  theme: ThemeTokens;
  navigation: readonly NavSection[];
}

export const SITE_CONFIG: SiteConfig = {
  siteName: "Portfolio",
  theme: DEFAULT_THEME,
  navigation: NAV_SECTIONS,
};
