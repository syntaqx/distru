import type { ServiceCtx } from "@/lib/services/context";
import { createCompany, listCompanies } from "@/lib/services/reference";
import type { ImportTarget } from "../target";
import type { CanonicalField, RowError } from "../types";

type Prep = { existing: Set<string> };
type VendorValue = { name: string };

const FIELDS: CanonicalField[] = [
  {
    key: "name",
    label: "Vendor / Supplier Name",
    type: "string",
    required: true,
    aliases: ["vendor", "supplier", "distributor", "brand", "name", "company", "manufacturer"],
  },
  {
    key: "email",
    label: "Email",
    type: "string",
    required: false,
    aliases: ["email", "e-mail", "contact email"],
  },
];

export const vendorsTarget: ImportTarget<Prep, VendorValue> = {
  key: "vendors",
  label: "Vendors / Suppliers",
  description:
    "Import a vendor, supplier, or distributor list as CRM companies with the VENDOR/BRAND role.",
  fields: FIELDS,
  async prepare(ctx: ServiceCtx) {
    const companies = await listCompanies(ctx);
    return { existing: new Set(companies.map((c) => c.name.toLowerCase())) };
  },
  validateRow(mapped) {
    const name = mapped.name ? String(mapped.name).trim() : "";
    if (!name) {
      const errors: RowError[] = [
        { field: "name", code: "required", message: "Vendor name is required" },
      ];
      return { ok: false, errors };
    }
    return { ok: true, value: { name } };
  },
  async commitRows(rows, ctx, prep) {
    const out: { productId?: string | null }[] = [];
    for (const { value } of rows) {
      if (!prep.existing.has(value.name.toLowerCase())) {
        await createCompany(ctx, { name: value.name, roles: ["VENDOR", "BRAND"] });
        prep.existing.add(value.name.toLowerCase());
      }
      out.push({ productId: null });
    }
    return out;
  },
};
