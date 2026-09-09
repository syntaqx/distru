import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/session";
import { listArtifacts } from "@/lib/modules/reports";

export async function GET(req: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const runId = new URL(req.url).searchParams.get("runId") ?? undefined;
  const artifacts = await listArtifacts(service, { workflowRunId: runId });
  // Trim heavy content out of the list payload; the viewer fetches one by id.
  return NextResponse.json({
    reports: artifacts.map((a) => ({
      id: a.id,
      title: a.title,
      kind: a.kind,
      format: a.format,
      createdBy: a.createdBy,
      deliveries: a.deliveries,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}
