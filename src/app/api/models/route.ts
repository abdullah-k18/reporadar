import { PROVIDERS, providerById } from "@/lib/providers";

// Non-chat models (speech, safety classifiers, embeddings) and closed agent systems.
const NOT_CHAT = /whisper|tts|orpheus|playai|guard|embed|rerank|moderation|compound|image|vision-only/i;

// RepoRadar is built on open weights, so hide well-known closed models that
// aggregators like OpenRouter also list. (gpt-oss and Gemma are open and stay.)
const CLOSED = /^~|^anthropic\/|^openai\/(?!gpt-oss)|^google\/gemini|^x-ai\/|^amazon\/|^perplexity\/|^inflection\/|^cohere\/command-a/i;

// Asks the provider which models it serves right now, using the user's key,
// so the dropdown never offers a retired model.
export async function GET(request: Request) {
  const provider = providerById(request.headers.get("x-llm-provider")) ?? PROVIDERS[0];
  const key = request.headers.get("x-llm-key")?.trim() || process.env.LLM_API_KEY;
  if (!key) return Response.json({ error: "Paste an API key first." }, { status: 400 });

  try {
    const res = await fetch(`${provider.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (res.status === 401) {
      return Response.json({ error: "That API key was rejected by the provider." }, { status: 401 });
    }
    if (!res.ok) {
      return Response.json({ error: `Provider returned ${res.status}.` }, { status: 502 });
    }
    const json = await res.json();
    const list: { id: string }[] = Array.isArray(json) ? json : (json.data ?? []);
    const models = list
      .map((m) => m.id)
      .filter((id) => id && !NOT_CHAT.test(id) && !CLOSED.test(id))
      .sort((a, b) => a.localeCompare(b));
    return Response.json({ models });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
