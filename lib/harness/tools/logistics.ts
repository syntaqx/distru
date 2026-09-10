import { z } from "zod";
import { defineTool, type AgentContext } from "../tool";
import type { HarnessToolPreview } from "../types";
import {
  advanceDeliveryStatus,
  assignDelivery,
  createDeliveryFromOrder,
  getDeliveryEnriched,
  listDeliveries,
  listDrivers,
  listVehicles,
  type DeliveryStatus,
} from "@/lib/modules/logistics";
import { getOrderByNumber } from "@/lib/modules/sales";

function confirm(
  title: string,
  summary: string,
  fields: { label: string; value: string }[],
  risk: "low" | "medium" | "high" = "medium",
): HarnessToolPreview {
  return { kind: "confirmation", title, summary, fields, risk };
}

/** Resolve a driver by name (case-insensitive) within the org. */
async function findDriver(ctx: AgentContext, name: string) {
  const { items } = await listDrivers(ctx.service, { limit: 200 });
  const lc = name.toLowerCase();
  return (
    items.find((d) => d.name.toLowerCase() === lc) ??
    items.find((d) => d.name.toLowerCase().includes(lc)) ??
    null
  );
}

/** Resolve a vehicle by name (case-insensitive) within the org. */
async function findVehicle(ctx: AgentContext, name: string) {
  const { items } = await listVehicles(ctx.service, { limit: 200 });
  const lc = name.toLowerCase();
  return (
    items.find((v) => v.name.toLowerCase() === lc) ??
    items.find((v) => v.name.toLowerCase().includes(lc)) ??
    null
  );
}

function parseWhen(v: string | undefined): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export const createDeliveryTool = defineTool({
  name: "create_delivery",
  description:
    "Create a delivery for a sales order (identified by its order number, e.g. " +
    "SO-0001). Optionally assign a driver and vehicle by name and schedule it. " +
    "The delivery snapshots the order's shipping address. Lands as ASSIGNED when " +
    "a driver is given, otherwise DRAFT.",
  gate: "confirmation",
  inputSchema: z.object({
    order_number: z.string().describe("The sales order number, e.g. SO-0001"),
    driver: z.string().optional().describe("Driver name to assign"),
    vehicle: z.string().optional().describe("Vehicle name to assign"),
    scheduled_datetime: z.string().optional().describe("ISO datetime for the delivery window"),
    notes: z.string().optional(),
  }),
  async buildPreview(input, ctx) {
    const order = await getOrderByNumber(ctx.service, input.order_number);
    const driver = input.driver ? await findDriver(ctx, input.driver) : null;
    const fields = [
      { label: "Order", value: order ? order.order.orderNumber : `${input.order_number} (not found)` },
      { label: "Customer", value: order?.customer?.name ?? "-" },
      { label: "Driver", value: input.driver ? (driver?.name ?? `${input.driver} (unmatched)`) : "unassigned" },
      { label: "Scheduled", value: input.scheduled_datetime ?? "-" },
    ];
    return confirm(
      "Create delivery",
      order
        ? `Create a delivery for ${order.order.orderNumber}.`
        : `Order ${input.order_number} not found.`,
      fields,
      "low",
    );
  },
  async execute(input, ctx) {
    const order = await getOrderByNumber(ctx.service, input.order_number);
    if (!order) return { ok: false, summary: `Order ${input.order_number} not found.` };
    const driver = input.driver ? await findDriver(ctx, input.driver) : null;
    const vehicle = input.vehicle ? await findVehicle(ctx, input.vehicle) : null;
    if (input.driver && !driver) return { ok: false, summary: `Driver "${input.driver}" not found.` };
    if (input.vehicle && !vehicle) return { ok: false, summary: `Vehicle "${input.vehicle}" not found.` };
    try {
      const { row } = await createDeliveryFromOrder(ctx.service, {
        orderId: order.order.id,
        driverId: driver?.id ?? null,
        vehicleId: vehicle?.id ?? null,
        scheduledAt: parseWhen(input.scheduled_datetime) ?? null,
        notes: input.notes ?? null,
      });
      return {
        ok: true,
        summary: `Created delivery for ${order.order.orderNumber} (${row.status})${driver ? `, assigned to ${driver.name}` : ""}.`,
        data: {
          id: row.id,
          status: row.status,
          order_number: order.order.orderNumber,
          driver: driver?.name ?? null,
        },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "Delivery create failed." };
    }
  },
});

