import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPersonPortfolio, isPerson } from "@/lib/person-portfolios";
import { PersonContent, PersonUnavailable } from "@/components/PersonPortfolio";

// Keep Education as an explicit route as well as a supported section slug.
// This prevents the static Education destination from depending solely on the
// catch-all $section route when the generated route manifest is refreshed.
export const Route = createFileRoute("/people/$person/education")({
  beforeLoad: ({ params }) => {
    if (params.person === "abhishek") throw notFound();
    if (!isPerson(params.person)) throw notFound();
  },
  head: ({ params }) => ({
    meta: [
      { title: `Education — ${getPersonPortfolio(params.person)?.name ?? "Portfolio"}` },
      {
        name: "description",
        content: "Academic education and training for this portfolio profile.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  notFoundComponent: () => <PersonUnavailable missing />,
  component: EducationSection,
});

function EducationSection() {
  const { person } = Route.useParams();
  const profile = getPersonPortfolio(person);
  return profile ? (
    <PersonContent profile={profile} section="education" />
  ) : (
    <PersonUnavailable missing />
  );
}
