"use client";

import { useState } from "react";
import Link from "next/link";
import { IdCard, Pencil, Plus, Search, Truck } from "lucide-react";
import { DeliveriesBoard, type DeliveryRow } from "@/components/fleet/deliveries-board";
import { DispatchBoard, type FleetTelemetrySnapshot } from "@/components/fleet/dispatch-board";

export type DriverRow = {
  id: string;
  name: string;
  phone: string | null;
  licenseNumber: string | null;
  /** The org member behind this driver, when linked to a login (else null). */
  memberId: string | null;
};

export type VehicleRow = {
  id: string;
  name: string;
  make: string | null;
  model: string | null;
  licensePlate: string | null;
};

type AssignableOrder = {
  id: string;
  orderNumber: string;
  customerName: string | null;
  status: string;
};

type Tab = "dispatch" | "deliveries" | "drivers" | "vehicles";

export function FleetManager({
  drivers,
  vehicles,
  deliveries,
  assignableOrders,
  telemetry,
}: {
  drivers: DriverRow[];
  vehicles: VehicleRow[];
  deliveries: DeliveryRow[];
  assignableOrders: AssignableOrder[];
  telemetry: FleetTelemetrySnapshot;
}) {
  const [tab, setTab] = useState<Tab>("dispatch");
  const [q, setQ] = useState("");
  const activeDeliveries = deliveries.filter(
    (d) => d.status === "ASSIGNED" || d.status === "OUT_FOR_DELIVERY",
  ).length;

  const query = q.toLowerCase();
  const filteredDrivers = drivers.filter(
    (d) =>
      !query ||
      d.name.toLowerCase().includes(query) ||
      (d.phone ?? "").toLowerCase().includes(query) ||
      (d.licenseNumber ?? "").toLowerCase().includes(query),
  );
  const filteredVehicles = vehicles.filter(
    (v) =>
      !query ||
      v.name.toLowerCase().includes(query) ||
      (v.make ?? "").toLowerCase().includes(query) ||
      (v.model ?? "").toLowerCase().includes(query) ||
      (v.licensePlate ?? "").toLowerCase().includes(query),
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "dispatch", label: "Dispatch" },
    { key: "deliveries", label: "Deliveries" },
    { key: "drivers", label: "Drivers" },
    { key: "vehicles", label: "Vehicles" },
  ];

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Deliveries", deliveries.length],
          ["Active", activeDeliveries],
          ["Drivers", drivers.length],
          ["Vehicles", vehicles.length],
        ].map(([label, value]) => (
          <div key={label} className="card">
            <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <div
          className="inline-flex rounded-lg border p-0.5"
          style={{ background: "var(--color-surface)" }}
        >
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                tab === key ? "text-fg" : "text-muted hover:text-fg"
              }`}
              style={tab === key ? { background: "var(--color-surface2)" } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {(tab === "drivers" || tab === "vehicles") && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tab === "drivers" ? "Search drivers..." : "Search vehicles..."}
            />
          </div>
          {tab === "drivers" ? (
            <Link href="/fleet/drivers/new" className="btn btn-primary ml-auto">
              <Plus size={16} /> New driver
            </Link>
          ) : (
            <Link href="/fleet/vehicles/new" className="btn btn-primary ml-auto">
              <Plus size={16} /> New vehicle
            </Link>
          )}
        </div>
      )}

      {tab === "dispatch" ? (
        <DispatchBoard telemetry={telemetry} />
      ) : tab === "deliveries" ? (
        <DeliveriesBoard
          deliveries={deliveries}
          drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
          vehicles={vehicles.map((v) => ({ id: v.id, name: v.name }))}
          assignableOrders={assignableOrders}
        />
      ) : tab === "drivers" ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-140 text-sm">
            <thead>
              <tr className="text-left text-muted" style={{ background: "var(--color-surface)" }}>
                <th className="px-4 py-2.5 font-medium">Driver</th>
                <th className="px-4 py-2.5 font-medium">Phone</th>
                <th className="px-4 py-2.5 font-medium">License #</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filteredDrivers.map((d) => (
                <tr key={d.id} className="border-t" style={{ background: "var(--color-surface)" }}>
                  <td className="px-4 py-2.5 font-medium">
                    <Link
                      href={d.memberId ? `/settings/members/${d.memberId}` : `/fleet/drivers/${d.id}/edit`}
                      className="inline-flex items-center gap-2 hover:underline"
                    >
                      <IdCard size={15} className="text-muted" />
                      {d.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{d.phone ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted">{d.licenseNumber ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Link className="btn btn-ghost px-2 py-1" href={`/fleet/drivers/${d.id}/edit`} title="Edit" aria-label={`Edit ${d.name}`}>
                        <Pencil size={14} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDrivers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted">
                    No drivers. Add one to start assigning deliveries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-140 text-sm">
            <thead>
              <tr className="text-left text-muted" style={{ background: "var(--color-surface)" }}>
                <th className="px-4 py-2.5 font-medium">Vehicle</th>
                <th className="px-4 py-2.5 font-medium">Make</th>
                <th className="px-4 py-2.5 font-medium">Model</th>
                <th className="px-4 py-2.5 font-medium">Plate</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.map((v) => (
                <tr key={v.id} className="border-t" style={{ background: "var(--color-surface)" }}>
                  <td className="px-4 py-2.5 font-medium">
                    <Link href={`/fleet/vehicles/${v.id}/edit`} className="inline-flex items-center gap-2 hover:underline">
                      <Truck size={15} className="text-muted" />
                      {v.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{v.make ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted">{v.model ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {v.licensePlate ? (
                      <span className="badge font-mono">{v.licensePlate}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Link className="btn btn-ghost px-2 py-1" href={`/fleet/vehicles/${v.id}/edit`} title="Edit" aria-label={`Edit ${v.name}`}>
                        <Pencil size={14} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredVehicles.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted">
                    No vehicles. Add one to track your delivery equipment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
