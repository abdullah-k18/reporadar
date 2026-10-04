"use client";

import { useState } from "react";
import { TagInput } from "./TagInput";
import type { Certification, Experience, Profile } from "@/lib/types";

function union(a: string[], b: string[] = []) {
  const out = [...a];
  for (const x of b) if (x && !out.some((y) => y.toLowerCase() === x.toLowerCase())) out.push(x);
  return out;
}

export function ProfileForm({
  profile,
  headers,
  onSave,
}: {
  profile: Profile;
  headers: Record<string, string>;
  onSave: (p: Profile) => void;
}) {
  const [draft, setDraft] = useState<Profile>(profile);
  const [parsing, setParsing] = useState(false);
  const [pasted, setPasted] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function parseCV(file?: File) {
    setParsing(true);
    setMsg(null);
    try {
      const form = new FormData();
      if (file) form.append("file", file);
      else form.append("text", pasted);
      const res = await fetch("/api/parse-cv", { method: "POST", body: form, headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't read the CV.");
      const x = json.profile as Partial<Profile>;
      setDraft((d) => ({
        ...d,
        name: d.name || x.name || "",
        headline: d.headline || x.headline || "",
        yearsExperience: d.yearsExperience || x.yearsExperience || "",
        portfolioUrl: d.portfolioUrl || x.portfolioUrl || "",
        githubUsername: d.githubUsername || x.githubUsername || "",
        languages: union(d.languages, x.languages),
        skills: union(d.skills, x.skills),
        interests: union(d.interests, x.interests),
        experience: d.experience.length ? d.experience : (x.experience ?? []),
        certifications: d.certifications.length ? d.certifications : (x.certifications ?? []),
        cvText: json.cvText,
      }));
      setMsg({ kind: "ok", text: "CV read. Check the details below, then press Save profile." });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setParsing(false);
    }
  }

  function save() {
    onSave({ ...draft, updatedAt: new Date().toISOString() });
    setMsg({ kind: "ok", text: "Profile saved in this browser." });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-semibold">1. Start from your CV (optional)</h2>
        <p className="mt-1 text-sm text-muted">
          An open-weight model reads it and fills in the form. You can edit everything afterwards.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="btn btn-primary">
            {parsing ? "Reading…" : "Upload CV (PDF)"}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={parsing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) parseCV(f);
                e.target.value = "";
              }}
            />
          </label>
          <span className="text-sm text-muted">or paste it:</span>
        </div>
        <textarea
          className="field mt-3 h-24"
          placeholder="Paste CV text here…"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
        />
        <button className="btn mt-2" disabled={parsing || pasted.trim().length < 50} onClick={() => parseCV()}>
          Read pasted CV
        </button>
        {draft.cvText && <p className="mt-2 text-xs text-muted">CV on file ({draft.cvText.length} characters).</p>}
      </section>

      <section className="rounded-xl border border-line bg-surface p-5 space-y-4">
        <h2 className="font-semibold">2. About you</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Name" value={draft.name} onChange={(v) => set("name", v)} />
          <Text label="Years of experience" value={draft.yearsExperience} onChange={(v) => set("yearsExperience", v)} placeholder="e.g. 0-1, 3, 5+" />
          <div className="sm:col-span-2">
            <Text label="Headline" value={draft.headline} onChange={(v) => set("headline", v)} placeholder="e.g. CS student into web dev and ML" />
          </div>
          <Text label="GitHub username" value={draft.githubUsername} onChange={(v) => set("githubUsername", v.replace(/^.*github\.com\//, "").replace(/\/$/, ""))} placeholder="Used to cross-check the languages you actually write" />
          <Text label="Portfolio link" value={draft.portfolioUrl} onChange={(v) => set("portfolioUrl", v)} placeholder="https://…" />
        </div>
        <TagInput label="Programming languages" values={draft.languages} onChange={(v) => set("languages", v)} placeholder="TypeScript, Python…" />
        <TagInput label="Skills & tools" values={draft.skills} onChange={(v) => set("skills", v)} placeholder="React, Docker, SQL…" />
        <TagInput label="Interests" values={draft.interests} onChange={(v) => set("interests", v)} placeholder="devtools, education, games, AI…" />
      </section>

      <section className="rounded-xl border border-line bg-surface p-5 space-y-3">
        <h2 className="font-semibold">3. Experience</h2>
        {draft.experience.map((e, i) => (
          <Row
            key={i}
            onRemove={() => set("experience", draft.experience.filter((_, j) => j !== i))}
          >
            <input className="field" placeholder="Role" value={e.role} onChange={(ev) => set("experience", patch(draft.experience, i, { role: ev.target.value }))} />
            <input className="field" placeholder="Company / project" value={e.org} onChange={(ev) => set("experience", patch(draft.experience, i, { org: ev.target.value }))} />
            <input className="field" placeholder="Duration" value={e.duration} onChange={(ev) => set("experience", patch(draft.experience, i, { duration: ev.target.value }))} />
            <input className="field sm:col-span-3" placeholder="What you did" value={e.summary} onChange={(ev) => set("experience", patch(draft.experience, i, { summary: ev.target.value }))} />
          </Row>
        ))}
        <button className="btn" onClick={() => set("experience", [...draft.experience, { role: "", org: "", duration: "", summary: "" } as Experience])}>
          + Add experience
        </button>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5 space-y-3">
        <h2 className="font-semibold">4. Certifications</h2>
        {draft.certifications.map((c, i) => (
          <Row
            key={i}
            onRemove={() => set("certifications", draft.certifications.filter((_, j) => j !== i))}
          >
            <input className="field" placeholder="Certification" value={c.name} onChange={(ev) => set("certifications", patch(draft.certifications, i, { name: ev.target.value }))} />
            <input className="field" placeholder="Issued by (e.g. Coursera, AWS)" value={c.issuer} onChange={(ev) => set("certifications", patch(draft.certifications, i, { issuer: ev.target.value }))} />
            <input className="field" placeholder="Year" value={c.year} onChange={(ev) => set("certifications", patch(draft.certifications, i, { year: ev.target.value }))} />
          </Row>
        ))}
        <button className="btn" onClick={() => set("certifications", [...draft.certifications, { name: "", issuer: "", year: "" } as Certification])}>
          + Add certification
        </button>
      </section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-bg px-4 py-3">
        <button className="btn btn-primary" onClick={save}>Save profile</button>
        {msg && <span className={`text-sm ${msg.kind === "err" ? "text-danger" : "text-muted"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

function patch<T>(arr: T[], i: number, p: Partial<T>): T[] {
  return arr.map((x, j) => (j === i ? { ...x, ...p } : x));
}

function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input className="field" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Row({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="flex gap-2 rounded-lg border border-line p-3">
      <div className="grid flex-1 gap-2 sm:grid-cols-3">{children}</div>
      <button className="self-start text-muted hover:text-danger" aria-label="Remove" onClick={onRemove}>×</button>
    </div>
  );
}
