import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMergedPersonPortfolio } from "@/lib/published-content";
import { getPersonPortfolio, getPersonProject, personHead } from "@/lib/person-portfolios";
import { PersonProjectDetail, PersonUnavailable } from "@/components/PersonPortfolio";
export const Route = createFileRoute("/people/$person/projects/$slug")({
  beforeLoad: ({ params }) => {
    // Malformed slugs are rejected here; well-formed slugs may be CMS-published
    // projects, which the component resolves from merged content (or shows as missing).
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(params.slug)) throw notFound();
  },
  head: ({ params }) => {
    const project = getPersonProject(params.person, params.slug);
    return personHead(
      params.person,
      project?.title ?? "Project",
      project?.overview ?? "Project details from this portfolio.",
      `/people/${params.person}/projects/${params.slug}`,
    );
  },
  notFoundComponent: () => <PersonUnavailable missing />,
  component: Detail,
});
function Detail() {
  const { person, slug } = Route.useParams();
  // Curated data with owner-published CMS overrides (PORT-US-035).
  const profile = useMergedPersonPortfolio(getPersonPortfolio(person));
  // Archived projects disappear; new published projects resolve by slug.
  const project = profile?.projects.find((item) => item.slug === slug);
  return profile && project ? (
    <PersonProjectDetail profile={profile} project={project} />
  ) : (
    <PersonUnavailable missing />
  );
}
