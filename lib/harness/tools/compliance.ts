import { z } from "zod";
import { defineTool } from "../tool";
import type { HarnessToolPreview } from "../types";
import {
  listLicenses,
  listTestResults,
  upsertLicense,
  upsertTestResult,
} from "@/lib/modules/compliance";
import { resolveProduct } from "./_helpers";

function confirm(
  title: string,
  summary: string,
  fields: { label: string; value: string }[],
  risk: "low" | "medium" | "high" = "medium",
): HarnessToolPreview {
  return { kind: "confirmation", title, summary, fields, risk };
}

export const createLicenseTool = defineTool({
  name: "create_license",
  description:
    "Register a compliance license by its license number, with an optional display " +
    "name, state, and expiration date.",
  gate: "confirmation",
  inputSchema: z.object({
    license_number: z.string().describe("The license number, e.g. C11-0000123-LIC"),
    name: z.string().optional().describe("Optional display name for the license"),
    state: z.string().optional().describe("Issuing state, e.g. CA"),
    expires_at: z.string().optional().describe("ISO expiration date, e.g. 2026-12-31"),
  }),
  async buildPreview(input) {
    return confirm(
      "Register license",
      `Register license ${input.license_number}.`,
      [
        { label: "License #", value: input.license_number },
        { label: "Name", value: input.name ?? "-" },
        { label: "State", value: input.state ?? "-" },
        { label: "Expires", value: input.expires_at ?? "-" },
      ],
      "low",
    );
  },
  async execute(input, ctx) {
    try {
      const { row } = await upsertLicense(ctx.service, {
        licenseNumber: input.license_number,
        name: input.name ?? null,
        state: input.state ?? null,
        expiresAt: input.expires_at ? new Date(input.expires_at) : null,
      });
      return {
        ok: true,
        summary: `Registered license ${row.licenseNumber}${row.name ? ` (${row.name})` : ""}.`,
        data: { license_number: row.licenseNumber, name: row.name ?? null, state: row.state ?? null },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "License create failed." };
    }
  },
});

export const recordTestResultTool = defineTool({
  name: "record_test_result",
  description:
    "Record a lab test result for a product (matched by SKU or name). `passed` is " +
    "free text, typically PASS, FAIL, or PENDING.",
  gate: "confirmation",
  inputSchema: z.object({
    product: z.string().describe("SKU or product name the test is for"),
    passed: z.string().describe("Result status: PASS, FAIL, or PENDING"),
    tested_at: z.string().optional().describe("ISO date the sample was tested"),
    lab_test_id: z.string().optional().describe("External/METRC lab test id"),
  }),
  async buildPreview(input, ctx) {
    const p = await resolveProduct(ctx.service, { sku: input.product, name: input.product });
    return confirm(
      "Record test result",
      `Record a ${input.passed} test result for ${p?.product.name ?? input.product}.`,
      [
        { label: "Product", value: p ? `${p.product.name} (${p.product.sku})` : input.product },
        { label: "Result", value: input.passed },
        { label: "Tested", value: input.tested_at ?? "-" },
        { label: "Lab test id", value: input.lab_test_id ?? "-" },
      ],
      "low",
    );
  },
  async execute(input, ctx) {
    const p = await resolveProduct(ctx.service, { sku: input.product, name: input.product });
    if (!p) return { ok: false, summary: `No product matched "${input.product}".` };
    try {
      const { row } = await upsertTestResult(ctx.service, {
        productId: p.product.id,
        passed: input.passed,
        metrcLabTestId: input.lab_test_id ?? null,
        testedAt: input.tested_at ? new Date(input.tested_at) : null,
      });
      return {
        ok: true,
        summary: `Recorded ${row.passed ?? input.passed} test result for ${p.product.name}.`,
        data: { product: p.product.name, passed: row.passed ?? null },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "Test result failed." };
    }
  },
});

export const listLicensesTool = defineTool({
  name: "list_licenses",
  description: "List compliance licenses (license number, name, state). Returns compact summaries.",
  gate: "none",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(200).optional(),
  }),
  async execute(input, ctx) {
    const { items, total } = await listLicenses(ctx.service, { limit: input.limit ?? 25 });
    return {
      ok: true,
      summary: `${total} license(s); showing ${items.length}.`,
      data: {
        total,
        licenses: items.map((l) => ({
          license_number: l.licenseNumber,
          name: l.name ?? null,
          state: l.state ?? null,
        })),
      },
    };
  },
});

export const listTestResultsTool = defineTool({
  name: "list_test_results",
  description: "List lab test results (product id, pass/fail status). Returns compact summaries.",
  gate: "none",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(200).optional(),
  }),
  async execute(input, ctx) {
    const { items, total } = await listTestResults(ctx.service, { limit: input.limit ?? 25 });
    return {
      ok: true,
      summary: `${total} test result(s); showing ${items.length}.`,
      data: {
        total,
        test_results: items.map((t) => ({
          product_id: t.productId ?? null,
          passed: t.passed ?? null,
          lab_test_id: t.metrcLabTestId ?? null,
        })),
      },
    };
  },
});

export const complianceTools = [
  createLicenseTool,
  recordTestResultTool,
  listLicensesTool,
  listTestResultsTool,
];
