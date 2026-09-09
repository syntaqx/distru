import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/session";
import {
  deleteWorkflow,
  getWorkflow,
  listRuns,
  updateWorkflow,
} from "@/lib/harness/workflows";
import type { WorkflowGraph } from "@/lib/harness/graph/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const workflow = await getWorkflow(ctx, id);
  if (!workflow) return NextResponse.json({ error: "not found" }, { status: 404 });
  const runs = await listRuns(ctx, id, 25);
  return NextResponse.json({ workflow, runs });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    trigger?: string;
    schedule?: string | null;
    graph?: WorkflowGraph | null;
  };
  const workflow = await updateWorkflow(ctx, id, {
    name: body.name,
    trigger: body.trigger,
    schedule: body.schedule,
    graph: body.graph,
  });
  if (!workflow) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ workflow });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await deleteWorkflow(ctx, id);
  return NextResponse.json({ ok: true });
}
