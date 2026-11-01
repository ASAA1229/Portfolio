export const PEOPLE = [
  {
    id: "abhishek",
    name: "Abhishek",
    nickname: null,
    initials: "GA",
    avatar: "/images/profiles/abhishek/abhishek_main.jpeg",
    color: "profile-blue",
    status: "Portfolio",
  },
  {
    id: "ammu",
    name: "Amulya",
    nickname: "Ammu",
    initials: "DA",
    avatar: "/images/profiles/amulya/amulya_main.webp",
    color: "profile-green",
    status: "Portfolio",
  },
  {
    id: "bava",
    name: "Anjini Kumar",
    nickname: "Bava",
    initials: "AB",
    avatar: "/images/profiles/anjini/anjini_main.jpg",
    color: "profile-purple",
    status: "Data Analytics Portfolio",
  },
  {
    id: "sai",
    name: "Sai",
    nickname: "Darling",
    initials: "DS",
    avatar: "/images/profiles/sai/sai_main.png",
    color: "profile-red",
    status: "Portfolio",
  },
] as const;
export type PersonId = (typeof PEOPLE)[number]["id"];
export type PortfolioSection =
  "about" | "skills" | "projects" | "experience" | "certifications" | "education" | "contact";
export const PERSON_SECTIONS: { id: PortfolioSection; label: string }[] = [
  { id: "about", label: "About" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "experience", label: "Experience" },
  { id: "certifications", label: "Certifications" },
  { id: "education", label: "Education" },
  { id: "contact", label: "Contact" },
];
export interface PersonProject {
  slug: string;
  title: string;
  context: string;
  overview: string;
  points: string[];
  tech: string[];
  caution?: string;
}
export interface PersonPortfolio {
  id: "ammu" | "sai" | "bava";
  name: string;
  displayName: string;
  nickname: string;
  initials: string;
  portrait: string;
  gallery: { src: string; alt: string }[];
  headline: string;
  story: string;
  summary: string;
  email: string | null;
  phone: string | null;
  socialLabels: { platform: string; handle: string | null }[];
  strengths: { title: string; text: string }[];
  skills: { category: string; items: string[] }[];
  experience: {
    role: string;
    company: string | null;
    period: string;
    context?: string;
    points: string[];
    tech: string[];
  }[];
  projects: PersonProject[];
  certifications: { title: string; issuer: string }[];
  education: {
    college: string;
    qualification: string;
    period: string;
    score: string;
    location?: string;
  };
  leadership: { title: string; period: string; description: string }[];
  training: { title: string; provider: string; status: string; topics: string[] }[];
}
const ammu: PersonPortfolio = {
  id: "ammu",
  name: "Dudala Amulya",
  displayName: "Amulya",
  nickname: "Ammu",
  initials: "DA",
  portrait: "/images/profiles/amulya/amulya_main.webp",
  gallery: [
    { src: "/images/profiles/amulya/amulya_1.webp", alt: "Amulya, portrait photo" },
    { src: "/images/profiles/amulya/amulya_2.webp", alt: "Amulya, portrait photo" },
  ],
  headline: "Data Analytics | AI & Machine Learning",
  story: "Turning structured data into useful insights and practical applications.",
  summary:
    "Information Technology graduate with hands-on experience in software development, data analytics, and AI-driven applications through internship and academic projects. Skilled in Python, JavaScript, MERN Stack, REST APIs, SQL, Excel, and Power BI, with applied knowledge of Machine Learning and Generative AI. Experienced in developing web applications, integrating data-driven functionality, building analytical dashboards, and working with structured datasets. Seeking to contribute to practical software and data solutions while continuing to grow across software development, analytics, and AI.",
  email: "amulyagouddudala1229@gmail.com",
  phone: "+91 7995594166",
  socialLabels: [
    { platform: "LinkedIn", handle: "Dudala-Amulya" },
    { platform: "GitHub", handle: "amulya-1229" },
  ],
  strengths: [
    { title: "Business data, made clear", text: "SQL · Python · Power BI · KPI dashboards" },
    { title: "End-to-end applications", text: "MERN Stack · Django · REST APIs" },
    { title: "Applied intelligence", text: "Machine Learning · Generative AI · RAG" },
  ],
  skills: [
    { category: "Programming", items: ["Python", "JavaScript", "OOP"] },
    {
      category: "Software development",
      items: ["MERN Stack", "React.js", "Git", "JSON", "Django", "REST APIs"],
    },
    {
      category: "Data & analytics",
      items: [
        "SQL",
        "Excel",
        "Google Sheets",
        "Power BI",
        "Pandas",
        "NumPy",
        "Data validation",
        "KPI tracking",
        "Data handling",
      ],
    },
    {
      category: "Machine learning",
      items: ["Scikit-learn", "Supervised learning", "Unsupervised learning", "NLP"],
    },
    {
      category: "AI & Generative AI",
      items: [
        "Prompt engineering",
        "LLMs",
        "RAG",
        "AI agents",
        "Generative AI",
        "LangChain",
        "TensorFlow",
      ],
    },
    {
      category: "Databases & tools",
      items: ["PostgreSQL", "MongoDB", "Google Colab", "VS Code", "MS Office", "Pinecone"],
    },
    {
      category: "Professional skills",
      items: [
        "Communication",
        "Problem-solving",
        "Attention to detail",
        "Team collaboration",
        "Multitasking",
        "Documentation",
      ],
    },
  ],
  experience: [
    {
      role: "Data Analytics Intern",
      company: "ThinkMates Pvt. Ltd.",
      period: "Apr 2025–Jun 2025",
      context: "Team Lead (Intern)",
      points: [
        "Analyzed sales, supply-chain, product-quality, and customer datasets to identify trends, reduce returns, and support cost optimization.",
        "Built KPI dashboards using Power BI, Excel, Python, and SQL to improve reporting visibility and operational decision-making.",
        "Worked with structured business data to maintain consistency and deliver insights within timelines.",
        "Coordinated the intern team and supported timely execution of analysis and reporting tasks.",
      ],
      tech: ["Power BI", "Excel", "Python", "SQL"],
    },
  ],
  projects: [
    {
      slug: "data-analysis-ai",
      title: "Data Analysis and Visualization with AI",
      context: "Academic Project · 2025–2026 · Team Lead",
      overview:
        "A secure web/mobile application combining data visualization, real-time dashboards, Python analytics, and an AI chatbot for interactive learning.",
      points: [
        "Created real-time dashboards using Power BI, Chart.js, and Plotly.",
        "Combined Python analytics and an AI learning chatbot with a MERN Stack application.",
        "Used JWT, OAuth2, bcrypt, and Helmet.js for application security.",
        "Coordinated development tasks, dashboard planning, and feature execution.",
      ],
      tech: [
        "MERN Stack",
        "Python",
        "Power BI",
        "Chart.js",
        "Plotly",
        "JWT",
        "OAuth2",
        "bcrypt",
        "Helmet.js",
      ],
    },
    {
      slug: "aurum-restaurant",
      title: "Aurum: Indian Restaurant Web Application",
      context: "Personal Project",
      overview:
        "A full-stack restaurant application bringing menu discovery, ordering, reservations, business analytics, and an AI chat assistant together.",
      points: [
        "Menu browsing with category and veg/non-veg filters, cart, checkout, and order tracking.",
        "Relational database for menu, orders, reservations, users, and reviews.",
        "Reservation availability checks with admin approval.",
        "Pandas and Plotly analytics for best-selling dishes, peak order hours, and revenue trends.",
        "AI chat assistant across pages for dish details, prices, spice levels, hours, and reservations using a streaming server route.",
      ],
      tech: [
        "Python",
        "Django",
        "PostgreSQL",
        "HTML",
        "CSS",
        "Bootstrap",
        "JavaScript",
        "Pandas",
        "Plotly",
      ],
    },
  ],
  certifications: [
    { title: "AI Foundations Associate", issuer: "Oracle" },
    { title: "Multicloud Architect Professional", issuer: "Oracle" },
    { title: "Virtual Internship Program", issuer: "ServiceNow" },
    { title: "AI Tools Workshop", issuer: "Be10X" },
    { title: "Joy of Python", issuer: "NPTEL" },
    { title: "Python for Data Science", issuer: "NPTEL" },
    { title: "Introduction to Machine Learning", issuer: "NPTEL" },
  ],
  education: {
    college: "TKR College of Engineering and Technology",
    qualification: "B.Tech Information Technology",
    period: "2022–2026",
    score: "GPA 8.5/10",
  },
  leadership: [
    {
      title: "Class Representative, IT Branch",
      period: "2022–2026",
      description:
        "Managed academic and extracurricular activities and communication between students and faculty at TKR College of Engineering and Technology.",
    },
    {
      title: "Student Coordinator, IT Branch",
      period: "2022–2026",
      description:
        "Arranged academic and extracurricular activities and supported issue resolution at TKR College of Engineering and Technology.",
    },
  ],
  training: [
    {
      title: "Data Science with Gen AI",
      provider: "DataTeach.ai",
      status: "Ongoing",
      topics: [
        "Python Programming Fundamentals",
        "Mathematics and Statistics for Data Science",
        "Data Analysis and Visualization",
        "Machine Learning and Deep Learning",
        "NLP and Computer Vision",
        "Generative AI and LLMs",
      ],
    },
  ],
};
const sai: PersonPortfolio = {
  id: "sai",
  name: "Dendi Sai Prakash Reddy",
  displayName: "Sai",
  nickname: "Darling",
  initials: "DS",
  portrait: "/images/profiles/sai/sai_main.png",
  gallery: [
    { src: "/images/profiles/sai/sai_1.jpeg", alt: "Sai, portrait photo" },
    { src: "/images/profiles/sai/sai_2.jpeg", alt: "Sai, portrait photo" },
  ],
  headline: "Software Engineer | Web Development",
  story: "Interactive websites. Responsive interfaces. Thoughtful problem-solving.",
  summary:
    "Passionate about software engineering, with experience in Python, JavaScript, and React.js. Builds interactive websites, responsive user interfaces, and API integrations for a seamless user experience. Brings analytical and problem-solving skills, proficiency in Git, and motivation to use technical skills to address real-life problems.",
  email: "dendisaiprakashreddy@gmail.com",
  phone: "+91 9493224565",
  socialLabels: [
    { platform: "LinkedIn", handle: null },
    { platform: "GitHub", handle: null },
  ],
  strengths: [
    { title: "Interfaces that respond", text: "HTML · CSS · JavaScript · React.js" },
    { title: "Connected web experiences", text: "API integrations · Node.js · Git" },
    { title: "Analytical problem-solving", text: "Python · Machine learning · Explainability" },
  ],
  skills: [
    { category: "Programming & web", items: ["Python", "HTML", "CSS", "JavaScript"] },
    { category: "Libraries & frameworks", items: ["React.js", "Node.js"] },
    { category: "Tools & platforms", items: ["Git", "GitHub", "VS Code"] },
    {
      category: "Professional skills",
      items: ["Problem-solving mindset", "Clear communication", "Teamwork", "Leadership"],
    },
  ],
  experience: [
    {
      role: "Web Development Intern",
      company: null,
      period: "Jul 2025–Aug 2025",
      points: [
        "Designed and implemented a responsive modern landing page for desktop and mobile.",
        "Created and launched a portfolio website showcasing projects and professional skills.",
        "Developed and deployed a functional calculator web app with interactive behavior and design functionality.",
      ],
      tech: ["Web development", "Responsive UI"],
    },
  ],
  projects: [
    {
      slug: "liver-disease-prediction",
      title:
        "Liver Disease Prediction Using Optimised Feature Selection and Data Balancing Techniques",
      context: "Academic / technical ML project",
      overview:
        "A prediction system combining patient-data preprocessing, LightGBM, feature selection, data balancing, and an explainable Flask interface.",
      points: [
        "Built a prediction system using LightGBM based on actual patient data with preprocessing.",
        "Applied Recursive Feature Elimination (RFE) and SMOTE-ENN for feature selection and data balancing.",
        "Built a Flask web app accepting health details and returning real-time predictions.",
        "Added SHAP explainability to show how input features affect predictions.",
      ],
      tech: ["Python", "LightGBM", "RFE", "SMOTE-ENN", "Flask", "SHAP"],
      caution:
        "Academic / technical machine-learning project. Not medical advice, a clinical diagnosis, or a substitute for a qualified healthcare professional.",
    },
    {
      slug: "weather-app",
      title: "Weather Web App",
      context: "Web Development Project",
      overview:
        "A responsive weather application integrating the OpenWeatherMap API for current conditions and forecasts up to five days.",
      points: [
        "Built a responsive interface with HTML5, CSS3, and JavaScript.",
        "Integrated OpenWeatherMap API for current weather and forecasts up to 5 days.",
      ],
      tech: ["HTML5", "CSS3", "JavaScript", "OpenWeatherMap API"],
    },
    {
      slug: "todo-app",
      title: "To-Do List Web App",
      context: "Web Development Project",
      overview:
        "An interactive, responsive task manager with a card-grid layout and local persistence for tasks and preferences.",
      points: [
        "Supports adding, managing, and removing tasks.",
        "Persists tasks and preferences using local storage.",
        "Organizes tasks in a responsive card grid.",
      ],
      tech: ["JavaScript", "Local storage", "Responsive UI"],
    },
  ],
  certifications: [
    {
      title: "Oracle Cloud Infrastructure Certified Generative AI Professional",
      issuer: "Oracle University",
    },
    { title: "Introduction to Machine Learning", issuer: "NPTEL" },
  ],
  education: {
    college: "TKR College of Engineering and Technology",
    location: "Meerpet, Telangana",
    qualification: "B.Tech Information Technology",
    period: "Nov 2022–May 2026",
    score: "CGPA 8.23/10",
  },
  leadership: [],
  training: [],
};
const bava: PersonPortfolio = {
  id: "bava",
  name: "E. Anjini Kumar",
  displayName: "Anjini",
  nickname: "Bava",
  initials: "EK",
  portrait: "/images/profiles/anjini/anjini_main.jpg",
  gallery: [
    { src: "/images/profiles/anjini/anjini_1.jpg", alt: "Anjini Kumar, portrait photo" },
    { src: "/images/profiles/anjini/anjini_2.jpg", alt: "Anjini Kumar, portrait photo" },
  ],
  headline: "Data Analyst | Excel, SQL, Power BI & Python",
  story: "Turning business data into clear dashboards, reliable reporting, and actionable insights.",
  summary:
    "Entry-level Data Analyst with a B.Tech in Information Technology and experience as a Data Analytics Intern and team lead. Skilled in data analysis, data validation, visualization, and KPI reporting using Microsoft Excel, SQL, Power BI, and Python. Focused on accuracy, consistency, structured problem-solving, and communicating useful findings from business data.",
  email: "anjinikumaretikala@gmail.com",
  phone: "+91 6303392505",
  socialLabels: [],
  strengths: [
    { title: "Reliable data quality", text: "Data validation · Quality checking · KPI tracking" },
    { title: "Dashboards that explain", text: "Power BI · Excel · Plotly · Chart.js" },
    { title: "Analysis with Python", text: "Python · pandas · NumPy · SQL" },
  ],
  skills: [
    {
      category: "Data analysis & quality",
      items: ["Data Analysis", "Data Validation", "Data Quality Checking", "KPI Tracking", "Structured Analysis", "Reporting"],
    },
    {
      category: "Visualization & business intelligence",
      items: ["Power BI", "Interactive Dashboards", "Matplotlib", "Chart.js", "Plotly", "Microsoft Excel", "Pivot Tables", "VLOOKUP", "Formulas"],
    },
    {
      category: "Programming & databases",
      items: ["Python", "pandas", "NumPy", "JavaScript", "SQL", "SQL Queries", "SQL Joins", "MongoDB"],
    },
    {
      category: "AI & web application exposure",
      items: ["Generative AI", "Prompt Engineering", "AI-Assisted Analysis", "AI Chatbot Concepts", "MERN Stack", "JWT", "bcrypt", "Helmet.js", "OAuth2"],
    },
    {
      category: "Productivity & professional",
      items: ["MS Office", "Documentation", "Image/Video Auditing", "Attention to Detail", "Analytical Thinking", "Problem Solving", "Teamwork", "Communication", "Adaptability"],
    },
  ],
  experience: [
    {
      role: "Data Analytics Intern",
      company: "ThinkMates Pvt. Ltd.",
      period: "Apr 2025–Jun 2025",
      context: "Team Lead (Intern)",
      points: [
        "Analyzed sales, supply-chain, product-quality, and customer datasets to identify trends, reduce returns, and support cost optimization.",
        "Built KPI dashboards using Power BI, Excel, Python, and SQL to improve reporting visibility and support operational decision-making.",
        "Worked with structured business data to maintain consistency in analysis outputs and deliver insights within timelines.",
        "Coordinated the intern team and supported timely execution of analysis and reporting activities.",
      ],
      tech: ["Power BI", "Excel", "Python", "SQL"],
    },
  ],
  projects: [
    {
      slug: "data-analysis-ai",
      title: "Data Analysis and Visualization with AI",
      context: "Academic Project · 2025–2026",
      overview:
        "An interactive web and mobile application concept combining data analysis, dashboards, and an AI chatbot to help users explore data and learn visualization techniques.",
      points: [
        "Designed dashboard capabilities using Power BI, Chart.js, and Plotly for interactive data visualization.",
        "Applied Python-based analysis to interpret datasets and support data-driven reporting.",
        "Included an AI chatbot concept to support learning about analytics and data visualization.",
        "Applied MERN Stack and application-security technologies including MongoDB, JWT, bcrypt, Helmet.js, and OAuth2.",
      ],
      tech: ["Python", "MERN Stack", "MongoDB", "Power BI", "Chart.js", "Plotly", "JWT", "bcrypt", "Helmet.js", "OAuth2"],
    },
  ],
  certifications: [
    { title: "Website UI/UX Designing using ChatGPT", issuer: "Simplilearn" },
    { title: "Generative AI Studio", issuer: "Simplilearn" },
    { title: "Introduction to Prompt Engineering Fundamentals", issuer: "Simplilearn" },
  ],
  education: {
    college: "TKR College of Engineering and Technology",
    qualification: "B.Tech Information Technology",
    period: "2022–2026",
    score: "GPA 6.0",
  },
  leadership: [
    {
      title: "Student Coordinator, IT Branch",
      period: "2022–2026",
      description:
        "Organized and led technical events involving 250+ participants, supporting coordination, communication, teamwork, and student collaboration at TKR College of Engineering and Technology.",
    },
  ],
  training: [],
};
export const PERSON_PORTFOLIOS: Record<"ammu" | "sai" | "bava", PersonPortfolio> = { ammu, bava, sai };
export function getPersonPortfolio(id: string): PersonPortfolio | undefined {
  return id === "ammu" || id === "bava" || id === "sai" ? PERSON_PORTFOLIOS[id] : undefined;
}
export function isPerson(id: string): id is PersonId {
  return PEOPLE.some((person) => person.id === id);
}
export function getPersonProject(person: string, slug: string) {
  return getPersonPortfolio(person)?.projects.find((project) => project.slug === slug);
}
export function personHead(person: string, page: string, description: string, path: string) {
  const name =
    getPersonPortfolio(person)?.name ?? (person === "bava" ? "Anjini (Bava)" : "Guda Abhishek");
  const title = `${page} — ${name}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: path },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: path }],
  };
}
