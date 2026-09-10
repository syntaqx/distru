import { authenticate, distruError, listEnvelope, PAGE_SIZE, pageOffset, requireScope } from "@/lib/public-api";
import { listFileAttachments, upsertFileAttachment, fileAttachmentToApi } from "@/lib/modules/platform";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "platform:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listFileAttachments(auth.ctx, { limit: PAGE_SIZE, offset });
  return listEnvelope(req, items.map(fileAttachmentToApi), offset, total);
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "platform:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as (Record<string, unknown> | null);
  if (!body) return distruError(400, "Invalid JSON body", [], "body");
  if (!body.id && !body.filename) return distruError(400, "filename is required", ["filename"], "body");
  try {
    const { row, created } = await upsertFileAttachment(auth.ctx, {
      id: body.id as string | undefined,
      entityType: (body.entity_type as string) ?? undefined,
      entityId: (body.entity_id as string) ?? null,
      filename: body.filename as string | undefined,
      url: (body.url as string) ?? null,
      contentType: (body.content_type as string) ?? null,
    });
    return Response.json({ data: fileAttachmentToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
