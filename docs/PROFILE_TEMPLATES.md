# Profile templates and site configuration (PORT-US-040)

All four profiles share one template: the shared shells (`SiteShell`, `PersonShell`),
the navbar, section pages and components. What differs per profile is **data**:
curated profile records, published CMS overrides, personas, resumes and media.

## Configuration

`src/config/site-config.ts` holds the typed configuration that a future client
template would change instead of editing shared components:

- `DEFAULT_THEME` — colours, fonts and radius, mirroring `:root` in `src/styles.css`.
  `themeCssVariables(theme)` renders an override block for a custom theme.
- `NAV_SECTIONS` — the eight primary sections, their order, default labels and paths.
  The navbar renders from this list; owners can relabel sections per profile in
  **Admin → Content Manager → Navigation labels**.

## Create a new profile from the template

1. Create the record with the factory:

   ```ts
   import { createProfileFromTemplate } from "@/lib/profile-template";
   const priya = createProfileFromTemplate({
     id: "priya",
     name: "Priya Sharma",
     headline: "Data Analyst",
     summary: "…",
     portrait: "/images/profiles/priya/main.webp",
   });
   ```

2. Add it to `PERSON_PORTFOLIOS` and `PEOPLE` in `src/lib/person-portfolios.ts`, and
   extend the profile id unions (`PersonPortfolio["id"]`, `ContentProfileId`,
   `PersonaProfileId`, resume `ProfileId`) — these are deliberately explicit so a
   profile cannot appear without its isolation rules.
3. Put approved images under `public/images/profiles/<id>/` (WebP, ≤1600 px).
4. Fill in content through **/admin/content**, the persona through
   **/admin/personas**, and upload a resume through **/admin/resumes**; publish each.
5. The sitemap, navigation, person routes and AI context pick the profile up from
   the shared data — no page or component copies are needed.

## Out of scope

Multi-tenant hosting, client billing and client-specific role systems are not part
of the personal release and need a separate owner decision.
