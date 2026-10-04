import type { Issue, Level } from "./types";

const API = "https://api.github.com";

export interface RepoCandidate {
  fullName: string;
  url: string;
  description: string;
  language: string | null;
  stars: number;
  topics: string[];
  pushedAt: string;
}

function headers(token?: string): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "RepoRadar",
  };
  const t = token || process.env.GITHUB_TOKEN;
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function gh<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: headers(token), cache: "no-store" });
  if (!res.ok) {
    throw new Error(`GitHub ${res.status} on ${path.split("?")[0]}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// Hardcoded size bands so "entry / mid / big" means something concrete.
const LEVEL_FILTERS: Record<Level, { stars: string; issues: string; sort: string }> = {
  entry: { stars: "stars:50..3000", issues: "good-first-issues:>=1", sort: "updated" },
  mid: { stars: "stars:3000..25000", issues: "help-wanted-issues:>=1", sort: "help-wanted-issues" },
  big: { stars: "stars:>=25000", issues: "help-wanted-issues:>=1", sort: "help-wanted-issues" },
};

interface SearchItem {
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  topics?: string[];
  pushed_at: string;
}

export async function searchRepos(
  level: Level,
  terms: { languages: string[]; topics: string[] },
  token?: string,
): Promise<RepoCandidate[]> {
  const f = LEVEL_FILTERS[level];
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const base = `${f.stars} ${f.issues} pushed:>${since} archived:false`;

  // One query per language and per topic keeps each search focused;
  // capped so we stay well inside the search rate limit (30/min with a token).
  const queries = [
    ...terms.languages.slice(0, 3).map((l) => `language:"${l}" ${base}`),
    ...terms.topics.slice(0, 3).map((t) => `topic:${t} ${base}`),
  ];
  if (queries.length === 0) queries.push(base);

  const results = await Promise.allSettled(
    queries.map((q) =>
      gh<{ items: SearchItem[] }>(
        `/search/repositories?q=${encodeURIComponent(q)}&sort=${f.sort}&order=desc&per_page=30`,
        token,
      ),
    ),
  );

  const byName = new Map<string, RepoCandidate>();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const it of r.value.items) {
      if (byName.has(it.full_name)) continue;
      byName.set(it.full_name, {
        fullName: it.full_name,
        url: it.html_url,
        description: it.description ?? "",
        language: it.language,
        stars: it.stargazers_count,
        topics: it.topics ?? [],
        pushedAt: it.pushed_at,
      });
    }
  }

  if (byName.size === 0) {
    const firstError = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    if (firstError) throw firstError.reason;
  }
  return [...byName.values()];
}

// Languages the person actually writes, weighted by how many of their repos use each.
export async function userLanguages(username: string, token?: string): Promise<string[]> {
  const repos = await gh<{ language: string | null; fork: boolean }[]>(
    `/users/${encodeURIComponent(username)}/repos?per_page=100&sort=pushed`,
    token,
  );
  const counts = new Map<string, number>();
  for (const r of repos) {
    if (r.fork || !r.language) continue;
    counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l).slice(0, 6);
}

interface IssueItem {
  number: number;
  title: string;
  html_url: string;
  labels: ({ name?: string } | string)[];
  comments: number;
  created_at: string;
  pull_request?: unknown;
}

const BEGINNER_LABEL = /good.?first|beginner|easy|starter|first.?timer|newcomer|help.?wanted|up.?for.?grabs/i;

// Open, unassigned issues, beginner-friendly labels first.
export async function openUnassignedIssues(fullName: string, token?: string, limit = 3): Promise<Issue[]> {
  const items = await gh<IssueItem[]>(
    `/repos/${fullName}/issues?state=open&assignee=none&sort=created&direction=desc&per_page=40`,
    token,
  );

  const issues: Issue[] = items
    .filter((i) => !i.pull_request)
    .map((i) => ({
      number: i.number,
      title: i.title,
      url: i.html_url,
      labels: i.labels.map((l) => (typeof l === "string" ? l : (l.name ?? ""))).filter(Boolean),
      comments: i.comments,
      createdAt: i.created_at,
    }));

  const friendly = issues.filter((i) => i.labels.some((l) => BEGINNER_LABEL.test(l)));
  return (friendly.length > 0 ? friendly : issues).slice(0, limit);
}
