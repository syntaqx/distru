import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/session";
import { parseTabular } from "@/lib/imports/parse";
import { createImportFile, createImportJob, insertRows } from "@/lib/modules/imports";
import { getTarget } from "@/lib/imports/registry";

export const maxDuration = 300;

export async function POST(req: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  const form = await req.formData();
  const file = form.get("file");
  const targetKey = (form.get("targetKey") as string) || "products";
  const conversationId = (form.get("conversationId") as string) || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }
  try {
    getTarget(targetKey);
  } catch {
    return NextResponse.json({ error: "unknown target" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseTabular({
    filename: file.name,
    contentType: file.type,
    buffer,
  });
  if (parsed.headers.length === 0) {
    return NextResponse.json({ error: "could not parse file headers" }, { status: 400 });
  }

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
    targetKey,
    createdBy: ctx.userId,
    conversationId,
    totalRows: parsed.rows.length,
  });

  await insertRows(
    service,
    job.id,
    parsed.rows.map((raw, i) => ({ rowIndex: i, raw })),
  );

  return NextResponse.json({
    job: { id: job.id, targetKey, status: job.status },
    file: {
      filename: importFile.filename,
      headers: parsed.headers,
      rowCount: parsed.rows.length,
    },
  });
}
