import { z } from "zod";
import { defineTool } from "../tool";
import { getFile, getJob, updateJob } from "@/lib/modules/imports";
import { getTarget, listTargets } from "@/lib/imports/registry";
import { classifyDetection } from "@/lib/imports/detect";
import { proposeMapping } from "@/lib/imports/mapping";
import { commitImport, validateImport } from "@/lib/imports/pipeline";
import type { ColumnMapping } from "@/lib/imports/types";

function describeMapping(mapping: ColumnMapping) {
  const mapped = mapping.entries
    .filter((e) => e.sourceColumn)
    .map(
      (e) =>
        `${e.targetField} ← "${e.sourceColumn}" (${Math.round(e.confidence * 100)}%)`,
    );
  const missing = mapping.entries
    .filter((e) => !e.sourceColumn)
    .map((e) => e.targetField);
  return { mapped, missing, unmapped: mapping.unmapped };
}

export const listImportTargets = defineTool({
  name: "list_import_targets",
  description:
    "List the kinds of data that can be imported (e.g. products, customers) with their descriptions.",
  gate: "none",
  inputSchema: z.object({}),
  async execute() {
    const targets = listTargets();
    return {
      ok: true,
      summary: `${targets.length} import targets: ${targets.map((t) => t.key).join(", ")}.`,
      data: {
        targets: targets.map((t) => ({ key: t.key, label: t.label, description: t.description })),
      },
    };
  },
});

export const detectImportTarget = defineTool({
  name: "detect_import_target",
  description:
    "Inspect an uploaded file's columns and rank which import target it most " +
    "likely is (products, customers, …). Use this right after a file is uploaded " +
    "to decide what the file is, then confirm with the user what to do with it.",
  gate: "none",
  inputSchema: z.object({ job_id: z.string() }),
  async execute(input, ctx) {
    const job = await getJob(ctx.service, input.job_id);
    if (!job) return { ok: false, summary: "Import job not found." };
    const file = await getFile(ctx.service, job.fileId);
    if (!file) return { ok: false, summary: "Import file not found." };

    const d = classifyDetection(file.headers);
    const pct = (n: number) => `${Math.round(n * 100)}%`;

    let summary: string;
    if (d.recommendation === "none") {
      summary =
        `No confident match - these columns don't map to any supported import type ` +
        `(${listTargets().map((t) => t.label).join(", ")}). Do NOT guess; tell the user it ` +
        `can't be mapped and ask how to proceed.`;
    } else if (d.recommendation === "ambiguous") {
      summary =
        `Ambiguous - could be ${d.candidates.map((c) => `${c.label} (${pct(c.confidence)})`).join(" or ")}. ` +
        `Ask the user which; do not pick one yourself.`;
    } else {
      summary = `Confident match: ${d.top!.label} (${pct(d.top!.confidence)}). Confirm with the user, then proceed.`;
    }

    return {
      ok: true,
      summary,
      data: {
        recommendation: d.recommendation,
        top: d.top,
        candidates: d.candidates,
        currentTarget: job.targetKey,
        supportedTargets: listTargets().map((t) => ({ key: t.key, label: t.label })),
        headers: file.headers,
        sample: file.sampleRows.slice(0, 5),
        ranked: d.ranked,
      },
    };
  },
});

export const setImportTarget = defineTool({
  name: "set_import_target",
  description:
    "Set what an uploaded file should be imported as (e.g. 'products' or " +
    "'customers'). Resets any existing column mapping so it can be re-proposed.",
  gate: "none",
  inputSchema: z.object({ job_id: z.string(), target_key: z.string() }),
  async execute(input, ctx) {
    try {
      getTarget(input.target_key);
    } catch {
      return {
        ok: false,
        summary: `Unknown import target "${input.target_key}". Use list_import_targets.`,
      };
    }
    await updateJob(ctx.service, input.job_id, {
      targetKey: input.target_key,
      mapping: null,
      status: "UPLOADED",
    });
    return { ok: true, summary: `Import target set to ${input.target_key}.` };
  },
});

export const proposeColumnMapping = defineTool({
  name: "propose_column_mapping",
  description:
    "For an uploaded import job, propose how the file's columns map to the " +
    "target's canonical fields. Saves the proposal as the job's draft mapping.",
  gate: "none",
  inputSchema: z.object({ job_id: z.string() }),
  async execute(input, ctx) {
    const job = await getJob(ctx.service, input.job_id);
    if (!job) return { ok: false, summary: "Import job not found." };
    const file = await getFile(ctx.service, job.fileId);
    if (!file) return { ok: false, summary: "Import file not found." };
    const target = getTarget(job.targetKey);
    const mapping = await proposeMapping(file.headers, file.sampleRows, target);
    await updateJob(ctx.service, input.job_id, { status: "MAPPING", mapping });
    const d = describeMapping(mapping);
    return {
      ok: true,
      summary: `Proposed mapping for ${file.filename}: ${d.mapped.length} fields mapped${d.missing.length ? `, missing: ${d.missing.join(", ")}` : ""}.`,
      data: { mapping, ...d, headers: file.headers },
    };
  },
});

