import { useAbhishekContent } from "@/lib/abhishek-content";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageBody, PageHeading, ProjectCard } from "@/components/SitePrimitives";
import { pageHead } from "@/lib/site-data";
export const Route = createFileRoute("/projects/")({
  head: () =>
    pageHead(
      "Projects",
      "Explore Guda Abhishek's AI marketplace, coastal safety concept, NEO AI interface and TKR department portal.",
      "/projects",
    ),
  component: Projects,
});
function Projects() {
  const [filter, setFilter] = useState("All work");
  const { projects: allProjects } = useAbhishekContent();
  const projects = allProjects.filter(
    (p) => filter === "All work" || (filter === "AI & intelligence" ? p.index !== 3 : p.index >= 2),
  );
  return (
    <PageBody>
      <PageHeading
        number="03"
        title="Ideas, engineered."
        description="Selected projects and product contributions. From intelligent marketplaces to enterprise interfaces, each begins with a real problem."
      />
      <div className="mb-8 flex flex-wrap gap-3" role="group" aria-label="Filter projects">
        {["All work", "AI & intelligence", "Web platforms"].map((item) => (
          <Button
            key={item}
            variant={filter === item ? "default" : "outline"}
            onClick={() => setFilter(item)}
            aria-pressed={filter === item}
            className="min-h-11"
          >
            {item}
          </Button>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </PageBody>
  );
}
