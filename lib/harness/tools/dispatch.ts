import { z } from "zod";
import { defineTool } from "../tool";
import type { HarnessToolPreview } from "../types";
import { getFleetTelemetry, simulateTelemetryTick } from "@/lib/modules/logistics";

function confirm(
  title: string,
  summary: string,
  fields: { label: string; value: string }[],
  risk: "low" | "medium" | "high" = "medium",
): HarnessToolPreview {
  return { kind: "confirmation", title, summary, fields, risk };
}

export const fleetTelemetryTool = defineTool({
  name: "fleet_telemetry",
  description:
    "Get the live fleet dispatch snapshot: each vehicle's status (IDLE, " +
    "EN_ROUTE, STOPPED, RETURNING), driver, current speed/heading, the delivery " +
    "it is driving toward (with ETA), and today's delivered/remaining stop counts, " +
    "plus fleet-wide totals. Read-only.",
  gate: "none",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const snapshot = await getFleetTelemetry(ctx.service);
    return {
      ok: true,
      summary: `${snapshot.vehicles.length} vehicle(s): ${snapshot.fleet.enRoute} en route, ${snapshot.fleet.idle} idle, ${snapshot.fleet.stopsRemaining} stop(s) remaining today.`,
      data: {
        fleet: snapshot.fleet,
        vehicles: snapshot.vehicles.map((v) => ({
          vehicle: v.vehicle.name,
          driver: v.driver?.name ?? null,
          status: v.telemetry?.status ?? "IDLE",
          speed_mph: v.telemetry?.speedMph ?? null,
          heading_deg: v.telemetry?.headingDeg ?? null,
          current_stop: v.currentDelivery
            ? {
                order_number: v.currentDelivery.orderNumber,
                customer: v.currentDelivery.customer,
                address: v.currentDelivery.address,
                eta_minutes: v.currentDelivery.etaMinutes,
              }
            : null,
          delivered_today: v.stats.deliveredToday,
          remaining_today: v.stats.remainingToday,
        })),
      },
    };
  },
});

export const advanceDispatchTool = defineTool({
  name: "advance_dispatch",
  description:
    "Advance the simulated dispatch day one tick: every EN_ROUTE vehicle moves a " +
    "step toward its current stop; on arrival the stop is marked DELIVERED and the " +
    "vehicle targets its next stop (or returns to the depot). Deterministic - call " +
    "repeatedly to walk the fleet through the day. Persists the new telemetry.",
  gate: "confirmation",
  inputSchema: z.object({
    ticks: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe("How many steps to advance (default 1)."),
  }),
  async buildPreview(input) {
    const ticks = input.ticks ?? 1;
    return confirm(
      "Advance dispatch",
      `Advance the simulated fleet ${ticks} tick(s).`,
      [{ label: "Ticks", value: String(ticks) }],
      "low",
    );
  },
  async execute(input, ctx) {
    const ticks = input.ticks ?? 1;
    let moved = 0;
    let arrived = 0;
    for (let i = 0; i < ticks; i++) {
      const res = await simulateTelemetryTick(ctx.service);
      moved += res.moved;
      arrived += res.arrived;
    }
    return {
      ok: true,
      summary: `Advanced ${ticks} tick(s): ${moved} vehicle move(s), ${arrived} stop(s) delivered.`,
      data: { ticks, moved, arrived },
    };
  },
});

export const dispatchTools = [fleetTelemetryTool, advanceDispatchTool];
