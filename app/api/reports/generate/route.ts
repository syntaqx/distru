import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/session";
import {
  createArtifact,
  formatReport,
  getReportDef,
  runReport,
} from "@/lib/modules/reports";
import { createNotification } from "@/lib/modules/notifications";

/**
 * Snapshot a standard Insights report into a durable artifact - the "Save to
 * Reports" action on the Insights page. Same registry the public API + the
 * generate_report tool use, so the numbers match everywhere.
 */
export async function POST(req: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  const body = (await req.json().catch(() => ({}))) as {
    report?: string;
    format?: "markdown" | "csv" | "json";
  };
  const def = body.report ? getReportDef(body.report) : undefined;
  if (!def) return NextResponse.json({ error: "unknown report" }, { status: 400 });

  const result = await runReport(service, def.name);
  if (!result) return NextResponse.json({ error: "unknown report" }, { status: 400 });

  const format = body.format ?? "markdown";
  const title = `${def.label} - ${new Date().toISOString().slice(0, 10)}`;
  const art = await createArtifact(service, {
    title,
    content: formatReport(result.columns, result.rows, format),
    kind: "report",
    format,
  });
  await createNotification(service, {
    userId: ctx.userId,
    kind: "report.ready",
    title: `Report ready: ${title}`,
    href: `/reports?id=${art.id}`,
  });
  return NextResponse.json({ report_id: art.id, url: `/reports?id=${art.id}` });
}
