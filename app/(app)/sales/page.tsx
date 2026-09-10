import { getOrgContext } from "@/lib/session";
import { listOrders, orderTotal } from "@/lib/modules/sales";
import { getOrder, getInvoice } from "@/lib/modules/sales";
import { listInvoices, topProducts } from "@/lib/modules/sales";
import {
  SalesManager,
  type InvoiceRow,
  type OrderRow,
  type TopSellerRow,
} from "@/components/sales/sales-manager";
import { SalesSubnav } from "@/components/sales/sales-subnav";

export const dynamic = "force-dynamic";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const view = (await searchParams).view === "invoices" ? "invoices" : "orders";
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = {
    orgId: ctx.orgId,
    actor: ctx.actor,
    actorType: "user" as const,
  };

  const [{ items: orderItems }, { items: invoiceItems }, best] =
    await Promise.all([
      listOrders(service, { limit: 200 }),
      listInvoices(service, { limit: 200 }),
      topProducts(service, { limit: 5 }),
    ]);

  const withLines = await Promise.all(
    orderItems.map((o) => getOrder(service, o.order.id)),
  );
  const orderById = new Map(
    withLines.filter((o) => o != null).map((o) => [o!.order.id, o!]),
  );

  // Full invoice details (for payment history + line-item snapshot in the drawer).
  const invoiceDetails = await Promise.all(
    invoiceItems.map((i) => getInvoice(service, i.invoice.id)),
  );

  // An invoice's order may fall outside the 200-order window above; fetch any
  // missing linked orders directly so the invoice drawer always has line items.
  const missingOrderIds = [
    ...new Set(
      invoiceDetails
        .map((i) => i?.invoice.orderId)
        .filter((id): id is string => !!id && !orderById.has(id)),
    ),
  ];
  const missingOrders = await Promise.all(missingOrderIds.map((id) => getOrder(service, id)));
  for (const o of missingOrders) if (o) orderById.set(o.order.id, o);

  // orderId -> its invoice number, so an order can jump straight to its invoice.
  const invoiceByOrderId = new Map<string, string>();
  for (const inv of invoiceDetails) {
    if (inv?.invoice.orderId)
      invoiceByOrderId.set(inv.invoice.orderId, inv.invoice.invoiceNumber);
  }

  const orders: OrderRow[] = withLines
    .filter((o) => o != null)
    .map((o) => ({
      orderNumber: o!.order.orderNumber,
      status: o!.order.status,
      customer: o!.customer?.name ?? null,
      itemCount: o!.items.length,
      total: orderTotal(o!.items),
      orderDate: o!.order.orderDate.toISOString(),
      invoiceNumber: invoiceByOrderId.get(o!.order.id) ?? null,
      lines: o!.items.map((i) => ({
        sku: i.sku ?? "",
        name: i.name,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
      })),
    }));

  const invoices: InvoiceRow[] = invoiceDetails
    .filter((i) => i != null)
    .map((i) => {
      const order = i!.invoice.orderId ? orderById.get(i!.invoice.orderId) : null;
      return {
        invoiceNumber: i!.invoice.invoiceNumber,
        status: i!.invoice.status,
        voided: i!.invoice.voided,
        customer: i!.customer?.name ?? null,
        total: Number(i!.invoice.total),
        amountPaid: Number(i!.invoice.amountPaid),
        orderNumber: order?.order.orderNumber ?? null,
        issuedAt: i!.invoice.issueDate
          ? new Date(i!.invoice.issueDate).toISOString()
          : null,
        dueAt: i!.invoice.dueDate
          ? new Date(i!.invoice.dueDate).toISOString()
          : null,
        lines: order
          ? order.items.map((l) => ({
              sku: l.sku ?? "",
              name: l.name,
              quantity: Number(l.quantity),
              unitPrice: Number(l.unitPrice),
            }))
          : [],
        payments: i!.payments.map((p) => ({
          amount: Number(p.amount),
          method: p.method,
          paidAt: p.paidAt ? new Date(p.paidAt).toISOString() : null,
        })),
      };
    });

  const topSellers: TopSellerRow[] = best.map((p) => ({
    sku: p.sku,
    name: p.name,
    quantitySold: p.quantitySold,
    revenue: p.revenue,
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold">Sales</h1>
        <p className="text-sm text-muted">
          Orders and invoices. Create them by hand, or ask the Copilot - both
          write the same records and move inventory.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <SalesSubnav />
        <SalesManager
          orders={orders}
          invoices={invoices}
          topSellers={topSellers}
          view={view}
        />
      </div>
    </div>
  );
}
