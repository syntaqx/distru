import { authenticate, requireScope } from "@/lib/public-api";
import { getAssembly } from "@/lib/modules/manufacturing";
import { simplePdf, pdfResponse } from "@/lib/pdf";

/** GET /api/v1/assemblies/{id}/pdf — a printable assembly (Make) summary. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "manufacturing:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const a = await getAssembly(auth.ctx, id);
  if (!a) {
    return pdfResponse(
      simplePdf(`Assembly ${id}`, ["No data on file."]),
      `assembly-${id}`,
    );
  }

  const lines = [
    `Status: ${a.status}`,
    ...(a.notes ? [`Notes: ${a.notes}`] : []),
    "",
    "Inputs:",
    ...(a.inputs.length
      ? a.inputs.map((i) => `  ${i.productId ?? "-"} x${Number(i.quantity)}`)
      : ["  (none)"]),
    "",
    "Outputs:",
    ...(a.outputs.length
      ? a.outputs.map((o) => `  ${o.productId ?? "-"} x${Number(o.quantity)}`)
      : ["  (none)"]),
  ];
  return pdfResponse(
    simplePdf(`Assembly ${a.assemblyNumber}`, lines),
    `assembly-${a.assemblyNumber}`,
  );
}
