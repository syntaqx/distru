import { buildLlmsTxt } from "@/lib/llms";

// Public agent index (llmstxt.org convention), mirroring Distru's real /llms.txt.
export function GET(req: Request) {
  const base = new URL(req.url).origin;
  return new Response(buildLlmsTxt(base), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
