import { and, asc, count, desc, eq, ilike, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  companies,
  companyGroups,
  companyNotes,
  contacts,
  locations,
  products,
  unitTypes,
} from "@/db/schema";
import type { ServiceCtx } from "../shared";
import { recordAudit, customData, datetime, num } from "../shared";
import { getAccountingProvider, getMarketplaceProvider } from "@/lib/integrations/sync";

// ---------------- Unit types (global reference) ----------------

// Unit types are a tiny, fixed global table. We query them fresh rather than
// caching process-wide: a stale cache would survive a DB reseed and hand out
// unit-type ids that no longer exist (FK violation). Import runs load them once
// via `prepare()`, so there's no per-row cost.
export async function listUnitTypes() {
  return db.select().from(unitTypes).orderBy(asc(unitTypes.name));
}

const UNIT_ALIASES: Record<string, string> = {
  g: "Gram",
  gram: "Gram",
  grams: "Gram",
  kg: "Kilogram",
  kilo: "Kilogram",
  kilogram: "Kilogram",
  kilograms: "Kilogram",
  mg: "Milligram",
  milligram: "Milligram",
  milligrams: "Milligram",
  oz: "Ounce",
  ounce: "Ounce",
  ounces: "Ounce",
  lb: "Pound",
  lbs: "Pound",
  pound: "Pound",
  pounds: "Pound",
  ml: "Milliliter",
  milliliter: "Milliliter",
  milliliters: "Milliliter",
  l: "Liter",
  liter: "Liter",
  liters: "Liter",
  litre: "Liter",
  gal: "Gallon",
  gallon: "Gallon",
  gallons: "Gallon",
  pt: "Pint",
  pint: "Pint",
  qt: "Quart",
  quart: "Quart",
  "fl oz": "Fluid Ounce",
  "fluid ounce": "Fluid Ounce",
  each: "Unit",
  ea: "Unit",
  unit: "Unit",
  units: "Unit",
  count: "Unit",
  ct: "Unit",
  pcs: "Unit",
  piece: "Unit",
};

/** Sync unit resolver against a preloaded unit-type list (for row validation). */
export function matchUnitType(
  units: { id: string; name: string }[],
  input: string | null | undefined,
) {
  if (!input) return null;
  const cleaned = input.trim().toLowerCase();
  const canonical = (UNIT_ALIASES[cleaned] ?? input.trim()).toLowerCase();
  return (
    units.find((u) => u.name.toLowerCase() === canonical) ??
    units.find((u) => u.name.toLowerCase() === cleaned) ??
    null
  );
}

/** Resolve a free-text unit ("grams", "g", "EACH") to a canonical unit type. */
export async function resolveUnitType(input: string | null | undefined) {
  const list = await listUnitTypes();
  return matchUnitType(list, input);
}

// ---------------- Categories ----------------

export async function listCategories(ctx: ServiceCtx) {
  return db
    .select()
    .from(categories)
    .where(eq(categories.organizationId, ctx.orgId))
    .orderBy(asc(categories.name));
}

export async function findCategoryByName(ctx: ServiceCtx, name: string) {
  const [row] = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.organizationId, ctx.orgId),
        ilike(categories.name, name.trim()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createCategory(
  ctx: ServiceCtx,
  input: { name: string; biotrackType?: string | null },
) {
  const [row] = await db
    .insert(categories)
    .values({
      organizationId: ctx.orgId,
      name: input.name.trim(),
      biotrackType: input.biotrackType ?? null,
    })
    .onConflictDoNothing()
    .returning();
  const category = row ?? (await findCategoryByName(ctx, input.name))!;
  if (row) {
    await recordAudit(ctx, {
      action: "category.create",
      entityType: "category",
      entityId: category.id,
      after: { name: category.name },
    });
  }
  return category;
}

export async function findOrCreateCategory(ctx: ServiceCtx, name: string) {
  return (await findCategoryByName(ctx, name)) ?? (await createCategory(ctx, { name }));
}

export async function getCategory(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.organizationId, ctx.orgId), eq(categories.id, id)))
    .limit(1);
  return row ?? null;
}

