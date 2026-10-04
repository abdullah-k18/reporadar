# ◉ RepoRadar

Find open-source projects that fit **your** skills, with open, unassigned issues you can pick up today.

1. Upload your CV (or fill the form). An open-weight model extracts your languages, skills, experience and certifications.
2. Pick a level: **Entry**, **Mid**, or **Big projects**.
3. Get 5 real repos from GitHub, each with a "why it fits you" note and starter issues.
4. Skip what you don't like. Repos you've already seen never come back.

## How it works

```
Profile ──► open LLM: profile → GitHub search terms
        ──► GitHub API: real repos filtered by level (never invented by the model)
        ──► open LLM: shortlist best fits
        ──► GitHub API: keep repos with open, unassigned issues
        ──► open LLM: explain each match + which issue to start with
```

- **Bring your own key:** in **Settings**, paste a free Groq key and pick a model from the live list. Keys stay in the browser and are never exported. Default model: `openai/gpt-oss-120b` (open-weight). Any other OpenAI-compatible host can be added in `src/lib/providers.ts`.
- **No database, no login:** profile, seen/skipped repos and saved repos live in the browser's localStorage. Use **Export / Import JSON** to back up or move devices.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 → **Settings** → paste a free key (links are in the app).
Server-side fallback keys in `.env.local` are optional (see `.env.example`).

## Deploy on Render

New → Web Service → connect the repo, then:

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment: nothing required. Optionally add `LLM_API_KEY` / `GITHUB_TOKEN` as fallback keys
