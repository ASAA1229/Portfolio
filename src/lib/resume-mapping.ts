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

/**
 * Breaks recognized section text into editable review entries without inventing
 * structure. Blank lines and explicit list markers create boundaries; wrapped
 * lines stay with the preceding entry.
 */
export function splitResumeSectionEntries(sectionText: string): string[] {
  const entries: string[] = [];
  let current: string[] = [];
  const flush = () => {
    const value = current.join("\n").trim();
    if (value) entries.push(value);
    current = [];
  };

  for (const rawLine of sectionText.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    const startsListItem = /^(?:[•●▪◦*-]|\d+[.)])\s+/.test(line);
    if (startsListItem && current.length) flush();
    current.push(line.replace(/^(?:[•●▪◦*-]|\d+[.)])\s+/, ""));
  }
  flush();
  return entries.slice(0, 40).map((entry) => entry.slice(0, 1200));
}


export type SuggestedResumeEntry = {
  title?: string;
  organization?: string;
  role?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  technologies?: string[];
  url?: string;
  credentialId?: string;
  grade?: string;
};

function extractDateRange(text: string): { startDate?: string; endDate?: string; matched: string } {
  const match = text.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(19|20)\d{2}\s*(?:-|–|—|to)\s*(Present|Current|(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(?:19|20)\d{2})\b/i);
  if (!match) return { matched: "" };
  return { startDate: match[0].split(/\s*(?:-|–|—|to)\s*/i)[0], endDate: match[3], matched: match[0] };
}

function extractLabeledValue(lines: string[], labels: string[]): { value?: string; line?: string } {
  const pattern = new RegExp("^\\s*(?:" + labels.join("|") + ")\\s*[:\\-]\\s*(.+)$", "i");
  const line = lines.find((item) => pattern.test(item));
  const match = line?.match(pattern);
  return match ? { value: match[1].trim(), line } : {};
}

/**
 * Suggests only clearly labelled or conventionally delimited fields.
 * Ambiguous content stays in description so a reviewer can correct it.
 */
export function suggestStructuredResumeEntries(
  section: "experience" | "education" | "projects" | "certifications",
  sectionText: string,
): SuggestedResumeEntry[] {
  return splitResumeSectionEntries(sectionText).map((raw) => {
    const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
    const first = lines[0] ?? "";
    const date = extractDateRange(raw);
    const location = extractLabeledValue(lines, ["location", "based in"]);
    const url = raw.match(/https:\/\/[^\s)>]+/i)?.[0]?.replace(/[.,;]+$/, "");
    const tech = extractLabeledValue(lines, ["technologies", "tech stack", "tools"]);
    const grade = extractLabeledValue(lines, ["grade", "cgpa", "gpa", "score", "percentage"]);
    const issuer = extractLabeledValue(lines, ["issuer", "issued by", "organization", "institution", "company"]);
    const credential = extractLabeledValue(lines, ["credential id", "credential", "certificate id"]);
    const role = extractLabeledValue(lines, ["role", "designation", "position"]);
    const cleanLines = lines.filter((line) =>
      line !== date.matched && line !== location.line && line !== tech.line &&
      line !== grade.line && line !== issuer.line && line !== credential.line &&
      line !== role.line && line !== url
    );
    const description = cleanLines.slice(section === "experience" || section === "projects" ? 1 : 1).join("\n").trim();
    const result: SuggestedResumeEntry = {
      ...(date.startDate ? { startDate: date.startDate } : {}),
      ...(date.endDate ? { endDate: date.endDate } : {}),
      ...(location.value ? { location: location.value } : {}),
      ...(url ? { url } : {}),
      ...(tech.value ? { technologies: tech.value.split(/[,;|]/).map((item) => item.trim()).filter(Boolean).slice(0, 30) } : {}),
      ...(grade.value ? { grade: grade.value } : {}),
      ...(issuer.value ? { organization: issuer.value } : {}),
      ...(credential.value ? { credentialId: credential.value } : {}),
      ...(description ? { description } : {}),
    };

    if (section === "experience") {
      if (role.value) result.role = role.value;
      else {
        const at = first.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
        const split = first.split(/\s+[|•]\s+/);
        if (at) { result.role = at[1].trim(); result.organization = at[2].trim(); }
        else if (split.length === 2) { result.role = split[0].trim(); result.organization = split[1].trim(); }
        else result.role = first;
      }
      if (!result.organization && issuer.value) result.organization = issuer.value;
    } else if (section === "education") {
      const split = first.split(/\s+(?:at|,|—|-)\s+/i);
      result.title = split[0] || first;
      if (!result.organization && split.length > 1) result.organization = split.slice(1).join(" ");
    } else if (section === "projects") {
      result.title = first.replace(/^project\s*:\s*/i, "");
      if (role.value) result.role = role.value;
    } else {
      result.title = first;
      if (issuer.value) result.organization = issuer.value;
    }
    return result;
  }).filter((entry) => Object.values(entry).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value)));
}


export type SuggestedResumeContact = {
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
};

/** Extracts explicit contact tokens only; it does not infer or invent contact data. */
export function suggestResumeContactDetails(text: string): SuggestedResumeContact {
  const email = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
  const phone = text.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?){2,4}\d{3,4}/)?.[0]?.trim();
  const links = text.match(/https:\/\/[^\s<>()]+/gi) ?? [];
  const linkedin = links.find((url) => /linkedin\.com\/in\//i.test(url))?.replace(/[.,;]+$/, "");
  const github = links.find((url) => /github\.com\//i.test(url))?.replace(/[.,;]+$/, "");
  return {
    ...(email ? { email: email.slice(0, 320) } : {}),
    ...(phone && phone.replace(/\D/g, "").length >= 7 ? { phone: phone.slice(0, 40) } : {}),
    ...(linkedin ? { linkedin } : {}),
    ...(github ? { github } : {}),
  };
}