export async function updateCategory(
  ctx: ServiceCtx,
  id: string,
  patch: { name?: string; biotrackType?: string | null },
) {
  const before = await getCategory(ctx, id);
  if (!before) throw new Error("Category not found.");
  const [row] = await db
    .update(categories)
    .set({
      ...(patch.name != null ? { name: patch.name.trim() } : {}),
      ...(patch.biotrackType !== undefined ? { biotrackType: patch.biotrackType } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(categories.organizationId, ctx.orgId), eq(categories.id, id)))
    .returning();
  await recordAudit(ctx, {
    action: "category.update",
    entityType: "category",
    entityId: id,
    before: { name: before.name, biotrackType: before.biotrackType },
    after: { name: row.name, biotrackType: row.biotrackType },
  });
  return row;
}

export async function deleteCategory(ctx: ServiceCtx, id: string) {
  const before = await getCategory(ctx, id);
  if (!before) return;
  // Products reference categories with ON DELETE SET NULL, so this is safe.
  await db
    .delete(categories)
    .where(and(eq(categories.organizationId, ctx.orgId), eq(categories.id, id)));
  await recordAudit(ctx, {
    action: "category.delete",
    entityType: "category",
    entityId: id,
    before: { name: before.name, biotrackType: before.biotrackType },
  });
}

/** Count active + archived products per category id for the current org. */
export async function productCountByCategory(ctx: ServiceCtx) {
  const rows = await db
    .select({ categoryId: products.categoryId, count: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.organizationId, ctx.orgId))
    .groupBy(products.categoryId);
  const map = new Map<string, number>();
  for (const r of rows) if (r.categoryId) map.set(r.categoryId, r.count);
  return map;
}

/** Count of products with no category (the "Uncategorized" bucket). */
export async function uncategorizedProductCount(ctx: ServiceCtx) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(and(eq(products.organizationId, ctx.orgId), isNull(products.categoryId)));
  return row?.count ?? 0;
}

// ---------------- Companies (Vendor / Brand / Customer) ----------------

export async function listCompanies(ctx: ServiceCtx, role?: string) {
  const rows = await db
    .select()
    .from(companies)
    .where(eq(companies.organizationId, ctx.orgId))
    .orderBy(asc(companies.name));
  return role ? rows.filter((c) => c.roles.includes(role)) : rows;
}

export async function findCompanyByName(ctx: ServiceCtx, name: string) {
  const [row] = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.organizationId, ctx.orgId),
        ilike(companies.name, name.trim()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createCompany(
  ctx: ServiceCtx,
  input: {
    name: string;
    roles?: string[];
    groupId?: string | null;
    tags?: string[];
    customFields?: Record<string, string | number | boolean | null>;
  },
) {
  const [row] = await db
    .insert(companies)
    .values({
      organizationId: ctx.orgId,
      name: input.name.trim(),
      roles: input.roles ?? ["VENDOR", "BRAND"],
      groupId: input.groupId ?? null,
      tags: input.tags ?? [],
      customFields: input.customFields ?? {},
    })
    .onConflictDoNothing()
    .returning();
  const company = row ?? (await findCompanyByName(ctx, input.name))!;
  if (row) {
    await recordAudit(ctx, {
      action: "company.create",
      entityType: "company",
      entityId: company.id,
      after: { name: company.name, roles: company.roles },
    });
  }
  return company;
}

export async function findOrCreateCompany(ctx: ServiceCtx, name: string) {
  return (await findCompanyByName(ctx, name)) ?? (await createCompany(ctx, { name }));
}

/**
 * Resolve a customer by name, ensuring the company carries the CUSTOMER role
 * (adding it to an existing vendor/brand rather than creating a duplicate).
 */
export async function findOrCreateCustomer(ctx: ServiceCtx, name: string) {
  const existing = await findCompanyByName(ctx, name);
  if (existing) {
    if (!existing.roles.includes("CUSTOMER")) {
      return updateCompany(ctx, existing.id, { roles: [...existing.roles, "CUSTOMER"] });
    }
    return existing;
  }
  return createCompany(ctx, { name, roles: ["CUSTOMER"] });
}

/**
 * Resolve a vendor by name, ensuring the company carries the VENDOR role (adding
 * it to an existing customer/brand rather than creating a duplicate).
 */
export async function findOrCreateVendor(ctx: ServiceCtx, name: string) {
  const existing = await findCompanyByName(ctx, name);
  if (existing) {
    if (!existing.roles.includes("VENDOR")) {
      return updateCompany(ctx, existing.id, { roles: [...existing.roles, "VENDOR"] });
    }
    return existing;
  }
  return createCompany(ctx, { name, roles: ["VENDOR"] });
}

/** Resolve a brand by name, ensuring the company carries the BRAND role. */
export async function findOrCreateBrand(ctx: ServiceCtx, name: string) {
  const existing = await findCompanyByName(ctx, name);
  if (existing) {
    if (!existing.roles.includes("BRAND")) {
      return updateCompany(ctx, existing.id, { roles: [...existing.roles, "BRAND"] });
    }
    return existing;
  }
  return createCompany(ctx, { name, roles: ["BRAND"] });
}

export async function getCompany(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.organizationId, ctx.orgId), eq(companies.id, id)))
    .limit(1);
  return row ?? null;
}