export const assignDeliveryTool = defineTool({
  name: "assign_delivery",
  description:
    "Assign a driver (and optionally a vehicle) to an existing delivery by its id, " +
    "or advance its status. Statuses: DRAFT, ASSIGNED, OUT_FOR_DELIVERY, " +
    "DELIVERED, FAILED. Marking OUT_FOR_DELIVERY/DELIVERED moves the underlying " +
    "order's fulfillment status forward.",
  gate: "confirmation",
  inputSchema: z
    .object({
      delivery_id: z.string().describe("The delivery id"),
      driver: z.string().optional().describe("Driver name to assign"),
      vehicle: z.string().optional().describe("Vehicle name to assign"),
      scheduled_datetime: z.string().optional(),
      status: z
        .enum(["DRAFT", "ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"])
        .optional()
        .describe("Advance the delivery to this status"),
    })
    .refine((v) => v.driver || v.status, {
      message: "Provide a driver to assign or a status to advance to.",
    }),
  async buildPreview(input, ctx) {
    const d = await getDeliveryEnriched(ctx.service, input.delivery_id);
    const driver = input.driver ? await findDriver(ctx, input.driver) : null;
    return confirm(
      "Update delivery",
      d
        ? `Update delivery for ${d.orderNumber ?? "order"}.`
        : "Delivery not found.",
      [
        { label: "Current status", value: d?.delivery.status ?? "-" },
        { label: "Driver", value: input.driver ? (driver?.name ?? `${input.driver} (unmatched)`) : (d?.driver?.name ?? "unassigned") },
        { label: "New status", value: input.status ?? "(unchanged)" },
      ],
      input.status === "DELIVERED" ? "medium" : "low",
    );
  },
  async execute(input, ctx) {
    const d = await getDeliveryEnriched(ctx.service, input.delivery_id);
    if (!d) return { ok: false, summary: "Delivery not found." };
    try {
      if (input.driver) {
        const driver = await findDriver(ctx, input.driver);
        if (!driver) return { ok: false, summary: `Driver "${input.driver}" not found.` };
        const vehicle = input.vehicle ? await findVehicle(ctx, input.vehicle) : null;
        if (input.vehicle && !vehicle) return { ok: false, summary: `Vehicle "${input.vehicle}" not found.` };
        await assignDelivery(ctx.service, d.delivery.id, {
          driverId: driver.id,
          vehicleId: vehicle?.id ?? undefined,
          scheduledAt: parseWhen(input.scheduled_datetime),
        });
      }
      let status: DeliveryStatus | undefined;
      if (input.status) {
        const row = await advanceDeliveryStatus(ctx.service, d.delivery.id, input.status);
        status = row.status as DeliveryStatus;
      }
      const after = await getDeliveryEnriched(ctx.service, d.delivery.id);
      return {
        ok: true,
        summary: `Updated delivery for ${d.orderNumber ?? "order"} (${after?.delivery.status ?? status ?? "updated"}).`,
        data: {
          id: d.delivery.id,
          status: after?.delivery.status ?? null,
          driver: after?.driver?.name ?? null,
          vehicle: after?.vehicle?.name ?? null,
        },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "Delivery update failed." };
    }
  },
});

export const listDeliveriesTool = defineTool({
  name: "list_deliveries",
  description:
    "List deliveries with their status, order, customer, and assigned driver. " +
    "Optionally filter by status. Returns compact summaries.",
  gate: "none",
  inputSchema: z.object({
    status: z
      .enum(["DRAFT", "ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"])
      .optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  async execute(input, ctx) {
    const { items, total } = await listDeliveries(ctx.service, {
      status: input.status,
      limit: input.limit ?? 25,
    });
    return {
      ok: true,
      summary: `${total} delivery(ies)${input.status ? ` in ${input.status}` : ""}; showing ${items.length}.`,
      data: {
        total,
        deliveries: items.map((d) => ({
          id: d.delivery.id,
          status: d.delivery.status,
          order_number: d.orderNumber,
          customer: d.customer?.name ?? null,
          driver: d.driver?.name ?? null,
          scheduled_datetime: d.delivery.scheduledAt?.toISOString() ?? null,
        })),
      },
    };
  },
});

export const logisticsTools = [createDeliveryTool, assignDeliveryTool, listDeliveriesTool];
