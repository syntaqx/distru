"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Compass,
  Gauge,
  Navigation,
  Package,
  Search,
  Truck,
  User,
  Warehouse,
  X,
  XCircle,
} from "lucide-react";
import { Select } from "@/components/ui/select";
import { DispatchMap, routeColor } from "./dispatch-map";

type LatLng = { lat: number; lng: number };

export type FleetTelemetrySnapshot = {
  depot: LatLng & { name?: string | null; address?: string | null };
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
    geometry: [number, number][] | null;
    legs: { toDeliveryId: string | null; geometry: [number, number][] }[];
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

type VehicleEntry = FleetTelemetrySnapshot["vehicles"][number];
type RouteEntry = FleetTelemetrySnapshot["routes"][number];

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
  STOPPED: "Dropping off",
};

type SortKey = "remaining" | "progress" | "eta" | "driver" | "status";
const SORTS: { value: string; label: string }[] = [
  { value: "remaining", label: "Sort: Most stops left" },
  { value: "progress", label: "Sort: Progress" },
  { value: "eta", label: "Sort: Soonest ETA" },
  { value: "driver", label: "Sort: Driver A–Z" },
  { value: "status", label: "Sort: Status" },
];
type StatusFilter = "ALL" | "EN_ROUTE" | "RETURNING";

const STOP_COLOR: Record<string, string> = {
  DELIVERED: "#10b981",
  FAILED: "#ef4444",
  OUT_FOR_DELIVERY: "#f59e0b",
};
const stopColor = (s: string) => STOP_COLOR[s] ?? "#94a3b8";

