import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/session";
import { hasAnthropicKey } from "@/lib/anthropic";
import { runWorkflow } from "@/lib/harness/workflows";

// A workflow run drives the agent loop; give it room on serverless.
export const maxDuration = 300;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasAnthropicKey()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set." },
      { status: 400 },
    );
  }
  const { id } = await params;
  try {
    const run = await runWorkflow(ctx, id);
    return NextResponse.json({ run });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Workflow run failed." },
      { status: 400 },
    );
  }
}
