// OpenAI-compatible providers that serve open-weight models.
// The server only ever calls these base URLs, so a client can't point it anywhere else.

export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  keyUrl: string;
  defaultModel: string;
  note: string;
}

export const PROVIDERS: Provider[] = [
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keyUrl: "https://console.groq.com/keys",
    defaultModel: "openai/gpt-oss-120b",
    note: "Free tier, very fast.",
  },
  // Any other OpenAI-compatible host (OpenRouter, Together, Hugging Face…) can be added here.
];

export const GITHUB_TOKEN_URL =
  "https://github.com/settings/tokens/new?description=RepoRadar&scopes=";

export function providerById(id: string | null | undefined): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
