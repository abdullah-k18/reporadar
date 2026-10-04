import { chatJSON, llmConfigFrom } from "@/lib/llm";
import { openUnassignedIssues, searchRepos, userLanguages, type RepoCandidate } from "@/lib/github";
import type { Level, Profile, Recommendation } from "@/lib/types";

const LEVELS: Level[] = ["entry", "mid", "big"];
const MAX_COUNT = 8;

interface Body {
  profile: Profile;
  level: Level;
  exclude: string[];
  count?: number;
}

function describeProfile(p: Profile, ghLanguages: string[]): string {
  return [
    `Name: ${p.name || "unknown"}`,
    `Headline: ${p.headline}`,
    `Years of experience: ${p.yearsExperience || "unknown"}`,
    `Languages: ${p.languages.join(", ")}`,
    ghLanguages.length ? `Languages seen in their own GitHub repos: ${ghLanguages.join(", ")}` : "",
    `Skills: ${p.skills.join(", ")}`,
    `Interests: ${p.interests.join(", ")}`,
    p.experience.length
      ? `Experience: ${p.experience.map((e) => `${e.role} at ${e.org} (${e.duration}): ${e.summary}`).join("; ")}`
      : "",
    p.certifications.length
      ? `Certifications: ${p.certifications.map((c) => `${c.name} — ${c.issuer} ${c.year}`).join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  try {
    const { profile, level, exclude = [], count = 5 }: Body = await request.json();
    if (!profile || !LEVELS.includes(level)) {
      return Response.json({ error: "Missing profile or invalid level." }, { status: 400 });
    }
    const want = Math.min(Math.max(1, count), MAX_COUNT);
    const excluded = new Set(exclude.map((s) => s.toLowerCase()));
    const llm = llmConfigFrom(request);
    const ghToken = request.headers.get("x-github-token")?.trim() || undefined;

    const ghLanguages = profile.githubUsername
      ? await userLanguages(profile.githubUsername, ghToken).catch(() => [])
      : [];
    const who = describeProfile(profile, ghLanguages);

    // 1. Open model turns the profile into GitHub search terms.
    const terms = await chatJSON<{ languages: string[]; topics: string[] }>(
      llm,
      `You turn a developer profile into GitHub repository search terms.
Return {"languages": string[] (max 3, GitHub language names like "TypeScript", "Python", "Go"),
"topics": string[] (max 3, lowercase GitHub topic slugs like "react", "machine-learning", "cli")}.
Prefer what they already know well, plus their stated interests.`,
      who,
    );

    // 2. GitHub supplies the real repos — the model never invents any.
    const candidates = (await searchRepos(level, terms, ghToken)).filter(
      (r) => !excluded.has(r.fullName.toLowerCase()),
    );
    if (candidates.length === 0) {
      return Response.json({
        recommendations: [],
        note: "No new repos found for this level. Try another level or reset your seen list.",
      });
    }

    // 3. Open model shortlists the best fits (extra picks in case some have no open issues).
    const byName = new Map(candidates.map((c) => [c.fullName.toLowerCase(), c]));
    const list = candidates
      .slice(0, 60)
      .map((c) => `${c.fullName} | ${c.language ?? "?"} | ★${c.stars} | ${c.topics.slice(0, 5).join(",")} | ${c.description.slice(0, 120)}`)
      .join("\n");

    let shortlist: RepoCandidate[] = [];
    try {
      const picked = await chatJSON<{ picks: string[] }>(
        llm,
        `You match a developer to open-source repositories they could contribute to.
From the candidate list, choose the ${want + 3} best fits for this person's skills, experience and interests, best first.
Return {"picks": string[]} using the exact "owner/repo" names from the list.`,
        `PROFILE\n${who}\n\nCANDIDATES (name | language | stars | topics | description)\n${list}`,
      );
      shortlist = picked.picks
        .map((n) => byName.get(String(n).toLowerCase()))
        .filter((c): c is RepoCandidate => Boolean(c));
    } catch {
      // Fall through to the star-sorted fallback below.
    }
    if (shortlist.length < want) {
      const rest = candidates
        .filter((c) => !shortlist.includes(c))
        .sort((a, b) => b.stars - a.stars);
      shortlist = [...shortlist, ...rest].slice(0, want + 3);
    }

    // 4. Keep only repos that actually have open, unassigned issues right now.
    const checked = await Promise.all(
      shortlist.map(async (repo) => ({
        repo,
        issues: await openUnassignedIssues(repo.fullName, ghToken).catch(() => []),
      })),
    );
    const withIssues = checked.filter((c) => c.issues.length > 0).slice(0, want);

    // 5. Open model explains each match in plain words.
    const explainInput = withIssues
      .map(({ repo, issues }) =>
        [
          `REPO ${repo.fullName} (${repo.language ?? "?"}, ★${repo.stars}): ${repo.description}`,
          ...issues.map((i) => `  - #${i.number} ${i.title} [${i.labels.join(", ")}]`),
        ].join("\n"),
      )
      .join("\n\n");

    let notes: Record<string, { whyItFits: string; starterTip: string }> = {};
    try {
      const explained = await chatJSON<{
        repos: { fullName: string; whyItFits: string; starterTip: string }[];
      }>(
        llm,
        `You are a friendly mentor helping someone make their first open-source contributions.
For each repo, write:
- "whyItFits": 2 sentences linking the repo to THIS person's specific skills, experience or certifications.
- "starterTip": 1 sentence naming which listed issue to start with and why.
Return {"repos": [{"fullName": string, "whyItFits": string, "starterTip": string}]}.`,
        `PROFILE\n${who}\n\n${explainInput}`,
      );
      notes = Object.fromEntries(explained.repos.map((r) => [r.fullName.toLowerCase(), r]));
    } catch {
      // Cards still render without the explanation.
    }

    const now = new Date().toISOString();
    const recommendations: Recommendation[] = withIssues.map(({ repo, issues }) => {
      const n = notes[repo.fullName.toLowerCase()];
      return {
        fullName: repo.fullName,
        url: repo.url,
        description: repo.description,
        language: repo.language,
        stars: repo.stars,
        topics: repo.topics,
        whyItFits: n?.whyItFits ?? "",
        starterTip: n?.starterTip ?? "",
        issues,
        level,
        foundAt: now,
      };
    });

    return Response.json({ recommendations, searchedFor: terms });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
