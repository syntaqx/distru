import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import {
  listLicenses,
  listLicenseTypes,
  upsertLicense,
  licenseToApi,
} from "@/lib/modules/compliance";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "compliance:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const [{ items, total }, types] = await Promise.all([
    listLicenses(auth.ctx, { limit: PAGE_SIZE, offset }),
    listLicenseTypes(auth.ctx, { limit: 200 }),
  ]);
  const typeName = new Map(types.items.map((t) => [t.id, t.name]));
  return listEnvelope(
    req,
    items.map((l) => licenseToApi(l, l.licenseTypeId ? typeName.get(l.licenseTypeId) : null)),
    offset,
    total,
  );
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "compliance:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");
  if (!body.id && !body.license_number) {
    return distruError(400, "license_number is required", ["license_number"], "body");
  }
  try {
    const { row, created } = await upsertLicense(auth.ctx, {
      id: body.id as string | undefined,
      licenseNumber: body.license_number as string | undefined,
      licenseTypeId: (body.license_type_id as string) ?? null,
      name: (body.name as string) ?? null,
      state: (body.state as string) ?? null,
      ...(typeof body.active === "boolean" ? { active: body.active } : {}),
      issuedAt: body.issue_datetime ? new Date(body.issue_datetime as string) : null,
      expiresAt: (body.expiry_datetime ?? body.expires_datetime)
        ? new Date((body.expiry_datetime ?? body.expires_datetime) as string)
        : null,
    });
    return Response.json({ data: licenseToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
