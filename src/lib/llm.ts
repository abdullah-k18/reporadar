// Thin client for any OpenAI-compatible endpoint serving open-weight models.
// Keys come from the user's own Settings (sent per request, never stored on the
// server), falling back to server env vars if the host chose to provide them.

import { PROVIDERS, providerById } from "./providers";

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function llmConfigFrom(request: Request): LLMConfig {
  const h = request.headers;
  const userKey = h.get("x-llm-key")?.trim();

  if (userKey) {
    const provider = providerById(h.get("x-llm-provider")) ?? PROVIDERS[0];
    return {
      apiKey: userKey,
      baseUrl: provider.baseUrl,
      model: h.get("x-llm-model")?.trim() || provider.defaultModel,
    };
  }

  const envKey = process.env.LLM_API_KEY;
  if (!envKey) {
    throw new Error("No AI key yet. Open the Settings tab and paste your API key.");
  }
  return {
    apiKey: envKey,
    baseUrl: process.env.LLM_BASE_URL ?? PROVIDERS[0].baseUrl,
    model: process.env.LLM_MODEL ?? PROVIDERS[0].defaultModel,
  };
}

export async function chatJSON<T>(cfg: LLMConfig, system: string, user: string): Promise<T> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${system}\nRespond with a single JSON object only.` },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    if (res.status === 401) throw new Error("The AI provider rejected your API key. Check it in Settings.");
    if (res.status === 404) throw new Error(`Model "${cfg.model}" isn't available. Pick another in Settings.`);
    throw new Error(`AI request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  // Some models wrap JSON in code fences even in JSON mode.
  const cleaned = content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  return JSON.parse(cleaned) as T;
}
