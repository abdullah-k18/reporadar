"use client";

import { useEffect, useRef, useState } from "react";
import { ProfileForm } from "@/components/ProfileForm";
import { RepoCard } from "@/components/RepoCard";
import { SettingsForm } from "@/components/SettingsForm";
import { apiHeaders, useRadarStore } from "@/lib/store";
import type { Level, Recommendation } from "@/lib/types";

type Tab = "find" | "profile" | "saved" | "settings";

const LEVELS: { id: Level; label: string; hint: string }[] = [
  { id: "entry", label: "Entry level", hint: "Smaller repos with good-first-issues" },
  { id: "mid", label: "Mid level", hint: "Established projects asking for help" },
  { id: "big", label: "Big projects", hint: "Well-known, 25k+ stars" },
];

export default function Home() {
  const { data, ready, update, exportJSON, importJSON } = useRadarStore();
  const [tab, setTab] = useState<Tab | null>(null);
  const [level, setLevel] = useState<Level>("entry");
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [importCount, setImportCount] = useState(0);
  const [serverLLM, setServerLLM] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => setServerLLM(Boolean(s.serverLLM)))
      .catch(() => {});
  }, []);

  const hasKey = Boolean(data.settings.llmKey) || serverLLM;
  const hasProfile = data.profile.languages.length + data.profile.skills.length > 0;
  const activeTab: Tab = tab ?? (!hasKey ? "settings" : hasProfile ? "find" : "profile");
  const savedNames = new Set(data.saved.map((r) => r.fullName));

  async function find() {
    setLoading(true);
    setNote(null);
    try {
      const exclude = [...new Set([...data.seen, ...data.rejected, ...savedNames])];
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...apiHeaders(data.settings) },
        body: JSON.stringify({ profile: data.profile, level, exclude, count: 5 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      const recs: Recommendation[] = json.recommendations;
      update((d) => ({
        ...d,
        current: recs,
        seen: [...new Set([...d.seen, ...recs.map((r) => r.fullName)])],
      }));
      if (json.note) setNote(json.note);
      else if (recs.length === 0) setNote("Nothing new this time. Try a different level.");
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function reject(rec: Recommendation) {
    update((d) => ({
      ...d,
      current: d.current.filter((r) => r.fullName !== rec.fullName),
      rejected: [...new Set([...d.rejected, rec.fullName])],
    }));
  }

  function save(rec: Recommendation) {
    update((d) => (d.saved.some((r) => r.fullName === rec.fullName) ? d : { ...d, saved: [rec, ...d.saved] }));
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3 py-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-accent">◉</span> RepoRadar
          </h1>
          <p className="text-sm text-muted">Open-source projects that fit you, with issues you can pick up today.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={exportJSON} disabled={!ready}>Export JSON</button>
          <button className="btn" onClick={() => importRef.current?.click()}>Import JSON</button>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                await importJSON(f);
                setImportCount((n) => n + 1);
                setNote("Profile imported.");
              } catch (err) {
                setNote((err as Error).message);
              }
            }}
          />
        </div>
      </header>

      <nav className="mb-6 flex gap-1 border-b border-line">
        {(
          [
            ["find", "Find repos"],
            ["profile", "My profile"],
            ["saved", `Saved (${data.saved.length})`],
            ["settings", hasKey ? "Settings" : "Settings ●"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              activeTab === id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {!ready ? null : activeTab === "settings" ? (
        <SettingsForm
          key={importCount}
          settings={data.settings}
          serverLLM={serverLLM}
          onSave={(s) => update((d) => ({ ...d, settings: s }))}
        />
      ) : activeTab === "profile" ? (
        <ProfileForm
          key={importCount}
          profile={data.profile}
          headers={apiHeaders(data.settings)}
          onSave={(p) => update((d) => ({ ...d, profile: p }))}
        />
      ) : activeTab === "saved" ? (
        <div className="space-y-4">
          {data.saved.length === 0 && <p className="text-sm text-muted">Repos you save show up here.</p>}
          {data.saved.map((r) => (
            <RepoCard
              key={r.fullName}
              rec={r}
              onUnsave={() => update((d) => ({ ...d, saved: d.saved.filter((x) => x.fullName !== r.fullName) }))}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {!hasKey ? (
            <div className="rounded-xl border border-line bg-surface p-5 text-sm">
              First, add a free API key so the open model can do the matching.{" "}
              <button className="font-medium text-accent" onClick={() => setTab("settings")}>Open settings →</button>
            </div>
          ) : !hasProfile ? (
            <div className="rounded-xl border border-line bg-surface p-5 text-sm">
              Add your skills first so the radar knows what to look for.{" "}
              <button className="font-medium text-accent" onClick={() => setTab("profile")}>Set up profile →</button>
            </div>
          ) : (
            <section className="rounded-xl border border-line bg-surface p-5">
              <p className="text-sm text-muted">
                Searching for <span className="font-medium text-ink">{data.profile.name || "you"}</span>
                {" · "}
                {[...data.profile.languages, ...data.profile.skills].slice(0, 6).join(", ")}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {LEVELS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLevel(l.id)}
                    className={`rounded-lg border p-3 text-left ${
                      level === l.id ? "border-accent bg-accent-soft" : "border-line hover:border-accent"
                    }`}
                  >
                    <div className="text-sm font-medium">{l.label}</div>
                    <div className="text-xs text-muted">{l.hint}</div>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button className="btn btn-primary" onClick={find} disabled={loading}>
                  {loading ? "Scanning GitHub…" : data.current.length ? "Find 5 more" : "Find 5 repos"}
                </button>
                <span className="text-xs text-muted">
                  {data.seen.length} shown so far · {data.rejected.length} skipped. You won&apos;t see these again.
                </span>
                {data.seen.length > 0 && (
                  <button
                    className="text-xs text-muted underline hover:text-ink"
                    onClick={() => update((d) => ({ ...d, seen: [], current: [] }))}
                  >
                    Reset shown list
                  </button>
                )}
              </div>
              {loading && (
                <p className="mt-3 text-xs text-muted">
                  Reading your profile, searching GitHub, checking for open unassigned issues… this takes ~15s.
                </p>
              )}
            </section>
          )}

          {note && <p className="text-sm text-muted">{note}</p>}

          {data.current.map((r) => (
            <RepoCard
              key={r.fullName}
              rec={r}
              saved={savedNames.has(r.fullName)}
              onSave={() => save(r)}
              onReject={() => reject(r)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
