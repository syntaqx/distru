import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, companies, locations, unitTypes } from "@/db/schema";
import type { ServiceCtx } from "./context";
import { recordAudit } from "./audit";

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
  input: { name: string; roles?: string[] },
) {
  const [row] = await db
    .insert(companies)
    .values({
      organizationId: ctx.orgId,
      name: input.name.trim(),
      roles: input.roles ?? ["VENDOR", "BRAND"],
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

/** No-op retained for compatibility (unit types are no longer cached). */
export function _resetUnitTypeCache() {}

export { sql };
