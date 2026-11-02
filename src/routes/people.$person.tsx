import { createFileRoute, Outlet, notFound, redirect } from "@tanstack/react-router";
import { getPersonPortfolio, isPerson } from "@/lib/person-portfolios";
import { PersonShell, PersonUnavailable } from "@/components/PersonPortfolio";
export const Route = createFileRoute("/people/$person")({
  beforeLoad: ({ params }) => {
    if (params.person === "darling") throw redirect({ to: "/people/$person", params: { person: "sai" }, replace: true });
    if (!isPerson(params.person)) throw notFound();
    if (params.person === "abhishek") throw redirect({ to: "/" });
  },
  component: PersonLayout,
  notFoundComponent: () => <PersonUnavailable missing />,
});
function PersonLayout() {
  const { person } = Route.useParams();
  const profile = getPersonPortfolio(person);
  if (!profile) return <Outlet />;
  return (
    <PersonShell profile={profile}>
      <Outlet />
    </PersonShell>
  );
}
