import { z } from "zod";
import { defineTool } from "../tool";
import { getFleetTelemetry } from "@/lib/modules/logistics";

export const fleetTelemetryTool = defineTool({
  name: "fleet_telemetry",
  description:
    "Get the live fleet dispatch snapshot: each vehicle's status (IDLE, " +
    "EN_ROUTE, STOPPED, RETURNING), driver, current speed/heading, the delivery " +
    "it is driving toward (with ETA), and today's delivered/remaining stop counts, " +
    "plus fleet-wide totals. The day is real-time (positions derive from the clock), " +
    "so this reflects wherever the fleet is right now. Read-only.",
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

export const dispatchTools = [fleetTelemetryTool];
