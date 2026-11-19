import { createFileRoute } from "@tanstack/react-router";
import { useMergedPersonPortfolio } from "@/lib/published-content";
import { getPersonPortfolio, personHead } from "@/lib/person-portfolios";
import { PersonHome, PersonUnavailable } from "@/components/PersonPortfolio";

export const Route = createFileRoute("/people/$person/")({
  head: ({ params }) => {
    const profile = getPersonPortfolio(params.person);
    return personHead(
      params.person,
      "Portfolio",
      profile?.summary ?? "Explore this personal portfolio.",
      `/people/${params.person}`,
    );
  },
  component: PersonIndex,
});

function PersonIndex() {
  const { person } = Route.useParams();
  // Curated data with owner-published CMS overrides (PORT-US-035).
  const profile = useMergedPersonPortfolio(getPersonPortfolio(person));
  return profile ? <PersonHome profile={profile} /> : <PersonUnavailable missing />;
}
