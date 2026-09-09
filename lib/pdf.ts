/**
 * Minimal, dependency-free PDF generation. The public API's document endpoints
 * hand back real, openable PDFs, but the CDN/dependency surface is constrained,
 * so we hand-build a single-page PDF from scratch: header, catalog, pages node,
 * one page (Letter — MediaBox [0 0 612 792]), a Helvetica font, and a content
 * stream that draws the title plus each line at descending y positions. Byte
 * offsets in the xref table are computed from the fully assembled string, so the
 * result is a valid PDF that any reader can open.
 */

/** Escape the PDF string delimiters `(`, `)`, and the escape char `\`. */
function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Coerce a line to characters a Helvetica (Latin-1) string literal can hold:
 * anything above code point 255 becomes `?`, and control characters (except the
 * ones we never emit) are dropped so 1 JS char == 1 emitted byte, which keeps
 * the xref offsets we compute from string length exact.
 */
function sanitize(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 32) out += " ";
    else if (code > 255) out += "?";
    else out += ch;
  }
  return out;
}

/**
 * Build a minimal valid single-page PDF drawing `title` (large) followed by each
 * of `lines` (smaller) down the page. Returns the raw bytes.
 */
export function simplePdf(title: string, lines: string[]): Uint8Array {
  // --- content stream: one BT/ET text block per line at an absolute y ---
  const commands: string[] = [];
  let y = 740;
  commands.push(`BT /F1 18 Tf 50 ${y} Td (${escapeText(sanitize(title))}) Tj ET`);
  y -= 30;
  for (const raw of lines) {
    if (y < 40) break; // stay on the single page
    commands.push(`BT /F1 11 Tf 50 ${y} Td (${escapeText(sanitize(raw))}) Tj ET`);
    y -= 16;
  }
  const content = commands.join("\n");

  // --- objects ---
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  // --- body, tracking each object's byte offset ---
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets[i] = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  // --- xref table (each entry is exactly 20 bytes) ---
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;

  // Latin-1 encode: sanitize() guarantees every char is <= 255, so charCodeAt
  // maps 1:1 to a byte and the computed offsets remain exact.
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

/** Build the `Response` for a PDF: correct content type and inline filename. */
export function pdfResponse(bytes: Uint8Array, filename: string): Response {
  // Copy into a standalone ArrayBuffer so the body is an unambiguous
  // BufferSource (sidesteps the Uint8Array<ArrayBufferLike> / BodyInit split).
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}.pdf"`,
    },
  });
}
