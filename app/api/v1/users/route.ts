import {
  authenticate,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { member, user } from "@/db/schema";
import { datetime } from "@/lib/modules/shared";

/** List the org's users/members (better-auth member + user tables). */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "companies:read");
  if (scopeErr) return scopeErr;

  const offset = pageOffset(req);
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: member.role,
      insertedDatetime: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, auth.ctx.orgId))
    .orderBy(asc(user.name));

  const page = rows.slice(offset, offset + PAGE_SIZE).map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    inserted_datetime: datetime(r.insertedDatetime),
  }));

  return listEnvelope(req, page, offset, rows.length);
}
