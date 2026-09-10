import { z } from "zod";
import { defineTool } from "../tool";
import type { HarnessToolPreview } from "../types";
import {
  createArtifact,
  formatReport,
  getArtifact,
  listReportDefs,
  recordDelivery,
  runReport,
} from "@/lib/modules/reports";
import { createNotification } from "@/lib/modules/notifications";
import { getConnection } from "@/lib/modules/platform";
import { getDriveProvider, getEmailProvider } from "@/lib/integrations";

function confirm(
  title: string,
  summary: string,
  fields: { label: string; value: string }[],
  risk: "low" | "medium" | "high" = "medium",
): HarnessToolPreview {
  return { kind: "confirmation", title, summary, fields, risk };
}

export const saveReportTool = defineTool({
  name: "save_report",
  description:
    "Save your output as a durable Report artifact that appears in the Reports " +
    "section and can be emailed or uploaded to Drive. Use this to persist any " +
    "report, summary, or export you produce (instead of only replying with text) " +
    "- especially in an automated workflow. Content is markdown by default.",
  gate: "none",
  inputSchema: z.object({
    title: z.string().describe("Short title, e.g. 'Low-stock report - 2026-09-09'."),
    content: z.string().describe("The full report body. Markdown (tables/headings) renders nicely."),
    format: z.enum(["markdown", "csv", "json", "text"]).optional(),
  }),
  async execute(input, ctx) {
    const art = await createArtifact(ctx.service, {
      title: input.title,
      content: input.content,
      format: input.format ?? "markdown",
      conversationId: ctx.conversationId,
    });
    // A saved report is worth surfacing on the bell.
    await createNotification(ctx.service, {
      userId: ctx.userId,
      kind: "report.ready",
      title: `Report ready: ${art.title}`,
      href: `/reports?id=${art.id}`,
    });
    return {
      ok: true,
      summary: `Saved report "${art.title}". View it in Reports.`,
      data: { report_id: art.id, url: `/reports?id=${art.id}` },
    };
  },
});

export const emailReportTool = defineTool({
  name: "email_report",
  description:
    "Email a saved report (by report_id from save_report) to a recipient. Requires " +
    "an email integration; if none is connected it returns a clear message. Confirm " +
    "the recipient with the user before sending.",
  gate: "confirmation",
  inputSchema: z.object({
    report_id: z.string().describe("The report id returned by save_report."),
    to: z.string().describe("Recipient email address."),
    subject: z.string().optional().describe("Subject line; defaults to the report title."),
  }),
  async buildPreview(input) {
    return confirm(
      "Email report",
      `Email this report to ${input.to}.`,
      [
        { label: "To", value: input.to },
        { label: "Subject", value: input.subject ?? "(report title)" },
      ],
      "medium",
    );
  },
  async execute(input, ctx) {
    const art = await getArtifact(ctx.service, input.report_id);
    if (!art) return { ok: false, summary: `No report with id ${input.report_id}.` };

    // Use the org's configured Email connection - real SMTP creds send for real.
    const conn = await getConnection(ctx.service, "email");
    const email = getEmailProvider(conn?.config);
    if (!email.isConnected()) {
      return {
        ok: false,
        summary: "No email integration is connected. Connect one in Settings → Integrations.",
      };
    }
    const subject = input.subject ?? art.title;
    const res = await email.send({ to: input.to, subject, body: art.content });
    if (!res) return { ok: false, summary: "Email delivery failed." };

    await recordDelivery(ctx.service, art.id, {
      destination: "email",
      target: input.to,
      externalId: res.id,
      at: new Date().toISOString(),
    });
    await createNotification(ctx.service, {
      userId: ctx.userId,
      kind: "delivery.sent",
      title: `Emailed "${art.title}" to ${input.to}`,
      href: `/reports?id=${art.id}`,
    });
    return {
      ok: true,
      summary: `Emailed "${art.title}" to ${input.to}.`,
      data: { messageId: res.id, to: input.to },
    };
  },
});

