import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { member, user } from "@/db/schema";
import { datetime } from "@/lib/modules/shared";

/** Get one member of the org by user id. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "companies:read");
  if (scopeErr) return scopeErr;

  const { id } = await params;
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: member.role,
      insertedDatetime: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(eq(member.organizationId, auth.ctx.orgId), eq(member.userId, id)))
    .limit(1);

  if (!row) return distruError(404, "User not found", ["id"], "path");

  return Response.json({
    data: {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      inserted_datetime: datetime(row.insertedDatetime),
    },
  });
}
