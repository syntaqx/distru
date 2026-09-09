import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/session";
import { getArtifact } from "@/lib/modules/reports";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;
  const art = await getArtifact(service, id);
  if (!art) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    report: {
      id: art.id,
      title: art.title,
      kind: art.kind,
      format: art.format,
      content: art.content,
      createdBy: art.createdBy,
      workflowId: art.workflowId,
      workflowRunId: art.workflowRunId,
      deliveries: art.deliveries,
      createdAt: art.createdAt.toISOString(),
    },
  });
}
