import {
  createFileRoute,
  Link,
  Outlet,
  notFound,
  redirect,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useMergedPersonPortfolio } from "@/lib/published-content";
import { getPersonPortfolio, isPerson } from "@/lib/person-portfolios";
import { PersonShell, PersonUnavailable } from "@/components/PersonPortfolio";
export const Route = createFileRoute("/people/$person")({
  beforeLoad: ({ params }) => {
    if (params.person === "darling")
      throw redirect({ to: "/people/$person", params: { person: "sai" }, replace: true });
    if (!isPerson(params.person)) throw notFound();
    if (params.person === "abhishek") throw redirect({ to: "/" });
  },
  component: PersonLayout,
  notFoundComponent: () => <PersonUnavailable missing />,
  errorComponent: PersonError,
});
/** A failure inside one profile keeps navigation available and offers a retry. */
function PersonError({ reset }: ErrorComponentProps) {
  return (
    <main className="site-container flex min-h-[60vh] flex-col items-start justify-center gap-4 py-16">
      <h1 className="text-3xl font-semibold">This section didn&apos;t load</h1>
      <p className="max-w-xl text-sm leading-7 text-muted-foreground">
        Something went wrong while showing this profile. Try again, or choose another profile.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded border border-border px-4"
          onClick={() => reset()}
        >
          Try again
        </button>
        <Link
          to="/profiles"
          className="inline-flex min-h-11 items-center rounded border border-border px-4"
        >
          Choose a profile
        </Link>
      </div>
    </main>
  );
}
function PersonLayout() {
  const { person } = Route.useParams();
  // Curated data with owner-published CMS overrides (PORT-US-035).
  const profile = useMergedPersonPortfolio(getPersonPortfolio(person));
  if (!profile) return <Outlet />;
  return (
    <PersonShell profile={profile}>
      <Outlet />
    </PersonShell>
  );
}
