/** OpenAPI fragment: pdf document endpoints. Populated by its subsystem. */

/** A single PDF document endpoint: its path template plus how to describe it. */
type PdfDef = {
  /** Path template under /public/v1, e.g. "orders/{id}/pdf". */
  path: string;
  summary: string;
  description: string;
  /** Human-facing name of the `{id}` path parameter (for its description). */
  idOf: string;
};

const DOCUMENTS: PdfDef[] = [
  {
    path: "orders/{id}/pdf",
    summary: "Order PDF",
    description:
      "A printable single-page PDF summary of the order: customer, status, date, line items, and total.",
    idOf: "order",
  },
  {
    path: "orders/{id}/test-results/pdf",
    summary: "Order test results PDF",
    description:
      "A PDF of the lab test results (COAs) for the products on the order. A placeholder PDF is returned when none are on file.",
    idOf: "order",
  },
  {
    path: "invoices/{id}/pdf",
    summary: "Invoice PDF",
    description:
      "A printable single-page PDF summary of the invoice: company, status, total, paid, and remaining balance.",
    idOf: "invoice",
  },
  {
    path: "invoices/{id}/test-results/pdf",
    summary: "Invoice test results PDF",
    description:
      "A PDF of the lab test results (COAs) for the products on the invoice. A placeholder PDF is returned when none are on file.",
    idOf: "invoice",
  },
  {
    path: "purchases/{id}/pdf",
    summary: "Purchase order PDF",
    description:
      "A printable single-page PDF summary of the purchase order: vendor, status, date, line items, and total.",
    idOf: "purchase order",
  },
  {
    path: "assemblies/{id}/pdf",
    summary: "Assembly PDF",
    description:
      "A printable single-page PDF summary of the assembly (Make) run: status, notes, and its input and output lines.",
    idOf: "assembly",
  },
  {
    path: "packages/{id}/primary-test-result/pdf",
    summary: "Package primary test result PDF",
    description:
      "A PDF of the primary lab test result (COA) for the package's product. A placeholder PDF is returned when none is on file.",
    idOf: "package",
  },
  {
    path: "batches/{id}/primary-test-result/pdf",
    summary: "Batch primary test result PDF",
    description:
      "A PDF of the primary lab test result (COA) for the batch's product. A placeholder PDF is returned when none is on file.",
    idOf: "batch",
  },
  {
    path: "test-results/{id}/pdf",
    summary: "Test result PDF",
    description:
      "A printable PDF of a single lab test result (COA): product, Metrc lab test, tested date, pass/fail, and analyte values.",
    idOf: "test result",
  },
];

function operation(def: PdfDef) {
  return {
    get: {
      tags: ["PDF"],
      summary: def.summary,
      description: def.description,
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: `The ${def.idOf} id.`,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          description: "A PDF document.",
          content: {
            "application/pdf": { schema: { type: "string", format: "binary" } },
          },
        },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "404": { $ref: "#/components/responses/NotFound" },
      },
    },
  };
}

export const paths: Record<string, unknown> = Object.fromEntries(
  DOCUMENTS.map((def) => [`/public/v1/${def.path}`, operation(def)]),
);

export const schemas: Record<string, unknown> = {};
