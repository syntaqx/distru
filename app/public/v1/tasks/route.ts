import { authenticate, distruError, listEnvelope, PAGE_SIZE, pageOffset, requireScope } from "@/lib/public-api";
import { listTasks, upsertTask, taskToApi } from "@/lib/modules/platform";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "platform:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listTasks(auth.ctx, { limit: PAGE_SIZE, offset });
  return listEnvelope(req, items.map(taskToApi), offset, total);
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "platform:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as (Record<string, unknown> | null);
  if (!body) return distruError(400, "Invalid JSON body", [], "body");
  if (!body.id && !body.title) return distruError(400, "title is required", ["title"], "body");
  try {
    const { row, created } = await upsertTask(auth.ctx, {
      id: body.id as string | undefined,
      title: body.title as string | undefined,
      description: (body.description as string) ?? null,
      status: body.status as string | undefined,
      priority: body.priority as string | undefined,
      assigneeId: (body.assignee_id as string) ?? null,
      dueAt: (body.due_datetime as string) ?? null,
      entityType: (body.entity_type as string) ?? null,
      entityId: (body.entity_id as string) ?? null,
    });
    return Response.json({ data: taskToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
