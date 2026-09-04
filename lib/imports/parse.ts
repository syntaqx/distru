import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ParsedFile = {
  headers: string[];
  rows: Record<string, unknown>[];
};

/** Parse a CSV or XLSX buffer into headers + row objects keyed by header. */
export function parseTabular(opts: {
  filename: string;
  contentType: string;
  buffer: Buffer;
}): ParsedFile {
  const isXlsx =
    /\.xlsx?$/i.test(opts.filename) ||
    opts.contentType.includes("sheet") ||
    opts.contentType.includes("excel");

  if (isXlsx) {
    const wb = XLSX.read(opts.buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return { headers: [], rows: [] };
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      raw: false,
    });
    const headerMatrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    const headers = (headerMatrix[0] ?? []).map((h) => String(h ?? "").trim());
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
