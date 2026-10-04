// Tells the UI whether the host provided fallback keys, without revealing them.
export async function GET() {
  return Response.json({
    serverLLM: Boolean(process.env.LLM_API_KEY),
    serverGitHub: Boolean(process.env.GITHUB_TOKEN),
  });
}
