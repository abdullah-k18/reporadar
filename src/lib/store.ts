"use client";

import { useCallback, useSyncExternalStore } from "react";
import { defaultSettings, emptyProfile, type Profile, type Recommendation, type Settings } from "./types";

// Everything lives in the browser. No database, no account — the CV and the
// user's API keys never sit on a server we don't control.

const KEY = "reporadar:v1";

export interface RadarData {
  profile: Profile;
  settings: Settings;
  seen: string[]; // every repo ever shown — never shown again
  rejected: string[]; // repos the user said "not for me" to
  saved: Recommendation[];
  current: Recommendation[]; // last batch, so a reload keeps the results
}

const emptyData: RadarData = {
  profile: emptyProfile,
  settings: defaultSettings,
  seen: [],
  rejected: [],
  saved: [],
  current: [],
};

// Headers that carry the user's own keys to our API routes for one request.
export function apiHeaders(s: Settings): Record<string, string> {
  const h: Record<string, string> = { "x-llm-provider": s.provider, "x-llm-model": s.model };
  if (s.llmKey) h["x-llm-key"] = s.llmKey;
  if (s.githubToken) h["x-github-token"] = s.githubToken;
  return h;
}

function read(): RadarData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyData;
    return normalize(JSON.parse(raw));
  } catch {
    return emptyData;
  }
}

function normalize(input: unknown): RadarData {
  const d = (input ?? {}) as Partial<RadarData>;
  return {
    profile: { ...emptyProfile, ...(d.profile ?? {}) },
    settings: { ...defaultSettings, ...(d.settings ?? {}) },
    seen: Array.isArray(d.seen) ? d.seen : [],
    rejected: Array.isArray(d.rejected) ? d.rejected : [],
    saved: Array.isArray(d.saved) ? d.saved : [],
    current: Array.isArray(d.current) ? d.current : [],
  };
}

// A tiny external store over localStorage. The server snapshot is null, so the
// first (hydration) render matches the server and real data arrives right after.
let cache: RadarData | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): RadarData {
  if (cache === null) cache = read();
  return cache;
}

function setStore(next: RadarData) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked — app keeps working in memory.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRadarStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const ready = snapshot !== null;
  const data = snapshot ?? emptyData;

  const update = useCallback((fn: (d: RadarData) => RadarData) => setStore(fn(getSnapshot())), []);

  const exportJSON = useCallback(() => {
    // API keys are deliberately left out so a backup file never leaks secrets.
    const { settings, ...rest } = data;
    const payload = {
      app: "reporadar",
      version: 1,
      exportedAt: new Date().toISOString(),
      ...rest,
      settings: { provider: settings.provider, model: settings.model },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const who = data.profile.name.trim().toLowerCase().replace(/\s+/g, "-") || "profile";
    a.download = `reporadar-${who}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [data]);

  const importJSON = useCallback(async (file: File) => {
    const parsed = JSON.parse(await file.text());
    if (parsed?.app !== "reporadar") throw new Error("That file isn't a RepoRadar export.");
    const current = getSnapshot().settings;
    const next = normalize(parsed);
    // Keep the keys already on this device; take provider/model from the file.
    setStore({ ...next, settings: { ...next.settings, llmKey: current.llmKey, githubToken: current.githubToken } });
  }, []);

  return { data, ready, update, exportJSON, importJSON };
}
