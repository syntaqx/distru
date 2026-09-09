import { buildLlmsFullTxt } from "@/lib/llms";

// Public: the full documentation inlined as one Markdown file, for agents.
export function GET(req: Request) {
  const base = new URL(req.url).origin;
  return new Response(buildLlmsFullTxt(base), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
