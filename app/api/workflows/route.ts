import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/session";
import {
  createWorkflow,
  listRuns,
  listWorkflows,
} from "@/lib/harness/workflows";
import { emptyGraph } from "@/lib/harness/graph/validate";
import type { WorkflowGraph } from "@/lib/harness/graph/types";

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const workflows = await listWorkflows(ctx);
  // Attach the most recent run of each so the Automations page can show status.
  const withRuns = await Promise.all(
    workflows.map(async (w) => ({
      ...w,
      recentRuns: await listRuns(ctx, w.id, 3),
    })),
  );
  return NextResponse.json({ workflows: withRuns });
}

export async function POST(req: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    instruction?: string;
    trigger?: "manual" | "schedule";
    schedule?: string | null;
    graph?: WorkflowGraph | null;
  };
  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  // A workflow needs a body: either a saved graph or a legacy instruction.
  const graph = body.graph ?? emptyGraph();
  const workflow = await createWorkflow(ctx, {
    name: body.name,
    instruction: body.instruction ?? "",
    trigger: body.trigger,
    schedule: body.schedule,
    graph,
    createdBy: ctx.userId,
  });
  return NextResponse.json({ workflow });
}
