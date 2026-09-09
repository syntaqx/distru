import type { ServiceCtx } from "@/lib/modules/shared";
import { createCompany, listCompanies } from "@/lib/modules/catalog";
import type { ImportTarget } from "../target";
import type { CanonicalField, RowError } from "../types";

/**
 * A deliberately small second target to prove the framework scales to "other
 * CSV things" with zero pipeline changes. Registering this made customer import
 * work end-to-end (map → validate → commit) for free.
 */
type Prep = { existing: Set<string> };
type CustomerValue = { name: string };

const FIELDS: CanonicalField[] = [
  {
    key: "name",
    label: "Customer Name",
    type: "string",
    required: true,
    aliases: ["customer", "name", "company", "account", "business name"],
  },
  {
    key: "email",
    label: "Email",
    type: "string",
    required: false,
    aliases: ["email", "e-mail", "contact email"],
  },
];

export const customersTarget: ImportTarget<Prep, CustomerValue> = {
  key: "customers",
  label: "Customers",
  description: "Import a customer list as CRM companies with the CUSTOMER role.",
  fields: FIELDS,
  async prepare(ctx: ServiceCtx) {
    const companies = await listCompanies(ctx);
    return { existing: new Set(companies.map((c) => c.name.toLowerCase())) };
  },
  validateRow(mapped) {
    const name = mapped.name ? String(mapped.name).trim() : "";
    if (!name) {
      const errors: RowError[] = [
        { field: "name", code: "required", message: "Customer Name is required" },
      ];
      return { ok: false, errors };
    }
    return { ok: true, value: { name } };
  },
  async commitRows(rows, ctx, prep) {
    const out: { productId?: string | null }[] = [];
    for (const { value } of rows) {
      if (!prep.existing.has(value.name.toLowerCase())) {
        await createCompany(ctx, { name: value.name, roles: ["CUSTOMER"] });
        prep.existing.add(value.name.toLowerCase());
      }
      out.push({ productId: null });
    }
    return out;
  },
};
