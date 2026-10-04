import { extractText, getDocumentProxy } from "unpdf";
import { chatJSON, llmConfigFrom } from "@/lib/llm";
import type { Certification, Experience } from "@/lib/types";

const MAX_PAGES = 10;
const MAX_CHARS = 15000;

interface Extracted {
  name: string;
  headline: string;
  yearsExperience: string;
  languages: string[];
  skills: string[];
  interests: string[];
  experience: Experience[];
  certifications: Certification[];
  portfolioUrl: string;
  githubUsername: string;
}

const SYSTEM = `You extract a developer profile from a CV. Only use facts present in the text; use "" or [] when unknown.
Return JSON with exactly these keys:
{
  "name": string,
  "headline": string (one line, e.g. "Junior frontend developer"),
  "yearsExperience": string (e.g. "2", "0-1", "5+"),
  "languages": string[] (programming languages only, e.g. "TypeScript", "Python"),
  "skills": string[] (frameworks, libraries, tools, concepts),
  "interests": string[] (domains or project types they seem drawn to),
  "experience": [{ "role": string, "org": string, "duration": string, "summary": string (max 20 words) }],
  "certifications": [{ "name": string, "issuer": string, "year": string }],
  "portfolioUrl": string,
  "githubUsername": string (username only, no URL)
}`;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    let text = String(form.get("text") ?? "");

    if (file instanceof File && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) {
        return Response.json({ error: "CV must be under 5 MB." }, { status: 400 });
      }
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      if (pdf.numPages > MAX_PAGES) {
        return Response.json({ error: `CV has more than ${MAX_PAGES} pages.` }, { status: 400 });
      }
      text = (await extractText(pdf, { mergePages: true })).text;
    }

    text = text.replace(/\s+\n/g, "\n").trim().slice(0, MAX_CHARS);
    if (text.length < 50) {
      return Response.json(
        { error: "Couldn't read enough text from that CV. Try pasting it instead." },
        { status: 400 },
      );
    }

    const profile = await chatJSON<Extracted>(llmConfigFrom(request), SYSTEM, text);
    return Response.json({ profile, cvText: text });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
