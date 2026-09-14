import Papa from "papaparse";
import ExcelJS from "exceljs";

export type ParsedFile = {
  headers: string[];
  rows: Record<string, unknown>[];
};

/** Parse a CSV or XLSX buffer into headers + row objects keyed by header. */
export async function parseTabular(opts: {
  filename: string;
  contentType: string;
  buffer: Buffer;
}): Promise<ParsedFile> {
  const isXlsx =
    /\.xlsx?$/i.test(opts.filename) ||
    opts.contentType.includes("sheet") ||
    opts.contentType.includes("excel");

  if (isXlsx) {
    const wb = new ExcelJS.Workbook();
    // exceljs types the arg as Buffer<ArrayBuffer>, while a Node Buffer from
    // file uploads is Buffer<ArrayBufferLike> under @types/node 26 — identical
    // bytes at runtime, so narrow to exceljs's expected param type here.
    await wb.xlsx.load(opts.buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.worksheets[0];
    if (!ws) return { headers: [], rows: [] };

    // Row 1 is the header row. ExcelJS `row.values` is 1-based (index 0 is an
    // unused hole), so drop the leading element before mapping.
    const headerCells = (ws.getRow(1).values as unknown[]) ?? [];
    const headers = headerCells.slice(1).map((h) => String(h ?? "").trim());
    if (headers.length === 0) return { headers: [], rows: [] };

    const rows: Record<string, unknown>[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip the header row
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        const cell = row.getCell(i + 1);
        const value = cell.value;
        // Mirror the old xlsx `raw: false` + `defval: null` behavior: emit the
        // cell's formatted text (dates/numbers as displayed), null when empty.
        obj[h] =
          value === null || value === undefined || value === "" ? null : cell.text;
      });
      rows.push(obj);
    });
    return { headers, rows };
  }

  const text = opts.buffer.toString("utf8");
  const res = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const headers = (res.meta.fields ?? []).map((h) => h.trim());
  return { headers, rows: res.data };
}
