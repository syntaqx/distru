import { z } from "zod";
import { defineTool, type AgentContext } from "../tool";
import type { HarnessToolPreview } from "../types";
import {
  addCompanyNote,
  findCompanyByName,
  getCompany,
  listCompanies,
  listCompanyNotes,
} from "@/lib/modules/catalog";

function confirm(
  title: string,
  summary: string,
  fields: { label: string; value: string }[],
  risk: "low" | "medium" | "high" = "low",
): HarnessToolPreview {
  return { kind: "confirmation", title, summary, fields, risk };
}

/** Resolve a company from an id or (exact-then-fuzzy) name. */
async function resolveCompany(ctx: AgentContext, ref: string) {
  const byId = await getCompany(ctx.service, ref);
  if (byId) return byId;
  const byName = await findCompanyByName(ctx.service, ref);
  if (byName) return byName;
  const all = await listCompanies(ctx.service);
  const needle = ref.trim().toLowerCase();
  return all.find((c) => c.name.toLowerCase().includes(needle)) ?? null;
}

export const addCompanyNoteTool = defineTool({
  name: "add_company_note",
  description:
    "Add a sales note / activity log entry to a company's CRM timeline. The " +
    "company is matched by id or name. Use this to record calls, meetings, and " +
    "follow-ups against a customer, vendor, or brand.",
  gate: "confirmation",
  inputSchema: z.object({
    company: z.string().describe("Company id or name"),
    body: z.string().min(1).describe("The note text"),
  }),
  async buildPreview(input, ctx) {
    const company = await resolveCompany(ctx, input.company);
    if (!company)
      return confirm("Add company note", `Company "${input.company}" not found.`, []);
    return confirm(
      "Add company note",
      `Add a note to ${company.name}'s timeline.`,
      [
        { label: "Company", value: company.name },
        { label: "Note", value: input.body },
      ],
    );
  },
  async execute(input, ctx) {
    const company = await resolveCompany(ctx, input.company);
    if (!company)
      return { ok: false, summary: `Company "${input.company}" not found.` };
    try {
      const row = await addCompanyNote(ctx.service, {
        companyId: company.id,
        body: input.body,
        authorId: ctx.userId ?? ctx.service.actor,
      });
      return {
        ok: true,
        summary: `Added a note to ${company.name}.`,
        data: { note_id: row.id, company: { id: company.id, name: company.name } },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "Failed to add note." };
    }
  },
});

export const listCompanyNotesTool = defineTool({
  name: "list_company_notes",
  description:
    "List a company's sales notes / activity timeline (newest first). The company " +
    "is matched by id or name. Returns compact note summaries.",
  gate: "none",
  inputSchema: z.object({
    company: z.string().describe("Company id or name"),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  async execute(input, ctx) {
    const company = await resolveCompany(ctx, input.company);
    if (!company)
      return { ok: false, summary: `Company "${input.company}" not found.` };
    const notes = await listCompanyNotes(ctx.service, company.id, {
      limit: input.limit ?? 25,
    });
    return {
      ok: true,
      summary: `${notes.length} note(s) for ${company.name}.`,
      data: {
        company: { id: company.id, name: company.name },
        notes: notes.map((n) => ({
          id: n.id,
          body: n.body,
          author_id: n.authorId ?? null,
          created_at: n.createdAt.toISOString(),
        })),
      },
    };
  },
});

export const crmTools = [addCompanyNoteTool, listCompanyNotesTool];
