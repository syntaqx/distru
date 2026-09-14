import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/session";
import { verifyBearerToken } from "@/lib/modules/platform";
import type { ServiceCtx } from "@/lib/modules/shared";
import { parseTabular } from "@/lib/imports/parse";
import { deterministicMapping } from "@/lib/imports/mapping";
import { productsTarget } from "@/lib/imports/targets/products";
import {
  createImportFile,
  createImportJob,
  insertRows,
  updateJob,
} from "@/lib/modules/imports";
import { commitImport, validateImport } from "@/lib/imports/pipeline";
import { buildErrorCsv } from "@/lib/imports/errors-csv";

export const maxDuration = 300;

/**
 * Distru's internal bulk-upload engine. Accepts a CSV/XLSX in the canonical
 * product template, chunks + validates every row, upserts the valid ones
 * (partial success), and returns a row-mapped error CSV. The AI importer maps an
 * arbitrary file onto this same engine; here it's exposed directly.
 *
 * Auth: session (org member) or Bearer API token (products:write).
 */
export async function POST(req: Request) {
  let service: ServiceCtx | null = null;
  const session = await getOrgContext();
  if (session) {
    service = { orgId: session.orgId, actor: session.actor, actorType: "user" };
  } else {
    const token = await verifyBearerToken(req.headers.get("authorization"));
    if (token && (token.scopes.includes("products:write") || token.scopes.includes("*")))
      service = { orgId: token.orgId, actor: `api:${token.tokenId}`, actorType: "api" };
  }
  if (!service) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "no file" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseTabular({ filename: file.name, contentType: file.type, buffer });
  if (parsed.headers.length === 0)
    return NextResponse.json({ error: "could not parse headers" }, { status: 400 });

  const importFile = await createImportFile(service, {
    filename: file.name,
    contentType: file.type || "text/csv",
    sizeBytes: buffer.byteLength,
    contentBase64: buffer.toString("base64"),
    headers: parsed.headers,
    sampleRows: parsed.rows.slice(0, 20),
    rowCount: parsed.rows.length,
  });
  const job = await createImportJob(service, {
    fileId: importFile.id,
    targetKey: "products",
    createdBy: session?.userId ?? null,
    totalRows: parsed.rows.length,
  });
  await insertRows(
    service,
    job.id,
    parsed.rows.map((raw, i) => ({ rowIndex: i, raw })),
  );

  // Exact-template mapping is deterministic (no AI needed here).
  const mapping = deterministicMapping(parsed.headers, productsTarget);
  await updateJob(service, job.id, { mapping });

  const summary = await validateImport(service, job.id);
  const { committed } = await commitImport(service, job.id);
  const errorReport = await buildErrorCsv(service, job.id);

  const url = new URL(req.url);
  if (url.searchParams.get("format") === "csv") {
    return new Response(errorReport?.csv ?? "", {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="upload-errors.csv"`,
      },
    });
  }

  return NextResponse.json({
    job_id: job.id,
    total: summary.total,
    valid: summary.valid,
    warnings: summary.warning,
    errors: summary.error,
    committed,
    top_errors: summary.topErrors,
    error_report: errorReport && errorReport.errorRows > 0
      ? { rows: errorReport.errorRows, url: `/api/imports/${job.id}/errors.csv`, csv: errorReport.csv }
      : null,
  });
}
