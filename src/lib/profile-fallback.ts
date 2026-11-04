import type { PersonPortfolio } from "@/lib/person-portfolios";

type AnswerMode = "chat" | "intro";

const list = (items: string[]) => items.length ? items.map((item) => `- ${item}`).join("\n") : "Not listed in the published profile.";

/**
 * Deterministic, verified-profile fallback used when the hosted AI gateway is
 * unavailable. It never claims that a live model answered the question.
 */
export function fallbackProfileAnswer(
  profile: PersonPortfolio,
  question: string,
  mode: AnswerMode = "chat",
): string {
  const education = `${profile.education.qualification} at ${profile.education.college} (${profile.education.period}); ${profile.education.score}.`;
  const experience = profile.experience.map((item) =>
    `**${item.role}** — ${item.company ?? "Company not specified"} (${item.period}).\n${item.points.map((point) => `- ${point}`).join("\n")}`,
  ).join("\n\n") || "No experience details are listed in the published profile.";
  const projects = profile.projects.map((project) =>
    `**${project.title}** — ${project.overview}\n${project.points.map((point) => `- ${point}`).join("\n")}\nTechnologies: ${project.tech.join(", ")}.`,
  ).join("\n\n") || "No projects are listed in the published profile.";
  const skills = profile.skills.map((category) => `**${category.category}:** ${category.items.join(", ")}`).join("\n");
  const certifications = profile.certifications.map((item) => `- ${item.title} — ${item.issuer}`).join("\n");
  const q = question.toLowerCase();

  if (mode === "intro" || /\b(introduce|introduction|tell me about (yourself|this profile)|who are you|about you)\b/.test(q)) {
    return `Hello! I'm the AI assistant presenting ${profile.name}'s portfolio.\n\n${profile.name} is a ${profile.headline}. ${profile.summary}\n\nEducation: ${education}\n\nExperience:\n${experience}\n\nSelected projects:\n${profile.projects.slice(0, 2).map((p) => `- ${p.title}: ${p.overview}`).join("\n")}\n\nThis introduction uses the published profile facts; it is not the person speaking.`;
  }
  if (/\b(contact|email|phone|reach|hire|linkedin|github)\b/.test(q)) {
    const socials = profile.socialLabels
      .filter((item) => item.handle)
      .map((item) => `${item.platform}: ${item.handle}`)
      .join(" · ");
    return `You can contact ${profile.name} at ${profile.email ?? "an email address is not listed"} or ${profile.phone ?? "a phone number is not listed"}. ${socials || "No social profile handles are listed in this profile."}`;
  }
  if (/\b(skill|skills|technology|technologies|tech stack|stack|programming|language|framework|database|tools)\b/.test(q)) return `Here are the skills listed for ${profile.name}:\n\n${skills}`;
  if (/\b(experience|work history|internship|intern|career|company|employer|job|role)\b/.test(q)) return `**Experience for ${profile.name}**\n\n${experience}`;
  if (/\b(project|projects|built|developed|application|portfolio work)\b/.test(q)) return `**Projects for ${profile.name}**\n\n${projects}`;
  if (/\b(education|degree|college|university|graduat|cgpa|gpa|study)\b/.test(q)) return `**Education**\n${education}`;
  if (/\b(certification|certificate|certified|course)\b/.test(q)) return `**Certifications**\n${certifications || "No certifications are listed in the published profile."}`;
  if (/\b(leadership|leader|coordinator|team)\b/.test(q)) return `**Leadership**\n${profile.leadership.map((item) => `- ${item.title} (${item.period}): ${item.description}`).join("\n") || "No leadership details are listed in the published profile."}`;
  if (/\b(training|workshop|learning)\b/.test(q)) return `**Training**\n${profile.training.map((item) => `- ${item.title} — ${item.provider} (${item.status})`).join("\n") || "No training details are listed in the published profile."}`;

  return `I can answer using ${profile.name}'s published portfolio facts.\n\n**About:** ${profile.summary}\n\nTry asking about skills, experience, projects, education, certifications, or contact details.\n\nNote: Live AI is currently unavailable, so this response was generated from verified profile data.`;
}