export const setColumnMapping = defineTool({
  name: "set_column_mapping",
  description:
    "Override specific column mappings on an import job (e.g. after the user " +
    "corrects one). Pass target_field → source_column pairs; source_column null unmaps it.",
  gate: "none",
  inputSchema: z.object({
    job_id: z.string(),
    overrides: z.array(
      z.object({
        target_field: z.string(),
        source_column: z.string().nullable(),
      }),
    ),
  }),
  async execute(input, ctx) {
    const job = await getJob(ctx.service, input.job_id);
    if (!job || !job.mapping)
      return { ok: false, summary: "No mapping to override; propose one first." };
    const mapping = job.mapping as ColumnMapping;
    for (const ov of input.overrides) {
      const entry = mapping.entries.find((e) => e.targetField === ov.target_field);
      if (entry) {
        entry.sourceColumn = ov.source_column;
        entry.confidence = ov.source_column ? 1 : 0;
      } else {
        mapping.entries.push({
          targetField: ov.target_field,
          sourceColumn: ov.source_column,
          confidence: ov.source_column ? 1 : 0,
        });
      }
    }
    const used = new Set(mapping.entries.map((e) => e.sourceColumn).filter(Boolean));
    const file = await getFile(ctx.service, job.fileId);
    mapping.unmapped = (file?.headers ?? []).filter((h) => !used.has(h));
    await updateJob(ctx.service, input.job_id, { mapping });
    return { ok: true, summary: "Mapping updated.", data: { mapping } };
  },
});

export const validateImportTool = defineTool({
  name: "validate_import",
  description:
    "Validate every row of an import job against the target schema using the " +
    "current mapping. Returns an aggregate summary (valid/warning/error counts, " +
    "top error reasons, and new categories/vendors that would be created).",
  gate: "none",
  inputSchema: z.object({ job_id: z.string() }),
  async execute(input, ctx) {
    const summary = await validateImport(ctx.service, input.job_id);
    return {
      ok: true,
      summary: `${summary.valid} valid, ${summary.warning} warnings, ${summary.error} errors of ${summary.total} rows.`,
      data: summary,
    };
  },
});

export const commitImportTool = defineTool({
  name: "commit_import",
  description:
    "Commit an import: upsert all valid (and warning) rows into the catalog by " +
    "SKU. Error rows are skipped and available as an error CSV. Partial success.",
  gate: "confirmation",
  async buildPreview(input, ctx) {
    const job = await getJob(ctx.service, input.job_id);
    const willImport = job ? job.validRows + job.warningRows : 0;
    return {
      kind: "confirmation",
      title: "Commit import",
      summary: `Import ${willImport} row(s) into the catalog${job && job.errorRows ? `, skipping ${job.errorRows} error row(s)` : ""}.`,
      fields: [
        { label: "Valid", value: String(job?.validRows ?? 0) },
        { label: "Warnings", value: String(job?.warningRows ?? 0) },
        { label: "Errors (skipped)", value: String(job?.errorRows ?? 0) },
      ],
      risk: "high",
    };
  },
  inputSchema: z.object({ job_id: z.string() }),
  async execute(input, ctx) {
    const job = await getJob(ctx.service, input.job_id);
    const noun = job?.targetKey === "customers" ? "customer(s)" : "record(s)";
    const { committed, errorRows } = await commitImport(ctx.service, input.job_id);
    const errorUrl =
      errorRows > 0 ? `/api/imports/${input.job_id}/errors.csv` : null;
    return {
      ok: true,
      summary: `Imported ${committed} ${noun}${errorRows ? `; ${errorRows} error row(s) skipped (error CSV available).` : "."}`,
      data: { committed, errorRows, errorReportUrl: errorUrl },
    };
  },
});

export const getErrorReport = defineTool({
  name: "get_error_report",
  description:
    "Get the row-mapped error CSV download link for an import job (original " +
    "columns plus the error for each failed row).",
  gate: "none",
  inputSchema: z.object({ job_id: z.string() }),
  async execute(input, ctx) {
    const job = await getJob(ctx.service, input.job_id);
    if (!job) return { ok: false, summary: "Import job not found." };
    return {
      ok: true,
      summary:
        job.errorRows > 0
          ? `${job.errorRows} error rows. Download link ready.`
          : "No error rows.",
      data: {
        errorRows: job.errorRows,
        errorReportUrl:
          job.errorRows > 0 ? `/api/imports/${input.job_id}/errors.csv` : null,
      },
    };
  },
});

export const importTools = [
  listImportTargets,
  detectImportTarget,
  setImportTarget,
  proposeColumnMapping,
  setColumnMapping,
  validateImportTool,
  commitImportTool,
  getErrorReport,
];
