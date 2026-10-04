"use client";

import { useState } from "react";
import { apiHeaders } from "@/lib/store";
import { GITHUB_TOKEN_URL, PROVIDERS, providerById } from "@/lib/providers";
import type { Settings } from "@/lib/types";

export function SettingsForm({
  settings,
  serverLLM,
  onSave,
}: {
  settings: Settings;
  serverLLM: boolean;
  onSave: (s: Settings) => void;
}) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const provider = providerById(draft.provider) ?? PROVIDERS[0];
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function loadModels() {
    setLoadingModels(true);
    setMsg(null);
    try {
      const res = await fetch("/api/models", { headers: apiHeaders(draft) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't load models.");
      setModels(json.models);
      setMsg({ kind: "ok", text: `Key works. ${json.models.length} models available on ${provider.name}.` });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setLoadingModels(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        RepoRadar runs on <span className="font-medium text-ink">open-weight models</span> served by Groq, with your
        own free key. Keys are stored only in this browser, sent only with your own requests, and
        never included in Export JSON.
      </p>

      <section className="space-y-4 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-semibold">1. AI key ({provider.name})</h2>
        {PROVIDERS.length > 1 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setDraft((d) => ({ ...d, provider: p.id, model: p.defaultModel }));
                setModels([]);
                setMsg(null);
              }}
              className={`rounded-lg border p-3 text-left ${
                draft.provider === p.id ? "border-accent bg-accent-soft" : "border-line hover:border-accent"
              }`}
            >
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs text-muted">{p.note}</div>
            </button>
          ))}
        </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium">{provider.name} API key</label>
            <a href={provider.keyUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent">
              Get a free key →
            </a>
          </div>
          <input
            className="field font-mono"
            type={showKeys ? "text" : "password"}
            autoComplete="off"
            value={draft.llmKey}
            placeholder={serverLLM ? "Optional: this server already has a key" : "Paste your key here"}
            onChange={(e) => set("llmKey", e.target.value.trim())}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Model</label>
          <div className="flex gap-2">
            <input
              className="field font-mono"
              list="model-options"
              value={draft.model}
              onChange={(e) => set("model", e.target.value.trim())}
            />
            <datalist id="model-options">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <button className="btn shrink-0" onClick={loadModels} disabled={loadingModels || (!draft.llmKey && !serverLLM)}>
              {loadingModels ? "Checking…" : "Test key & load models"}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">
            Recommended: <code className="font-mono">{provider.defaultModel}</code> (open-weight, strong at reasoning
            and structured output). Load models to pick from what {provider.name} serves today.
          </p>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">2. GitHub token <span className="text-sm font-normal text-muted">(recommended)</span></h2>
          <a href={GITHUB_TOKEN_URL} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent">
            Create token →
          </a>
        </div>
        <p className="text-sm text-muted">
          Without it GitHub allows only a few searches per minute. On the page that opens, leave every scope{" "}
          <span className="font-medium text-ink">unticked</span> (public data only), choose an expiry, and press
          Generate.
        </p>
        <input
          className="field font-mono"
          type={showKeys ? "text" : "password"}
          autoComplete="off"
          value={draft.githubToken}
          placeholder="ghp_…"
          onChange={(e) => set("githubToken", e.target.value.trim())}
        />
      </section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-bg px-4 py-3">
        <button
          className="btn btn-primary"
          onClick={() => {
            onSave(draft);
            setMsg({ kind: "ok", text: "Settings saved in this browser." });
          }}
        >
          Save settings
        </button>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input type="checkbox" checked={showKeys} onChange={(e) => setShowKeys(e.target.checked)} />
          Show keys
        </label>
        {msg && <span className={`text-sm ${msg.kind === "err" ? "text-danger" : "text-muted"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
