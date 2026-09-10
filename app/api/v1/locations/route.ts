import {
  authenticate,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import { listLocations } from "@/lib/modules/catalog";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const all = await listLocations(auth.ctx);
  const data = all.slice(offset, offset + PAGE_SIZE).map((l) => ({ id: l.id, name: l.name }));
  return listEnvelope(req, data, offset, all.length);
}
