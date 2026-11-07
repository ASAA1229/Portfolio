export type ResumeSectionName = "experience" | "education" | "projects" | "certifications";

/** Structured, reviewed resume entry. All fields are optional to support partial drafts. */
export type StructuredResumeEntry = {
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

/** Legacy strings remain valid so existing published records continue to render. */
export type ResumeSectionEntry = string | StructuredResumeEntry;

export type StructuredResumeSections = Record<ResumeSectionName, ResumeSectionEntry[]>;

export const RESUME_SECTION_NAMES: ResumeSectionName[] = [
  "experience",
  "education",
  "projects",
  "certifications",
];

export function createEmptyResumeEntry(section: ResumeSectionName): StructuredResumeEntry {
  switch (section) {
    case "experience":
      return {
        role: "",
        organization: "",
        location: "",
        startDate: "",
        endDate: "",
        description: "",
        technologies: [],
      };
    case "education":
      return {
        title: "",
        organization: "",
        location: "",
        startDate: "",
        endDate: "",
        grade: "",
        description: "",
      };
    case "projects":
      return { title: "", role: "", description: "", technologies: [], url: "" };
    case "certifications":
      return {
        title: "",
        organization: "",
        startDate: "",
        credentialId: "",
        url: "",
        description: "",
      };
  }
}

export function resumeEntryHasContent(entry: ResumeSectionEntry): boolean {
  if (typeof entry === "string") return entry.trim().length > 0;
  return Object.entries(entry).some(([key, value]) =>
    Array.isArray(value)
      ? value.some((item) => item.trim())
      : typeof value === "string" && value.trim().length > 0,
  );
}
