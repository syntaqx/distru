"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  MapPin,
  Package,
  Plus,
  Truck,
  User,
  X,
} from "lucide-react";
import {
  advanceDeliveryAction,
  assignDeliveryAction,
  createDeliveryAction,
} from "@/app/(app)/fleet/actions";

export type DeliveryStatus =
  | "DRAFT"
  | "ASSIGNED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED";

export type DeliveryRow = {
  id: string;
  status: DeliveryStatus;
  orderId: string | null;
  orderNumber: string | null;
  customerName: string | null;
  driverId: string | null;
  driverName: string | null;
  vehicleName: string | null;
  sequence: number | null;
  scheduledAt: string | null;
  deliveredAt: string | null;
  address: string | null;
  notes: string | null;
};

type NamedRow = { id: string; name: string };
type AssignableOrder = {
  id: string;
  orderNumber: string;
  customerName: string | null;
  status: string;
};

const STATUS_ORDER: DeliveryStatus[] = [
  "DRAFT",
  "ASSIGNED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
];

const STATUS_META: Record<DeliveryStatus, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "#94a3b8" },
  ASSIGNED: { label: "Assigned", color: "#3b82f6" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", color: "#f59e0b" },
  DELIVERED: { label: "Delivered", color: "#10b981" },
  FAILED: { label: "Failed", color: "#ef4444" },
};

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toLocalDateInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function DeliveriesBoard({
  deliveries,
  drivers,
  vehicles,
  assignableOrders,
}: {
  deliveries: DeliveryRow[];
  drivers: NamedRow[];
  vehicles: NamedRow[];
  assignableOrders: AssignableOrder[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"board" | "manifest">("board");
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState<DeliveryRow | null>(null);

  const [manifestDriver, setManifestDriver] = useState<string>(drivers[0]?.id ?? "");
  const [manifestDate, setManifestDate] = useState<string>(toLocalDateInput(null));

  function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key);
    setError(null);
    startTransition(async () => {
      const res = await fn();
      setBusy(null);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else router.refresh();
    });
  }

  const byStatus = useMemo(() => {
    const map: Record<DeliveryStatus, DeliveryRow[]> = {
      DRAFT: [],
      ASSIGNED: [],
      OUT_FOR_DELIVERY: [],
      DELIVERED: [],
      FAILED: [],
    };
    for (const d of deliveries) map[d.status].push(d);
    return map;
  }, [deliveries]);

  const manifestStops = useMemo(() => {
    return deliveries
      .filter(
        (d) =>
          d.driverId === manifestDriver &&
          d.scheduledAt != null &&
          toLocalDateInput(d.scheduledAt) === manifestDate,
      )
      .sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999));
  }, [deliveries, manifestDriver, manifestDate]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div
          className="inline-flex rounded-lg border p-0.5"
          style={{ background: "var(--color-surface)" }}
        >
          {(["board", "manifest"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize transition-colors ${
                view === v ? "text-fg" : "text-muted hover:text-fg"
              }`}
              style={view === v ? { background: "var(--color-surface2)" } : undefined}
            >
              {v === "manifest" ? "Driver manifest" : "Board"}
            </button>
          ))}
        </div>
        <button
          className="btn btn-primary ml-auto"
          onClick={() => {
            setError(null);
            setCreating(true);
          }}
          disabled={assignableOrders.length === 0}
          title={
            assignableOrders.length === 0
              ? "No active orders awaiting a delivery"
              : "Create a delivery from an order"
          }
        >
          <Plus size={16} /> New delivery
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {view === "board" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {STATUS_ORDER.map((status) => (
            <div key={status} className="flex flex-col">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: STATUS_META[status].color }}
                />
                <span className="text-sm font-medium">{STATUS_META[status].label}</span>
                <span className="ml-auto text-xs text-muted">{byStatus[status].length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {byStatus[status].map((d) => (
                  <DeliveryCard
                    key={d.id}
                    d={d}
                    busy={busy === d.id}
                    onAssign={() => {
                      setError(null);
                      setAssigning(d);
                    }}
                    onAdvance={(next) =>
                      run(d.id, () => advanceDeliveryAction({ id: d.id, status: next }))
                    }
                  />
                ))}
                {byStatus[status].length === 0 && (
                  <div className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted">
                    None
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ManifestView
          drivers={drivers}
          stops={manifestStops}
          driverId={manifestDriver}
          date={manifestDate}
          busy={busy}
          onDriver={setManifestDriver}
          onDate={setManifestDate}
          onAdvance={(id, next) => run(id, () => advanceDeliveryAction({ id, status: next }))}
        />
      )}

      {creating && (
        <NewDeliveryDialog
          orders={assignableOrders}
          drivers={drivers}
          vehicles={vehicles}
          onClose={() => setCreating(false)}
          onSubmit={(payload) => {
            setBusy("create");
            setError(null);
            startTransition(async () => {
              const res = await createDeliveryAction(payload);
              setBusy(null);
              if (!res.ok) setError(res.error ?? "Could not create delivery.");
              else {
                setCreating(false);
                router.refresh();
              }
            });
          }}
          submitting={busy === "create"}
        />
      )}

      {assigning && (
        <AssignDialog
          delivery={assigning}
          drivers={drivers}
          vehicles={vehicles}
          onClose={() => setAssigning(null)}
          onSubmit={(payload) => {
            setBusy(assigning.id);
            setError(null);
            startTransition(async () => {
              const res = await assignDeliveryAction({ id: assigning.id, ...payload });
              setBusy(null);
              if (!res.ok) setError(res.error ?? "Could not assign delivery.");
              else {
                setAssigning(null);
                router.refresh();
              }
            });
          }}
          submitting={busy === assigning.id}
        />
      )}
    </div>
  );
}

function DeliveryCard({
  d,
  busy,
  onAssign,
  onAdvance,
}: {
  d: DeliveryRow;
  busy: boolean;
  onAssign: () => void;
  onAdvance: (next: DeliveryStatus) => void;
}) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-2">
        <Package size={14} className="text-muted" />
        <span className="text-sm font-medium">{d.orderNumber ?? "Order"}</span>
        {d.sequence != null && (
          <span className="badge ml-auto text-xs">Stop {d.sequence}</span>
        )}
      </div>
      {d.customerName && <div className="mt-1 text-sm">{d.customerName}</div>}
      <div className="mt-2 space-y-1 text-xs text-muted">
        {d.address && (
          <div className="flex items-start gap-1.5">
            <MapPin size={12} className="mt-0.5 shrink-0" />
            <span>{d.address}</span>
          </div>
        )}
        {d.scheduledAt && (
          <div className="flex items-center gap-1.5">
            <CalendarClock size={12} className="shrink-0" />
            <span>{fmtTime(d.scheduledAt)}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <User size={12} className="shrink-0" />
          <span>{d.driverName ?? "Unassigned"}</span>
          {d.vehicleName && (
            <>
              <Truck size={12} className="ml-1 shrink-0" />
              <span>{d.vehicleName}</span>
            </>
          )}
        </div>
        {d.status === "DELIVERED" && d.deliveredAt && (
          <div className="flex items-center gap-1.5 text-fg">
            <CheckCircle2 size={12} className="shrink-0" style={{ color: STATUS_META.DELIVERED.color }} />
            <span>Delivered {fmtTime(d.deliveredAt)}</span>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {d.status === "DRAFT" && (
          <button className="btn btn-primary px-2 py-1 text-xs" onClick={onAssign} disabled={busy}>
            Assign
          </button>
        )}
        {d.status === "ASSIGNED" && (
          <>
            <button
              className="btn btn-primary px-2 py-1 text-xs"
              onClick={() => onAdvance("OUT_FOR_DELIVERY")}
              disabled={busy}
            >
              Out for delivery
            </button>
            <button className="btn btn-ghost px-2 py-1 text-xs" onClick={onAssign} disabled={busy}>
              Reassign
            </button>
          </>
        )}
        {d.status === "OUT_FOR_DELIVERY" && (
          <>
            <button
              className="btn btn-primary px-2 py-1 text-xs"
              onClick={() => onAdvance("DELIVERED")}
              disabled={busy}
            >
              Mark delivered
            </button>
            <button
              className="btn btn-outline px-2 py-1 text-xs"
              onClick={() => onAdvance("FAILED")}
              disabled={busy}
            >
              Failed
            </button>
          </>
        )}
        {d.status === "FAILED" && (
          <>
            <button
              className="btn btn-outline px-2 py-1 text-xs"
              onClick={() => onAdvance("OUT_FOR_DELIVERY")}
              disabled={busy}
            >
              Retry
            </button>
            <button className="btn btn-ghost px-2 py-1 text-xs" onClick={onAssign} disabled={busy}>
              Reassign
            </button>
          </>
        )}
        {d.status === "DELIVERED" && (
          <span className="text-xs text-muted">Completed</span>
        )}
      </div>
    </div>
  );
}

function ManifestView({
  drivers,
  stops,
  driverId,
  date,
  busy,
  onDriver,
  onDate,
  onAdvance,
}: {
  drivers: NamedRow[];
  stops: DeliveryRow[];
  driverId: string;
  date: string;
  busy: string | null;
  onDriver: (id: string) => void;
  onDate: (d: string) => void;
  onAdvance: (id: string, next: DeliveryStatus) => void;
}) {
  const delivered = stops.filter((s) => s.status === "DELIVERED").length;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Driver</label>
          <select className="input" value={driverId} onChange={(e) => onDriver(e.target.value)}>
            {drivers.length === 0 && <option value="">No drivers</option>}
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => onDate(e.target.value)} />
        </div>
        <div className="card ml-auto px-4 py-2 text-sm">
          <span className="text-muted">Stops </span>
          <span className="font-semibold">{stops.length}</span>
          <span className="mx-2 text-muted">·</span>
          <span className="text-muted">Delivered </span>
          <span className="font-semibold">{delivered}</span>
        </div>
      </div>

      {stops.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted">
          No stops scheduled for this driver on this day.
        </div>
      ) : (
        <ol className="space-y-2">
          {stops.map((s, i) => (
            <li key={s.id} className="card flex flex-wrap items-center gap-3 p-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ background: STATUS_META[s.status].color }}
              >
                {s.sequence ?? i + 1}
              </div>
              <div className="min-w-40 flex-1">
                <div className="text-sm font-medium">
                  {s.orderNumber ?? "Order"}
                  {s.customerName ? ` · ${s.customerName}` : ""}
                </div>
                <div className="text-xs text-muted">
                  {s.address ?? "No address"} {s.scheduledAt ? `· ${fmtTime(s.scheduledAt)}` : ""}
                </div>
              </div>
              <span
                className="badge text-xs"
                style={{ color: STATUS_META[s.status].color }}
              >
                {STATUS_META[s.status].label}
              </span>
              <div className="flex gap-1.5">
                {s.status === "ASSIGNED" && (
                  <button
                    className="btn btn-primary px-2 py-1 text-xs"
                    onClick={() => onAdvance(s.id, "OUT_FOR_DELIVERY")}
                    disabled={busy === s.id}
                  >
                    Start
                  </button>
                )}
                {s.status === "OUT_FOR_DELIVERY" && (
                  <button
                    className="btn btn-primary px-2 py-1 text-xs"
                    onClick={() => onAdvance(s.id, "DELIVERED")}
                    disabled={busy === s.id}
                  >
                    Delivered
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border p-5 shadow-lg"
        style={{ background: "var(--color-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button className="btn btn-ghost px-2 py-1" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const labelCls = "mb-1 block text-xs font-medium text-muted";

function NewDeliveryDialog({
  orders,
  drivers,
  vehicles,
  onClose,
  onSubmit,
  submitting,
}: {
  orders: AssignableOrder[];
  drivers: NamedRow[];
  vehicles: NamedRow[];
  onClose: () => void;
  onSubmit: (payload: {
    orderId: string;
    driverId?: string;
    vehicleId?: string;
    scheduledAt?: string;
    notes?: string;
  }) => void;
  submitting: boolean;
}) {
  const [orderId, setOrderId] = useState(orders[0]?.id ?? "");
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Dialog title="New delivery" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Order</label>
          <select className="input" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber}
                {o.customerName ? ` · ${o.customerName}` : ""} ({o.status})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Driver</label>
            <select className="input" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              <option value="">Unassigned</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Vehicle</label>
            <select className="input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">None</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Scheduled</label>
          <input
            type="datetime-local"
            className="input"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <input
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Delivery instructions..."
          />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          disabled={!orderId || submitting}
          onClick={() =>
            onSubmit({
              orderId,
              driverId: driverId || undefined,
              vehicleId: vehicleId || undefined,
              scheduledAt: scheduledAt || undefined,
              notes: notes || undefined,
            })
          }
        >
          {submitting ? "Creating…" : "Create delivery"}
        </button>
      </div>
    </Dialog>
  );
}

function AssignDialog({
  delivery,
  drivers,
  vehicles,
  onClose,
  onSubmit,
  submitting,
}: {
  delivery: DeliveryRow;
  drivers: NamedRow[];
  vehicles: NamedRow[];
  onClose: () => void;
  onSubmit: (payload: { driverId: string; vehicleId?: string; scheduledAt?: string }) => void;
  submitting: boolean;
}) {
  const [driverId, setDriverId] = useState(delivery.driverId ?? drivers[0]?.id ?? "");
  const [vehicleId, setVehicleId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  return (
    <Dialog title={`Assign ${delivery.orderNumber ?? "delivery"}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Driver</label>
          <select className="input" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            {drivers.length === 0 && <option value="">No drivers available</option>}
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Vehicle</label>
          <select className="input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">Unchanged</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Scheduled</label>
          <input
            type="datetime-local"
            className="input"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          disabled={!driverId || submitting}
          onClick={() =>
            onSubmit({
              driverId,
              vehicleId: vehicleId || undefined,
              scheduledAt: scheduledAt || undefined,
            })
          }
        >
          {submitting ? "Saving…" : "Assign driver"}
        </button>
      </div>
    </Dialog>
  );
}
