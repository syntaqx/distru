import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getContact, contactToApi } from "@/lib/modules/catalog";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "companies:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const contact = await getContact(auth.ctx, id);
  if (!contact) return distruError(404, "Contact not found", ["id"], "path");
  return Response.json({ data: contactToApi(contact) });
}
