import { buildSkillMd } from "@/lib/llms";

// Public: an Agent Skill describing the Distru API conventions, mirroring the
// SKILL.md the real Distru API serves for agents.
export function GET(req: Request) {
  const base = new URL(req.url).origin;
  return new Response(buildSkillMd(base), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
