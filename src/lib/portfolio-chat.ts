import { CERTS, CONTACT, MILESTONES, MISSIONS, PROJECTS, SKILLS } from "@/lib/portfolio-data";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: number;
  source?: "ai" | "fallback";
};

export const SUGGESTED_PROMPTS = [
  "What technologies does Abhishek use?",
  "Tell me about his experience at Paves Technologies",
  "Show me his AI projects",
  "How can I contact him?",
];

/** Verified portfolio facts — the only knowledge the assistant may use. */
export function portfolioKnowledge(): string {
  const exp = MISSIONS.map(
    (m) =>
      `- ${m.company}: ${m.role}, ${m.period}${m.location ? `, ${m.location}` : ""}\n${m.projects.map((p) => `  * ${p.name}: ${p.points.join(" ")}`).join("\n")}`,
  ).join("\n");
  const proj = PROJECTS.map(
    (p) => `- ${p.title} (${p.badge}): ${p.overview} Role: ${p.role} Tech: ${p.tech.join(", ")}`,
  ).join("\n");
  const skills = SKILLS.map((s) => `- ${s.cat}: ${s.items.join(", ")}`).join("\n");
  const certs = CERTS.map(([n, i]) => `- ${n} — ${i}`).join("\n");
  const ach = MILESTONES.map(([p, t, d]) => `- ${t} (${p}): ${d}`).join("\n");
  return `Name: Guda Abhishek — Software Engineer | AI & Full-Stack Developer, Hyderabad, India.
Education: B.Tech in Information Technology, TKR College of Engineering & Technology, 2022–2026, CGPA 7.6.
Interests: full-stack engineering, Generative AI, RAG, AI agents, intelligent automation.
Experience:\n${exp}\nProjects:\n${proj}\nSkills:\n${skills}\nCertifications:\n${certs}\nAchievements:\n${ach}
Contact: email ${CONTACT.email}, phone ${CONTACT.phone}, LinkedIn ${CONTACT.linkedin}, GitHub ${CONTACT.github}. A resume PDF is not uploaded; visitors can request it by email.
Portfolio sections: Episodes (experience), Originals (projects), Skills Universe, Certifications, Contact.`;
}

export const SYSTEM_PROMPT = `You are the portfolio assistant for Guda Abhishek. Answer visitors' questions in a friendly, concise way (under 150 words) using ONLY the facts below. Never invent employers, dates, metrics, credentials, links or project details. If the facts don't cover a question, say you don't know and point to the Contact section or his email. Suggest relevant portfolio sections (Episodes, Originals, Skills Universe, Certifications, Contact). Do not ask for sensitive personal information. Use short markdown lists and **bold** when helpful; never use markdown link syntax — write plain emails and URLs.\n\nFACTS:\n${portfolioKnowledge()}`;

/** Honest offline answers built from portfolio data, used when live AI is unavailable. */
export function fallbackAnswer(question: string): string {
  const q = question.toLowerCase().replace(/\\bstudies\\b/g, "study").replace(/\\bstudying\\b/g, "study");
  const has = (...w: string[]) => w.some((x) => q.includes(x));
  if (has("contact", "email", "reach", "hire", "phone", "linkedin", "github"))
    return `You can reach Abhishek at **${CONTACT.email}** or ${CONTACT.phone}. LinkedIn: ${CONTACT.linkedin} · GitHub: ${CONTACT.github}. See the **Contact** section to draft an email.`;
  if (has("paves")) {
    const m = MISSIONS[0]!;
    return `**${m.company}** — ${m.role} (${m.period}).\n\n${m.projects.map((p) => `- **${p.name}**: ${p.points[0]}`).join("\n")}\n\nOpen **Episodes** for full details.`;
  }
  if (has("bilvantis", "neo")) {
    const m = MISSIONS[1]!;
    return `**${m.company}** — ${m.role} (${m.period}).\n\n${m.projects
      .flatMap((p) => p.points)
      .map((p) => `- ${p}`)
      .join("\n")}`;
  }
  if (has("experience", "work", "intern", "job"))
    return (
      MISSIONS.map((m) => `- **${m.company}** — ${m.role}, ${m.period}`).join("\n") +
      "\n\nSee **Episodes** for more."
    );
  if (has("ai project", "ai ", "genai", "generative", "rag", "agent"))
    return (
      PROJECTS.filter((p) => /AI/.test(p.title))
        .map((p) => `- **${p.title}** (${p.badge})`)
        .join("\n") +
      "\n\nHe also works with: " +
      (SKILLS[2]?.items.join(", ") ?? "") +
      ". Explore **Originals**."
    );
  if (has("project"))
    return (
      PROJECTS.map((p) => `- **${p.title}** (${p.badge})`).join("\n") +
      "\n\nExplore **Originals** for details."
    );
  if (has("skill", "tech", "stack", "language", "tool"))
    return SKILLS.slice(0, 6)
      .map((s) => `- **${s.cat}**: ${s.items.join(", ")}`)
      .join("\n");
  if (has("cert")) return CERTS.map(([n, i]) => `- ${n} — ${i}`).join("\n");
  if (has("educat", "college", "degree", "cgpa", "study"))
    return "B.Tech in Information Technology at TKR College of Engineering & Technology (2022–2026), CGPA 7.6.";
  if (has("achiev", "award", "ieee", "leader"))
    return MILESTONES.map(([, t, d]) => `- **${t}**: ${d}`).join("\n");
  return `I don't have that information in the portfolio. Try asking about skills, experience, projects or certifications — or contact Abhishek at ${CONTACT.email}.`;
}