export async function updateCompany(
  ctx: ServiceCtx,
  id: string,
  patch: {
    name?: string;
    roles?: string[];
    groupId?: string | null;
    tags?: string[];
    customFields?: Record<string, string | number | boolean | null>;
  },
) {
  const before = await getCompany(ctx, id);
  if (!before) throw new Error("Company not found.");
  const [row] = await db
    .update(companies)
    .set({
      ...(patch.name != null ? { name: patch.name.trim() } : {}),
      ...(patch.roles != null ? { roles: patch.roles } : {}),
      ...(patch.groupId !== undefined ? { groupId: patch.groupId } : {}),
      ...(patch.tags != null ? { tags: patch.tags } : {}),
      ...(patch.customFields != null ? { customFields: patch.customFields } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(companies.organizationId, ctx.orgId), eq(companies.id, id)))
    .returning();
  await recordAudit(ctx, {
    action: "company.update",
    entityType: "company",
    entityId: id,
    before: { name: before.name, roles: before.roles },
    after: { name: row.name, roles: row.roles },
  });
  return row;
}

export async function deleteCompany(ctx: ServiceCtx, id: string) {
  const before = await getCompany(ctx, id);
  if (!before) return;
  // Products reference vendors with ON DELETE SET NULL, so this is safe.
  await db
    .delete(companies)
    .where(and(eq(companies.organizationId, ctx.orgId), eq(companies.id, id)));
  await recordAudit(ctx, {
    action: "company.delete",
    entityType: "company",
    entityId: id,
    before: { name: before.name, roles: before.roles },
  });
}

// ---------------- Company notes (CRM sales notes / activity) ----------------

export type CompanyNoteRow = typeof companyNotes.$inferSelect;

/** Append a sales note / activity entry to a company's timeline. */
export async function addCompanyNote(
  ctx: ServiceCtx,
  input: { companyId: string; body: string; authorId?: string | null },
) {
  const body = input.body?.trim();
  if (!body) throw new Error("Note body is required.");
  // Guard: only allow notes on a company that exists in this org.
  const company = await getCompany(ctx, input.companyId);
  if (!company) throw new Error("Company not found.");
  const [row] = await db
    .insert(companyNotes)
    .values({
      organizationId: ctx.orgId,
      companyId: input.companyId,
      authorId: input.authorId ?? ctx.actor,
      body,
    })
    .returning();
  await recordAudit(ctx, {
    action: "company_note.create",
    entityType: "company",
    entityId: input.companyId,
    after: { noteId: row.id, body },
  });
  return row;
}

/** A company's notes, newest first. */
export async function listCompanyNotes(
  ctx: ServiceCtx,
  companyId: string,
  opts: { limit?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  return db
    .select()
    .from(companyNotes)
    .where(
      and(
        eq(companyNotes.organizationId, ctx.orgId),
        eq(companyNotes.companyId, companyId),
      ),
    )
    .orderBy(desc(companyNotes.createdAt))
    .limit(limit);
}

export async function deleteCompanyNote(ctx: ServiceCtx, id: string) {
  await db
    .delete(companyNotes)
    .where(and(eq(companyNotes.organizationId, ctx.orgId), eq(companyNotes.id, id)));
}

export function companyNoteToApi(n: CompanyNoteRow, authorName?: string | null) {
  return {
    id: n.id,
    company: { id: n.companyId },
    body: n.body,
    author_id: n.authorId ?? null,
    author: authorName ?? null,
    inserted_datetime: datetime(n.createdAt),
    updated_datetime: datetime(n.updatedAt),
  };
}

// ---------------- Locations ----------------

export async function listLocations(ctx: ServiceCtx) {
  return db
    .select()
    .from(locations)
    .where(eq(locations.organizationId, ctx.orgId))
    .orderBy(asc(locations.name));
}

export async function findLocationByName(ctx: ServiceCtx, name: string) {
  const [row] = await db
    .select()
    .from(locations)
    .where(
      and(
        eq(locations.organizationId, ctx.orgId),
        ilike(locations.name, name.trim()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createLocation(ctx: ServiceCtx, input: { name: string }) {
  const [row] = await db
    .insert(locations)
    .values({ organizationId: ctx.orgId, name: input.name.trim() })
    .onConflictDoNothing()
    .returning();
  return row ?? (await findLocationByName(ctx, input.name))!;
}

export async function findOrCreateLocation(ctx: ServiceCtx, name: string) {
  return (await findLocationByName(ctx, name)) ?? (await createLocation(ctx, { name }));
}

/** The first location for the org, or a created "Main Warehouse". */
export async function getDefaultLocation(ctx: ServiceCtx) {
  const [row] = await db
    .select()
    .from(locations)
    .where(eq(locations.organizationId, ctx.orgId))
    .orderBy(asc(locations.createdAt))
    .limit(1);
  return row ?? (await createLocation(ctx, { name: "Main Warehouse" }));
}

// ---------------- Company groups ----------------

export type CompanyGroupRow = typeof companyGroups.$inferSelect;

export async function listCompanyGroups(ctx: ServiceCtx) {
  return db
    .select()
    .from(companyGroups)
    .where(eq(companyGroups.organizationId, ctx.orgId))
    .orderBy(asc(companyGroups.name));
}

export async function getCompanyGroup(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(companyGroups)
    .where(and(eq(companyGroups.organizationId, ctx.orgId), eq(companyGroups.id, id)))
    .limit(1);
  return row ?? null;
}

/** Sparse upsert: with id updates, without id creates. */
export async function upsertCompanyGroup(
  ctx: ServiceCtx,
  input: { id?: string; name: string },
) {
  if (input.id) {
    const [row] = await db
      .update(companyGroups)
      .set({ name: input.name.trim(), updatedAt: new Date() })
      .where(and(eq(companyGroups.organizationId, ctx.orgId), eq(companyGroups.id, input.id)))
      .returning();
    if (!row) throw new Error("Company group not found.");
    return { row, created: false };
  }
  const [row] = await db
    .insert(companyGroups)
    .values({ organizationId: ctx.orgId, name: input.name.trim() })
    .returning();
  return { row, created: true };
}

export function companyGroupToApi(g: CompanyGroupRow) {
  return {
    id: g.id,
    name: g.name,
    inserted_datetime: datetime(g.createdAt),
    updated_datetime: datetime(g.updatedAt),
  };
}

// ---------------- Contacts (people at companies) ----------------

export type ContactRow = typeof contacts.$inferSelect;

export type ListContactsArgs = {
  companyId?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listContacts(ctx: ServiceCtx, args: ListContactsArgs = {}) {
  const filters: SQL[] = [eq(contacts.organizationId, ctx.orgId)];
  if (args.companyId) filters.push(eq(contacts.companyId, args.companyId));
  if (args.search) filters.push(ilike(contacts.name, `%${args.search}%`));
  const where = and(...filters);
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
  const offset = Math.max(args.offset ?? 0, 0);
  const rows = await db
    .select()
    .from(contacts)
    .where(where)
    .orderBy(desc(contacts.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(contacts).where(where);
  return { items: rows, total: Number(total), limit, offset };
}

export async function getContact(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.organizationId, ctx.orgId), eq(contacts.id, id)))
    .limit(1);
  return row ?? null;
}

/** Sparse upsert: with id updates only the fields sent; without id creates. */
export async function upsertContact(
  ctx: ServiceCtx,
  input: {
    id?: string;
    companyId?: string | null;
    name?: string;
    email?: string | null;
    phone?: string | null;
    title?: string | null;
    customFields?: Record<string, string | number | boolean | null>;
  },
) {
  if (input.id) {
    const [row] = await db
      .update(contacts)
      .set({
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.companyId !== undefined ? { companyId: input.companyId } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.customFields != null ? { customFields: input.customFields } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.organizationId, ctx.orgId), eq(contacts.id, input.id)))
      .returning();
    if (!row) throw new Error("Contact not found.");
    return { row, created: false };
  }
  if (!input.name) throw new Error("name is required to create a contact.");
  const [row] = await db
    .insert(contacts)
    .values({
      organizationId: ctx.orgId,
      companyId: input.companyId ?? null,
      name: input.name.trim(),
      email: input.email ?? null,
      phone: input.phone ?? null,
      title: input.title ?? null,
      customFields: input.customFields ?? {},
    })
    .returning();
  return { row, created: true };
}

export function contactToApi(c: ContactRow) {
  const full = c.name ?? null;
  const parts = full ? full.trim().split(/\s+/) : [];
  const firstName = parts.length ? parts[0] : null;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
  return {
    id: c.id,
    company: c.companyId ? { id: c.companyId } : null,
    first_name: firstName,
    last_name: lastName,
    full_name: full,
    email: c.email ?? null,
    phone_number: c.phone ?? null,
    work_phone_number: null,
    title: c.title ?? null,
    custom_data: customData(c.customFields),
    // Distru-parity fields not modeled in this clone (null/empty; Tier 3).
    description: null,
    driver_license_number: null,
    driver_license_issuing_state: null,
    owner: null,
    deleted_at: null,
    tasks: [],
    inserted_datetime: datetime(c.createdAt),
    updated_datetime: datetime(c.updatedAt),
  };
}

// ---------------- Company serialization (shared across faces) ----------------

/** Distru models the buyer/seller relationship as a single `{id,name}` object. */
function relationshipType(roles: string[]): { id: string; name: string } | null {
  const primary = roles[0];
  if (!primary) return null;
  const name = primary.charAt(0) + primary.slice(1).toLowerCase();
  return { id: primary, name };
}

export function companyToApi(
  c: typeof companies.$inferSelect,
  groupName?: string | null,
  extra?: { outstandingBalance?: number | null; licensesCount?: number | null },
) {
  return {
    id: c.id,
    name: c.name,
    relationship_type: relationshipType(c.roles),
    group: c.groupId ? { id: c.groupId, name: groupName ?? null } : null,
    tags: c.tags ?? [],
    custom_data: customData(c.customFields),
    // Live CRM signals when the caller supplies them (company detail / AR views);
    // otherwise null so the serializer stays pure and cheap for list endpoints.
    outstanding_balance:
      extra?.outstandingBalance != null ? num(extra.outstandingBalance) : null,
    licenses_count: extra?.licensesCount ?? null,
    // Distru-parity fields not modeled in this clone (null/empty; see
    // DISTRU-PARITY.md §5 Tier 3).
    legal_business_name: null,
    phone_number: null,
    website: null,
    category: null,
    licenses: [],
    locations: [],
    outstanding_balance_threshold: null,
    default_email: null,
    invoice_email: null,
    sales_order_email: null,
    purchase_order_email: null,
    order_shipment_email: null,
    default_payment_term: null,
    owner: null,
    owner_id: null,
    deleted_at: null,
    leaflink_brand_id: c.roles.includes("BRAND") ? getMarketplaceProvider().brandId(c.id) : null,
    leaflink_customer_id: c.roles.includes("CUSTOMER") ? getMarketplaceProvider().customerId(c.id) : null,
    qb_customer_id: c.roles.includes("CUSTOMER") ? getAccountingProvider().customerId(c.id) : null,
    qb_vendor_id: c.roles.includes("VENDOR") ? getAccountingProvider().vendorId(c.id) : null,
    inserted_datetime: datetime(c.createdAt),
    updated_datetime: datetime(c.updatedAt),
  };
}

/** No-op retained for compatibility (unit types are no longer cached). */
export function _resetUnitTypeCache() {}

export { sql };