function StopIcon({ status, size = 14 }: { status: string; size?: number }) {
  if (status === "DELIVERED") return <CheckCircle2 size={size} className="shrink-0 text-emerald-500" />;
  if (status === "FAILED") return <XCircle size={size} className="shrink-0 text-red-500" />;
  if (status === "OUT_FOR_DELIVERY") return <Navigation size={size} className="shrink-0 text-amber-500" />;
  return <Circle size={size} className="shrink-0 text-muted" />;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const compass = (deg: number) => COMPASS[Math.round((deg % 360) / 45) % 8];

export function DispatchBoard({ telemetry }: { telemetry: FleetTelemetrySnapshot }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("remaining");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [showParked, setShowParked] = useState(false);
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const { vehicles, fleet } = telemetry;

  // The day runs in real time: refresh the snapshot every few seconds so live
  // positions, ETAs, and drop-offs advance on their own (no manual ticking).
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [router]);

  const deliveredToday = telemetry.stops.filter((s) => s.status === "DELIVERED").length;

  const vehById = useMemo(() => new Map(vehicles.map((v) => [v.vehicle.id, v])), [vehicles]);
  const routeRows = useMemo(() => {
    return telemetry.routes.map((r, i) => {
      const veh = r.vehicleId ? vehById.get(r.vehicleId) : undefined;
      const total = r.stops.length;
      const delivered = r.stops.filter((s) => s.status === "DELIVERED").length;
      const status = veh?.telemetry?.status ?? "IDLE";
      return {
        key: r.driverId,
        index: i,
        color: routeColor(i),
        route: r,
        vehicle: veh,
        vehicleName: veh?.vehicle.name ?? "",
        total,
        delivered,
        remaining: total - delivered,
        pct: total ? delivered / total : 0,
        status,
        eta: veh?.currentDelivery?.etaMinutes ?? null,
        current: veh?.currentDelivery ?? null,
      };
    });
  }, [telemetry.routes, vehById]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = routeRows;
    if (statusFilter !== "ALL") list = list.filter((r) => r.status === statusFilter);
    if (q) {
      list = list.filter(
        (r) =>
          r.route.driverName.toLowerCase().includes(q) ||
          r.vehicleName.toLowerCase().includes(q) ||
          r.route.stops.some((s) => (s.customer ?? "").toLowerCase().includes(q)),
      );
    }
    const byStatus = (s: string) => (s === "EN_ROUTE" ? 0 : s === "STOPPED" ? 1 : s === "RETURNING" ? 2 : 3);
    return [...list].sort((a, b) => {
      switch (sort) {
        case "remaining":
          return b.remaining - a.remaining || a.index - b.index;
        case "progress":
          return b.pct - a.pct || a.index - b.index;
        case "eta":
          return (a.eta ?? 1e9) - (b.eta ?? 1e9);
        case "driver":
          return a.route.driverName.localeCompare(b.route.driverName);
        case "status":
          return byStatus(a.status) - byStatus(b.status) || b.remaining - a.remaining;
      }
    });
  }, [routeRows, query, sort, statusFilter]);

  const selectedRow = useMemo(
    () => (selected ? routeRows.find((r) => r.vehicle?.vehicle.id === selected) ?? null : null),
    [selected, routeRows],
  );

  const parked = vehicles.filter((v) => (v.telemetry?.status ?? "IDLE") === "IDLE");
  const clock = mounted ? new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "—";

  const stats: [string, number, string][] = [
    ["En route", fleet.enRoute, VEHICLE_COLOR.EN_ROUTE],
    ["Dropping", vehicles.filter((v) => v.telemetry?.status === "STOPPED").length, VEHICLE_COLOR.STOPPED],
    ["Returning", fleet.returning, VEHICLE_COLOR.RETURNING],
    ["Stops left", fleet.stopsRemaining, "#f59e0b"],
    ["Delivered", deliveredToday, "#10b981"],
  ];

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden rounded-xl border">
      {/* Docked left list */}
      <aside className="flex w-80 shrink-0 flex-col border-r sm:w-90" style={{ background: "var(--color-surface)" }}>
        <div className="shrink-0 space-y-2 border-b p-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input w-full pl-8 text-sm" placeholder="Search driver, van, or stop…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)} options={SORTS} ariaLabel="Sort routes" />
          <div className="flex items-center gap-1">
            {([
              ["ALL", "All", telemetry.routes.length],
              ["EN_ROUTE", "En route", fleet.enRoute],
              ["RETURNING", "Returning", fleet.returning],
            ] as [StatusFilter, string, number][]).map(([key, label, n]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className="flex-1 rounded-md border px-2 py-1 text-[11px] transition-colors"
                style={statusFilter === key ? { background: "var(--color-surface2)", borderColor: "var(--color-accent)", color: "var(--color-fg)" } : { color: "var(--color-muted)" }}
              >
                {label} {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2">
          {rows.length === 0 && <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted">No routes match.</div>}
          {rows.map((r) => {
            const sc = VEHICLE_COLOR[r.status] ?? "#94a3b8";
            const pct = Math.round(r.pct * 100);
            const isSel = selected === r.vehicle?.vehicle.id;
            return (
              <button
                key={r.key}
                onClick={() => setSelected(isSel ? null : r.vehicle?.vehicle.id ?? null)}
                className="card flex items-start gap-2.5 p-2.5 text-left transition-shadow hover:shadow-md"
                style={isSel ? { boxShadow: `0 0 0 2px ${r.color}` } : undefined}
              >
                <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{r.route.driverName}</span>
                    <span className="badge shrink-0 text-[10px]" style={{ color: sc, borderColor: sc }}>{STATUS_LABEL[r.status] ?? r.status}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                    <Truck size={12} className="shrink-0" />
                    <span className="truncate">{r.vehicleName}</span>
                    {r.eta != null && r.status === "EN_ROUTE" && (
                      <span className="ml-auto flex items-center gap-1 whitespace-nowrap"><Clock size={11} /> ~{r.eta}m</span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--color-surface2)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color }} />
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted">{r.delivered}/{r.total}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="mt-0.5 shrink-0 text-muted" />
              </button>
            );
          })}

          {parked.length > 0 && (
            <div className="card p-0">
              <button className="flex w-full items-center gap-2.5 p-2.5 text-left" onClick={() => setShowParked((s) => !s)}>
                <Warehouse size={15} className="shrink-0 text-muted" />
                <span className="flex-1 text-sm font-medium">Parked at depot</span>
                <span className="badge text-[11px]">{parked.length}</span>
                <ChevronDown size={16} className="shrink-0 text-muted transition-transform" style={{ transform: showParked ? "rotate(180deg)" : undefined }} />
              </button>
              {showParked && (
                <ul className="grid grid-cols-2 gap-x-3 border-t px-3 py-2 text-xs text-muted">
                  {parked.map((v) => (
                    <li key={v.vehicle.id} className="flex items-center gap-1.5 truncate py-0.5">
                      <Package size={11} className="shrink-0" />
                      <span className="truncate">{v.vehicle.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Map area with a slim live bar + the driver overlay */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3 py-2" style={{ background: "var(--color-surface)" }}>
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <Warehouse size={14} className="text-sky-500" /> {telemetry.depot.name ?? "Depot"}
          </span>
          <span className="hidden text-xs text-muted md:inline">{vehicles.length} vehicles · {telemetry.routes.length} routes</span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {stats.map(([label, value, color]) => (
              <span key={label} className="inline-flex items-center gap-1 text-xs">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                <span className="font-semibold tabular-nums">{value}</span>
                <span className="hidden text-muted lg:inline">{label}</span>
              </span>
            ))}
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live · {clock}
          </span>
        </div>
        <div className="relative min-h-0 flex-1">
          <DispatchMap telemetry={telemetry} selected={selected} onSelect={setSelected} follow />
          {selectedRow && <DriverOverlay row={selectedRow} depotName={telemetry.depot.name ?? "Depot"} onClose={() => setSelected(null)} />}
        </div>
      </div>
    </div>
  );
}

type Row = {
  color: string;
  route: RouteEntry;
  vehicle: VehicleEntry | undefined;
  vehicleName: string;
  total: number;
  delivered: number;
  pct: number;
  status: string;
  eta: number | null;
  current: VehicleEntry["currentDelivery"];
};

/**
 * The bottom overlay that appears over the map when a driver is selected: their
 * live vehicle data on the left and a horizontal activity timeline of the run's
 * stops on the right - so you can watch what's happening without the sidebar
 * taking over, while the map auto-follows the vehicle.
 */
function DriverOverlay({ row, depotName, onClose }: { row: Row; depotName: string; onClose: () => void }) {
  const v = row.vehicle;
  const t = v?.telemetry;
  const sc = VEHICLE_COLOR[row.status] ?? "#94a3b8";
  const pct = Math.round(row.pct * 100);
  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-10 overflow-hidden rounded-xl border shadow-2xl" style={{ background: "color-mix(in srgb, var(--color-surface) 94%, transparent)", backdropFilter: "blur(8px)" }}>
      <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-stretch">
        {/* Vehicle summary */}
        <div className="lg:w-80 lg:shrink-0 lg:border-r lg:pr-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: row.color }} />
            <span className="truncate text-sm font-semibold">{row.route.driverName}</span>
            <span className="badge shrink-0 text-[10px]" style={{ color: sc, borderColor: sc }}>{STATUS_LABEL[row.status] ?? row.status}</span>
            <button className="ml-auto rounded-md p-1 text-muted hover:bg-surface2 hover:text-fg lg:hidden" onClick={onClose} aria-label="Close"><X size={15} /></button>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
            <Truck size={12} className="shrink-0" />
            <span className="truncate">
              {v?.vehicle.name}
              {(v?.vehicle.make || v?.vehicle.model) && ` · ${[v?.vehicle.make, v?.vehicle.model].filter(Boolean).join(" ")}`}
            </span>
            {v?.vehicle.licensePlate && <span className="badge ml-auto shrink-0 font-mono text-[10px]">{v.vehicle.licensePlate}</span>}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--color-surface2)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: row.color }} />
            </div>
            <span className="shrink-0 text-xs font-medium tabular-nums">{row.delivered}/{row.total}</span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
            <Metric icon={<User size={11} />} label="Driver" value={(v?.driver?.name ?? "—").split(" ")[0]} />
            <Metric icon={<Gauge size={11} />} label="Speed" value={t ? `${Math.round(t.speedMph)}` : "—"} />
            <Metric icon={<Compass size={11} />} label="Head" value={t ? compass(t.headingDeg) : "—"} />
            <Metric icon={<Clock size={11} />} label="ETA" value={row.eta != null && row.status === "EN_ROUTE" ? `${row.eta}m` : row.status === "RETURNING" ? "↩" : "—"} />
          </div>
        </div>

        {/* Horizontal activity timeline */}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Run · {row.total} stops{row.current && row.status === "EN_ROUTE" ? ` · next: ${row.current.customer ?? "stop"}` : ""}</span>
            <button className="hidden rounded-md p-1 text-muted hover:bg-surface2 hover:text-fg lg:block" onClick={onClose} aria-label="Close"><X size={15} /></button>
          </div>
          <div className="flex items-start gap-0 overflow-x-auto pb-1">
            <TimelineNode icon={<Warehouse size={14} className="text-sky-500" />} label={depotName} sub="Depart" />
            {row.route.stops.map((s) => (
              <TimelineNode
                key={s.id}
                connectorColor={s.status === "DELIVERED" ? "#10b981" : "var(--color-border)"}
                icon={<StopIcon status={s.status} />}
                seq={s.sequence ?? undefined}
                label={s.customer ?? s.orderNumber ?? "Stop"}
                sub={s.status === "OUT_FOR_DELIVERY" ? "current" : s.status === "DELIVERED" ? "done" : ""}
                highlight={s.status === "OUT_FOR_DELIVERY"}
                color={stopColor(s.status)}
              />
            ))}
            <TimelineNode connectorColor="var(--color-border)" icon={<Warehouse size={14} className="text-sky-500" />} label={depotName} sub="Return" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border p-1.5" style={{ background: "var(--color-surface2)" }}>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-muted">{icon} {label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold text-fg">{value}</div>
    </div>
  );
}

function TimelineNode({
  icon,
  seq,
  label,
  sub,
  connectorColor,
  highlight,
  color,
}: {
  icon: ReactNode;
  seq?: number;
  label: string;
  sub?: string;
  connectorColor?: string;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div className="flex min-w-0 shrink-0 items-start">
      {connectorColor && <div className="mt-3.5 h-0.5 w-6 shrink-0" style={{ background: connectorColor }} />}
      <div className="flex w-20 flex-col items-center px-1 text-center">
        <div className="grid h-7 w-7 place-items-center rounded-full border-2" style={{ borderColor: highlight ? color : "transparent", background: "var(--color-surface)" }}>
          {icon}
        </div>
        {seq != null && <span className="mt-0.5 text-[10px] tabular-nums text-muted">#{seq}</span>}
        <span className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-tight">{label}</span>
        {sub && <span className="text-[10px] capitalize text-muted">{sub}</span>}
      </div>
    </div>
  );
}
