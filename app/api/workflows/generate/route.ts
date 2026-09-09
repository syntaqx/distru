import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/session";
import { hasAnthropicKey } from "@/lib/anthropic";
import { generateGraph } from "@/lib/harness/graph/authoring";

// Authoring drives one model call; give it a little headroom.
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasAnthropicKey()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 400 });
  }
  const { prompt } = (await req.json().catch(() => ({}))) as { prompt?: string };
  if (!prompt || !prompt.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  try {
    const graph = await generateGraph(prompt.trim());
    return NextResponse.json({ graph });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not generate a workflow." },
      { status: 400 },
    );
  }
}
