export type ResumeSectionName =
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications";

export type ResumeSectionMapping = {
  headline?: string;
  summary?: string;
  skills: string[];
  sections: Partial<Record<ResumeSectionName, string>>;
  unmappedText: string;
};

const HEADINGS: { name: ResumeSectionName; pattern: RegExp }[] = [
  { name: "experience", pattern: /^(?:work\s+)?experience(?:\s+&\s+internships?)?$|^employment\s+history$|^professional\s+experience$/i },
  { name: "education", pattern: /^education(?:al\s+background)?$|^academic\s+background$/i },
  { name: "skills", pattern: /^(?:technical\s+)?skills(?:\s+&\s+tools)?$|^technology\s+stack$/i },
  { name: "projects", pattern: /^projects?(?:\s+experience)?$|^selected\s+projects$/i },
  { name: "certifications", pattern: /^certifications?(?:\s+&\s+courses)?$|^licenses\s+&\s+certifications$/i },
];

function normalizeHeading(line: string): string {
  return line.replace(/^\s*(?:[#*•\-–—]+\s*)/, "").replace(/\s*[:|]\s*$/, "").trim();
}

/**
 * Conservative heading-based mapping. It only assigns text beneath recognizable
 * section headings; it does not infer dates, employers, qualifications or skills.
 */
export function mapResumeSections(text: string): ResumeSectionMapping {
  const sections: ResumeSectionMapping["sections"] = {};
  const unmapped: string[] = [];
  let active: ResumeSectionName | null = null;
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (active && sections[active]) sections[active] += "\n";
      else if (!active) unmapped.push("");
      continue;
    }

    const heading = HEADINGS.find((item) => item.pattern.test(normalizeHeading(line)));
    if (heading) {
      active = heading.name;
      sections[active] = sections[active] ? sections[active] + "\n" : "";
      continue;
    }

    if (active) sections[active] = (sections[active] ? sections[active] + "\n" : "") + line;
    else unmapped.push(line);
  }

  const skills = (sections.skills ?? "")
    .split(/[\n,;•|]+/)
    .map((skill) => skill.replace(/^[-*\s]+/, "").trim())
    .filter((skill) => skill.length > 1 && skill.length <= 80)
    .slice(0, 60);

  return {
    skills,
    sections,
    unmappedText: unmapped.join("\n").trim(),
  };
}
