import { authenticate, distruError, listEnvelope, PAGE_SIZE, pageOffset, requireScope } from "@/lib/public-api";
import { listCustomFields, upsertCustomField, customFieldToApi } from "@/lib/modules/platform";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "platform:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listCustomFields(auth.ctx, { limit: PAGE_SIZE, offset });
  return listEnvelope(req, items.map(customFieldToApi), offset, total);
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "platform:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as (Record<string, unknown> | null);
  if (!body) return distruError(400, "Invalid JSON body", [], "body");
  if (!body.id && !body.name) return distruError(400, "name is required", ["name"], "body");
  if (!body.id && !body.entity_type) return distruError(400, "entity_type is required", ["entity_type"], "body");
  try {
    const { row, created } = await upsertCustomField(auth.ctx, {
      id: body.id as string | undefined,
      entityType: (body.entity_type as string) ?? undefined,
      name: body.name as string | undefined,
      fieldType: (body.field_type as string) ?? undefined,
    });
    return Response.json({ data: customFieldToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
