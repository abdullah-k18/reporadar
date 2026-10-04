export type Level = "entry" | "mid" | "big";

export interface Experience {
  role: string;
  org: string;
  duration: string;
  summary: string;
}

export interface Certification {
  name: string;
  issuer: string;
  year: string;
}

export interface Profile {
  name: string;
  headline: string;
  yearsExperience: string;
  languages: string[]; // programming languages
  skills: string[]; // frameworks, tools, concepts
  interests: string[]; // domains they care about (e.g. "devtools", "education")
  experience: Experience[];
  certifications: Certification[];
  portfolioUrl: string;
  githubUsername: string;
  cvText: string;
  updatedAt: string;
}

export interface Issue {
  number: number;
  title: string;
  url: string;
  labels: string[];
  comments: number;
  createdAt: string;
}

export interface Recommendation {
  fullName: string; // "owner/repo" — also the stable id we track
  url: string;
  description: string;
  language: string | null;
  stars: number;
  topics: string[];
  whyItFits: string;
  starterTip: string;
  issues: Issue[];
  level: Level;
  foundAt: string;
}

export interface Settings {
  provider: string; // id from PROVIDERS
  llmKey: string;
  model: string;
  githubToken: string;
}

export const defaultSettings: Settings = {
  provider: "groq",
  llmKey: "",
  model: "openai/gpt-oss-120b",
  githubToken: "",
};

export const emptyProfile: Profile = {
  name: "",
  headline: "",
  yearsExperience: "",
  languages: [],
  skills: [],
  interests: [],
  experience: [],
  certifications: [],
  portfolioUrl: "",
  githubUsername: "",
  cvText: "",
  updatedAt: "",
};
