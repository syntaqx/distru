import {
  authenticate,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import { listUnitTypes } from "@/lib/modules/catalog";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const all = await listUnitTypes();
  const data = all.slice(offset, offset + PAGE_SIZE).map((u) => ({ id: u.id, name: u.name }));
  return listEnvelope(req, data, offset, all.length);
}
