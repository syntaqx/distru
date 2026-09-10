"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import type { ServiceCtx } from "@/lib/modules/shared";
import {
  advanceDeliveryStatus,
  assignDelivery,
  createDeliveryFromOrder,
  simulateTelemetryTick,
  upsertDriver,
  upsertVehicle,
  type DeliveryStatus,
} from "@/lib/modules/logistics";

async function svc(): Promise<ServiceCtx> {
  const ctx = await requireOrgContext();
  return { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" };
}

export type DriverForm = {
  id?: string;
  name: string;
  phone?: string;
  licenseNumber?: string;
};

export type VehicleForm = {
  id?: string;
  name: string;
  make?: string;
  model?: string;
  licensePlate?: string;
};

function clean(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export async function saveDriverAction(
  form: DriverForm,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!form.name?.trim()) return { ok: false, error: "Name is required." };
  const service = await svc();
  try {
    const { row } = await upsertDriver(service, {
      id: form.id,
      name: form.name.trim(),
      phone: clean(form.phone),
      licenseNumber: clean(form.licenseNumber),
    });
    revalidatePath("/fleet");
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save driver." };
  }
}

export async function saveVehicleAction(
  form: VehicleForm,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!form.name?.trim()) return { ok: false, error: "Name is required." };
  const service = await svc();
  try {
    const { row } = await upsertVehicle(service, {
      id: form.id,
      name: form.name.trim(),
      make: clean(form.make),
      model: clean(form.model),
      licensePlate: clean(form.licensePlate),
    });
    revalidatePath("/fleet");
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save vehicle." };
  }
}

// ---------------- Deliveries ----------------

function whenFromInput(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createDeliveryAction(input: {
  orderId: string;
  driverId?: string;
  vehicleId?: string;
  scheduledAt?: string;
  notes?: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!input.orderId) return { ok: false, error: "An order is required." };
  const service = await svc();
  try {
    const { row } = await createDeliveryFromOrder(service, {
      orderId: input.orderId,
      driverId: input.driverId || null,
      vehicleId: input.vehicleId || null,
      scheduledAt: whenFromInput(input.scheduledAt),
      notes: clean(input.notes),
    });
    revalidatePath("/fleet");
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not create delivery." };
  }
}

export async function assignDeliveryAction(input: {
  id: string;
  driverId: string;
  vehicleId?: string;
  scheduledAt?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!input.driverId) return { ok: false, error: "A driver is required." };
  const service = await svc();
  try {
    await assignDelivery(service, input.id, {
      driverId: input.driverId,
      vehicleId: input.vehicleId || null,
      scheduledAt: whenFromInput(input.scheduledAt) ?? undefined,
    });
    revalidatePath("/fleet");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not assign delivery." };
  }
}

export async function advanceDeliveryAction(input: {
  id: string;
  status: DeliveryStatus;
}): Promise<{ ok: boolean; error?: string }> {
  const service = await svc();
  try {
    await advanceDeliveryStatus(service, input.id, input.status);
    revalidatePath("/fleet");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not update delivery." };
  }
}

// ---------------- Dispatch (telemetry simulation) ----------------

/**
 * Advance the persisted telemetry snapshot one deterministic step (or several),
 * nudging each en-route vehicle toward its current stop and marking arrivals.
 * The Dispatch map tweens smoothly on the client; this is the optional server
 * nudge that moves the underlying "last known ping" through the day.
 */
export async function advanceDispatchAction(
  ticks = 1,
): Promise<{ ok: boolean; error?: string; moved?: number; arrived?: number }> {
  const service = await svc();
  try {
    const n = Math.min(Math.max(Math.round(ticks) || 1, 1), 20);
    let moved = 0;
    let arrived = 0;
    for (let i = 0; i < n; i++) {
      const res = await simulateTelemetryTick(service);
      moved += res.moved;
      arrived += res.arrived;
    }
    revalidatePath("/fleet");
    return { ok: true, moved, arrived };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not advance dispatch." };
  }
}