export const uploadToDriveTool = defineTool({
  name: "upload_to_drive",
  description:
    "Upload a saved report (by report_id) to Google Drive as a file. Requires a " +
    "Drive integration; if none is connected it returns a clear message. Returns a " +
    "shareable link.",
  gate: "confirmation",
  inputSchema: z.object({
    report_id: z.string().describe("The report id returned by save_report."),
    filename: z.string().optional().describe("File name; defaults to the report title."),
    folder: z.string().optional().describe("Destination folder name."),
  }),
  async buildPreview(input) {
    return confirm(
      "Upload to Google Drive",
      "Upload this report to Google Drive.",
      [
        { label: "File", value: input.filename ?? "(report title)" },
        { label: "Folder", value: input.folder ?? "My Drive" },
      ],
      "medium",
    );
  },
  async execute(input, ctx) {
    const art = await getArtifact(ctx.service, input.report_id);
    if (!art) return { ok: false, summary: `No report with id ${input.report_id}.` };

    const drive = getDriveProvider();
    if (!drive.isConnected()) {
      return {
        ok: false,
        summary: "Google Drive is not connected. Connect it in Settings → Integrations.",
      };
    }
    const ext = art.format === "csv" ? "csv" : art.format === "json" ? "json" : "md";
    const filename = input.filename ?? `${art.title}.${ext}`;
    const res = drive.upload({ filename, content: art.content, folder: input.folder });
    if (!res) return { ok: false, summary: "Drive upload failed." };

    await recordDelivery(ctx.service, art.id, {
      destination: "google-drive",
      target: res.url,
      externalId: res.fileId,
      at: new Date().toISOString(),
    });
    await createNotification(ctx.service, {
      userId: ctx.userId,
      kind: "delivery.sent",
      title: `Uploaded "${art.title}" to Google Drive`,
      href: `/reports?id=${art.id}`,
    });
    return {
      ok: true,
      summary: `Uploaded "${filename}" to Google Drive.`,
      data: { fileId: res.fileId, url: res.url },
    };
  },
});

export const generateReportTool = defineTool({
  name: "generate_report",
  description:
    "Run one of the standard Insights reports (the same data the /reports API and the " +
    "Insights page show) and save it as a durable Report artifact - so it appears in " +
    "the Reports section and can be emailed or uploaded to Drive. Great for scheduled " +
    "automations ('every Monday, snapshot sales-by-product and email it'). Report names: " +
    "sales-by-company, sales-by-product, sales-by-user, sales-order-history, invoice-history, " +
    "cogs, inventory-valuation, inventory-assets, inventory-transaction-history, " +
    "purchase-order-history, purchases-by-company, purchases-by-product, order-fulfillment.",
  gate: "none",
  inputSchema: z.object({
    report: z.string().describe("The report name, e.g. 'sales-by-product'."),
    format: z.enum(["markdown", "csv", "json"]).optional().describe("Output format; default markdown."),
    title: z.string().optional().describe("Override the artifact title."),
  }),
  async execute(input, ctx) {
    const result = await runReport(ctx.service, input.report);
    if (!result) {
      return {
        ok: false,
        summary: `Unknown report "${input.report}". Available: ${listReportDefs().map((d) => d.name).join(", ")}.`,
      };
    }
    const def = listReportDefs().find((d) => d.name === input.report)!;
    const format = input.format ?? "markdown";
    const today = new Date().toISOString().slice(0, 10);
    const title = input.title ?? `${def.label} - ${today}`;
    const content = formatReport(result.columns, result.rows, format);
    const art = await createArtifact(ctx.service, {
      title,
      content,
      kind: "report",
      format,
      conversationId: ctx.conversationId,
    });
    await createNotification(ctx.service, {
      userId: ctx.userId,
      kind: "report.ready",
      title: `Report ready: ${title}`,
      href: `/reports?id=${art.id}`,
    });
    return {
      ok: true,
      summary: `Generated "${title}" (${result.rows.length} row${result.rows.length === 1 ? "" : "s"}). Saved to Reports.`,
      data: { report_id: art.id, url: `/reports?id=${art.id}`, rows: result.rows.length },
    };
  },
});

export const reportTools = [saveReportTool, generateReportTool, emailReportTool, uploadToDriveTool];
