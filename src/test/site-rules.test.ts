import { describe, expect, it } from "vitest";
import { CERTS, CONTACT, MISSIONS, NAV, PROJECTS, SKILLS } from "@/lib/portfolio-data";
import { findProject, projectSlugs, siteProjects } from "@/lib/site-data";

describe("Project detail resolution", () => {
  it("resolves all existing projects without replacing their facts", () => {
    expect(projectSlugs.map((slug) => findProject(slug)?.title)).toEqual([
      "AI Farmer-to-Buyer Marketplace",
      "IoT–AI Disaster Notification & Coastal Safety System",
      "NEO AI — Enterprise AI Product Interface",
      "TKR IT Department Portal",
    ]);
  });

  it("returns no project for an unknown slug", () => {
    expect(findProject("not-a-real-project")).toBeUndefined();
  });

  it("keeps project records and detail slugs in one-to-one order", () => {
    expect(siteProjects).toHaveLength(PROJECTS.length);
    expect(projectSlugs).toHaveLength(PROJECTS.length);
    expect(new Set(projectSlugs).size).toBe(projectSlugs.length);
    expect(siteProjects.every((project) => project.slug.length > 0)).toBe(true);
  });
});

/**
 * EPIC-02 data-level acceptance matrix.
 * These checks protect the shared portfolio content before browser-level
 * route, viewport, loading/error and interaction acceptance is completed.
 */
describe("Portfolio content acceptance", () => {
  it("provides unique, non-empty navigation destinations", () => {
    const destinations = NAV.map(([destination]) => destination);
    expect(destinations.length).toBeGreaterThan(0);
    expect(new Set(destinations).size).toBe(destinations.length);
    expect(destinations.every((destination) => destination.trim().length > 0)).toBe(true);
    expect(NAV.every(([, label]) => label.trim().length > 0)).toBe(true);
  });

  it("keeps contact actions backed by a plausible email and social destinations", () => {
    expect(CONTACT.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(CONTACT.linkedin).toMatch(/^https:\/\//);
    expect(CONTACT.github).toMatch(/^https:\/\//);
  });

  it("has complete experience, skills and certification content", () => {
    expect(MISSIONS.length).toBeGreaterThan(0);
    expect(MISSIONS.every((mission) =>
      mission.company.trim().length > 0 &&
      mission.role.trim().length > 0 &&
      mission.projects.length > 0 &&
      mission.projects.every((project) =>
        project.name.trim().length > 0 && project.points.length > 0
      )
    )).toBe(true);

    expect(SKILLS.length).toBeGreaterThan(0);
    expect(SKILLS.every((group) =>
      group.cat.trim().length > 0 &&
      group.items.length > 0 &&
      group.items.every((skill) => skill.trim().length > 0)
    )).toBe(true);

    expect(CERTS.length).toBeGreaterThan(0);
    expect(CERTS.every(([name, issuer]) =>
      name.trim().length > 0 && issuer.trim().length > 0
    )).toBe(true);
  });
});
