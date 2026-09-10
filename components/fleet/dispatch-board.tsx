"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gauge, MapPin, Navigation, Package, Truck, User, Zap } from "lucide-react";
import { advanceDispatchAction } from "@/app/(app)/fleet/actions";
import { DispatchMap } from "./dispatch-map";

// ---- Types (mirror the FleetTelemetry snapshot from the telemetry service) ----

type LatLng = { lat: number; lng: number };

export type FleetTelemetrySnapshot = {
  depot: LatLng;
  bounds: { south: number; north: number; west: number; east: number };
  vehicles: {
    vehicle: {
      id: string;
      name: string;
      make: string | null;
      model: string | null;
      licensePlate: string | null;
      baseLat: number | null;
      baseLng: number | null;
    };
    telemetry: {
      lat: number;
      lng: number;
      speedMph: number;
      headingDeg: number;
      status: string;
      updatedAt: string | null;
    } | null;
    driver: { id: string; name: string } | null;
    currentDelivery: {
      id: string;
      orderNumber: string | null;
      customer: string | null;
      address: string | null;
      lat: number | null;
      lng: number | null;
      sequence: number | null;
      status: string;
      etaMinutes: number | null;
    } | null;
    stats: { deliveredToday: number; remainingToday: number; totalToday: number };
  }[];
  stops: {
    id: string;
    orderNumber: string | null;
    customer: string | null;
    address: string | null;
    lat: number;
    lng: number;
    status: string;
    sequence: number | null;
  }[];
  routes: {
    driverId: string;
    driverName: string;
    vehicleId: string | null;
    stops: {
      id: string;
      lat: number;
      lng: number;
      sequence: number | null;
      status: string;
      customer: string | null;
      orderNumber: string | null;
      address: string | null;
    }[];
  }[];
  fleet: { enRoute: number; idle: number; returning: number; stopsRemaining: number };
};

const VEHICLE_COLOR: Record<string, string> = {
  EN_ROUTE: "#f59e0b",
  IDLE: "#94a3b8",
  RETURNING: "#3b82f6",
  STOPPED: "#a855f7",
};

const STATUS_LABEL: Record<string, string> = {
  EN_ROUTE: "En route",
  IDLE: "Idle",
  RETURNING: "Returning",
  STOPPED: "Stopped",
};

export function DispatchBoard({ telemetry }: { telemetry: FleetTelemetrySnapshot }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  // Locale time formatting differs server vs. client (timezone), so only render
  // it after mount to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const { vehicles, fleet } = telemetry;

  function simulate() {
    startTransition(async () => {
      await advanceDispatchAction(1);
      router.refresh();
    });
  }

  const updatedLabel = (iso: string | null) => {
    if (!iso || !mounted) return "—";
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div>
      {/* Fleet stat row */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["En route", fleet.enRoute, VEHICLE_COLOR.EN_ROUTE],
          ["Idle", fleet.idle, VEHICLE_COLOR.IDLE],
          ["Returning", fleet.returning, VEHICLE_COLOR.RETURNING],
          ["Stops remaining", fleet.stopsRemaining, "#10b981"],
        ].map(([label, value, color]) => (
          <div key={label as string} className="card">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: color as string }} />
              {label}
            </div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        {/* Live WebGL map */}
        <div className="rounded-xl border p-2" style={{ background: "var(--color-surface)" }}>
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Navigation size={15} className="text-muted" />
              Austin, TX — live fleet
            </div>
            <button className="btn btn-outline px-2 py-1 text-xs" onClick={simulate} disabled={pending}>
              <Zap size={13} /> {pending ? "Advancing…" : "Simulate tick"}
            </button>
          </div>
          <DispatchMap telemetry={telemetry} selected={selected} onSelect={setSelected} />
        </div>

        {/* Telemetry side panel */}
        <div className="flex flex-col gap-3">
          {vehicles.length === 0 && (
            <div className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted">
              No vehicles yet. Add a vehicle to start dispatching.
            </div>
          )}
          {vehicles.map((v) => {
            const t = v.telemetry;
            const status = t?.status ?? "IDLE";
            const color = VEHICLE_COLOR[status] ?? "#94a3b8";
            const isSel = selected === v.vehicle.id;
            return (
              <button
                key={v.vehicle.id}
                onClick={() => setSelected(isSel ? null : v.vehicle.id)}
                className="card w-full p-3 text-left transition-shadow"
                style={isSel ? { boxShadow: `0 0 0 2px ${color}` } : undefined}
              >
                <div className="flex items-center gap-2">
                  <Truck size={15} style={{ color }} />
                  <span className="text-sm font-semibold">{v.vehicle.name}</span>
                  <span className="badge ml-auto text-xs" style={{ color, borderColor: color }}>
                    {STATUS_LABEL[status] ?? status}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted">
                  <div className="flex items-center gap-1.5">
                    <User size={12} className="shrink-0" />
                    <span className="truncate">{v.driver?.name ?? "Unassigned"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Gauge size={12} className="shrink-0" />
                    <span>{t ? `${Math.round(t.speedMph)} mph` : "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Navigation size={12} className="shrink-0" />
                    <span>{t ? `${t.headingDeg}°` : "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Package size={12} className="shrink-0" />
                    <span>
                      {v.stats.deliveredToday}/{v.stats.totalToday} done
                    </span>
                  </div>
                </div>

                {v.currentDelivery ? (
                  <div className="mt-2 rounded-lg border p-2 text-xs" style={{ background: "var(--color-surface2)" }}>
                    <div className="flex items-center gap-1.5 font-medium text-fg">
                      <MapPin size={12} style={{ color }} className="shrink-0" />
                      {v.currentDelivery.customer ?? v.currentDelivery.orderNumber ?? "Current stop"}
                    </div>
                    {v.currentDelivery.address && <div className="mt-0.5 text-muted">{v.currentDelivery.address}</div>}
                    <div className="mt-1 flex items-center justify-between text-muted">
                      <span>{v.currentDelivery.orderNumber ?? ""}</span>
                      {v.currentDelivery.etaMinutes != null && (
                        <span className="font-medium text-fg">ETA ~{v.currentDelivery.etaMinutes} min</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-muted">
                    {status === "IDLE" ? "Parked at depot." : "No active stop."}
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                  <span>{v.stats.remainingToday} stop(s) remaining today</span>
                  <span>Ping {updatedLabel(t?.updatedAt ?? null)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
