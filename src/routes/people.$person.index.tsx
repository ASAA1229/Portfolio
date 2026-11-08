import { createFileRoute } from "@tanstack/react-router";
import { useMergedPersonPortfolio } from "@/lib/published-content";
import { getPersonPortfolio } from "@/lib/person-portfolios";
import { PersonHome, PersonUnavailable } from "@/components/PersonPortfolio";

export const Route = createFileRoute("/people/$person/")({
  head: ({ params }) => {
    const profile = getPersonPortfolio(params.person);
    return {
      meta: [
        { title: profile ? `${profile.name} — Portfolio` : "Portfolio" },
        { name: "description", content: profile?.summary ?? "Explore this personal portfolio." },
      ],
    };
  },
  component: PersonIndex,
});

function PersonIndex() {
  const { person } = Route.useParams();
  // Curated data with owner-published CMS overrides (PORT-US-035).
  const profile = useMergedPersonPortfolio(getPersonPortfolio(person));
  return profile ? <PersonHome profile={profile} /> : <PersonUnavailable missing />;
}
