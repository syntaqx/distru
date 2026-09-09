import { authenticate, dateRange, requireScope } from "@/lib/public-api";
import { listInvoices, type InvoiceStatus } from "@/lib/modules/sales";
import { datetime, num } from "@/lib/modules/shared";
import { reportEnvelope } from "../_report";

const COLUMNS = [
  { key: "invoice_number", label: "Invoice Number" },
  { key: "company", label: "Company" },
  { key: "status", label: "Status" },
  { key: "invoice_datetime", label: "Invoice Date" },
  { key: "due_datetime", label: "Due Date" },
  { key: "subtotal", label: "Subtotal" },
  { key: "tax_total", label: "Tax" },
  { key: "total", label: "Total" },
  { key: "paid_amount", label: "Paid" },
  { key: "balance", label: "Balance" },
];

/** One row per invoice: totals, payment status, and outstanding balance. */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") as InvoiceStatus | null;
  const { from, to } = dateRange(req, "invoice_datetime");
  const { items } = await listInvoices(auth.ctx, {
    status: status ?? undefined,
    updatedFrom: from,
    updatedTo: to,
    limit: 200,
  });
  return Response.json(
    reportEnvelope(
      COLUMNS,
      items.map(({ invoice, customer }) => {
        const balance =
          Number(invoice.total) - Number(invoice.amountPaid) - Number(invoice.creditsApplied);
        return {
          invoice_number: invoice.invoiceNumber,
          company: customer?.name ?? null,
          status: invoice.status,
          invoice_datetime: datetime(invoice.issueDate),
          due_datetime: datetime(invoice.dueDate),
          subtotal: num(invoice.subtotal),
          tax_total: num(invoice.taxTotal),
          total: num(invoice.total),
          paid_amount: num(invoice.amountPaid),
          balance: num(balance),
        };
      }),
    ),
  );
}
