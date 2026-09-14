import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { parseTabular } from "@/lib/imports/parse";

async function xlsxBuffer(rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  rows.forEach((r) => ws.addRow(r));
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab as ArrayBuffer);
}

describe("parseTabular", () => {
  it("parses an xlsx buffer into headers + rows keyed by header", async () => {
    const buffer = await xlsxBuffer([
      ["Name", "SKU", "Price"],
      ["Blue Dream", "BD-1", 42],
      ["OG Kush", "OG-2", 55],
    ]);

    const parsed = await parseTabular({
      filename: "catalog.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    });

    expect(parsed.headers).toEqual(["Name", "SKU", "Price"]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toEqual({ Name: "Blue Dream", SKU: "BD-1", Price: "42" });
    expect(parsed.rows[1].Name).toBe("OG Kush");
  });

  it("returns empty when the sheet has no rows", async () => {
    const buffer = await xlsxBuffer([]);
    const parsed = await parseTabular({
      filename: "empty.xlsx",
      contentType: "application/vnd.ms-excel",
      buffer,
    });
    expect(parsed.headers).toEqual([]);
    expect(parsed.rows).toEqual([]);
  });

  it("still parses CSV via the text path", async () => {
    const parsed = await parseTabular({
      filename: "catalog.csv",
      contentType: "text/csv",
      buffer: Buffer.from("Name, SKU\nBlue Dream,BD-1\n", "utf8"),
    });
    expect(parsed.headers).toEqual(["Name", "SKU"]);
    expect(parsed.rows[0]).toEqual({ Name: "Blue Dream", SKU: "BD-1" });
  });
});
