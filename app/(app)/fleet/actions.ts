"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import type { ServiceCtx } from "@/lib/modules/shared";
import { upsertDriver, upsertVehicle } from "@/lib/modules/logistics";

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
