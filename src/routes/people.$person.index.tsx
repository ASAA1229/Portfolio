import { createFileRoute } from "@tanstack/react-router";
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
  const profile = getPersonPortfolio(person);
  return profile ? <PersonHome profile={profile} /> : <PersonUnavailable missing />;
}
