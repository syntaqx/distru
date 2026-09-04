import { getOrgContext } from "@/lib/session";
import { buildErrorCsv } from "@/lib/imports/errors-csv";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const ctx = await getOrgContext();
  if (!ctx) return new Response("unauthorized", { status: 401 });
  const { jobId } = await params;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const result = await buildErrorCsv(service, jobId);
  if (!result) return new Response("not found", { status: 404 });
  return new Response(result.csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="import-${jobId}-errors.csv"`,
    },
  });
}
