import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import { listContacts, upsertContact, contactToApi } from "@/lib/modules/catalog";
import { fromCustomData } from "@/lib/modules/shared";
import { emitEvent } from "@/lib/modules/platform";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "companies:read");
  if (scopeErr) return scopeErr;
  const url = new URL(req.url);
  const offset = pageOffset(req);
  const { items, total } = await listContacts(auth.ctx, {
    companyId: url.searchParams.get("company_id") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    limit: PAGE_SIZE,
    offset,
  });
  return listEnvelope(req, items.map(contactToApi), offset, total);
}

type ContactBody = {
  id?: string;
  // Distru shape (company as {id}, split name, phone_number) + older aliases.
  company?: string | { id?: string } | null;
  company_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  name?: string;
  email?: string | null;
  phone_number?: string | null;
  phone?: string | null;
  title?: string | null;
  custom_data?: unknown;
};

/** Resolve a contact's display name from Distru's split fields or a plain name. */
function contactName(body: ContactBody): string | undefined {
  if (body.full_name) return body.full_name;
  const joined = [body.first_name, body.last_name].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  return body.name;
}

function contactCompanyId(body: ContactBody): string | null | undefined {
  if (body.company !== undefined)
    return typeof body.company === "string" ? body.company : body.company?.id ?? null;
  return body.company_id ?? undefined;
}

/** Sparse upsert: omit id to create, include id to update. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "companies:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as ContactBody | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");
  const name = contactName(body);
  if (!body.id && !name)
    return distruError(400, "name is required to create a contact", ["first_name"], "body");
  try {
    const { row, created } = await upsertContact(auth.ctx, {
      id: body.id,
      companyId: contactCompanyId(body) ?? undefined,
      name,
      email: body.email,
      phone: body.phone_number ?? body.phone,
      title: body.title,
      customFields: fromCustomData(body.custom_data),
    });
    const api = contactToApi(row);
    await emitEvent(auth.ctx, created ? "contact.created" : "contact.updated", api, { id: row.id });
    return Response.json({ data: api }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Contact upsert failed", [], "body");
  }
}
