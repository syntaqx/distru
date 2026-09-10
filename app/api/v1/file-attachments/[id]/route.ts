import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getFileAttachment, fileAttachmentToApi } from "@/lib/modules/platform";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "platform:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const row = await getFileAttachment(auth.ctx, id);
  if (!row) return distruError(404, "File attachment not found", ["id"], "path");
  return Response.json({ data: fileAttachmentToApi(row) });
}
