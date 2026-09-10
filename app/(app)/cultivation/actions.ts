"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import type { ServiceCtx } from "@/lib/modules/shared";
import {
  advancePlantBatchPhase,
  logPlantEvent,
  movePlantPhase,
  packageHarvest,
  upsertHarvest,
  upsertPlant,
  upsertPlantBatch,
  type HarvestStatus,
  type PlantEventType,
  type PlantPhase,
} from "@/lib/modules/cultivation";

async function svc(): Promise<ServiceCtx> {
  const ctx = await requireOrgContext();
  return { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" };
}

type Result = { ok: boolean; error?: string; id?: string };

export type PlantBatchForm = {
  id?: string;
  batchNumber?: string;
  strainId?: string | null;
  locationId?: string | null;
  count?: number;
  phase?: PlantPhase;
  sourceType?: string | null;
};

export async function savePlantBatchAction(form: PlantBatchForm): Promise<Result> {
  const service = await svc();
  try {
    const { row } = await upsertPlantBatch(service, {
      id: form.id,
      batchNumber: form.batchNumber,
      strainId: form.strainId ?? null,
      locationId: form.locationId ?? null,
      count: form.count,
      phase: form.phase,
      sourceType: form.sourceType ?? null,
    });
    revalidatePath("/cultivation");
    return { ok: true, id: row.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save plant batch." };
  }
}

export type PlantForm = {
  id?: string;
  plantTag?: string;
  strainId?: string | null;
  locationId?: string | null;
  phase?: PlantPhase;
};

export async function savePlantAction(form: PlantForm): Promise<Result> {
  const service = await svc();
  try {
    const { row } = await upsertPlant(service, {
      id: form.id,
      plantTag: form.plantTag,
      strainId: form.strainId ?? null,
      locationId: form.locationId ?? null,
      phase: form.phase,
    });
    revalidatePath("/cultivation");
    return { ok: true, id: row.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save plant." };
  }
}

export type HarvestForm = {
  id?: string;
  name?: string | null;
  strainId?: string | null;
  plantCount?: number;
  wetWeight?: string | number | null;
  dryWeight?: string | number | null;
  status?: HarvestStatus;
};

export async function saveHarvestAction(form: HarvestForm): Promise<Result> {
  const service = await svc();
  try {
    const { row } = await upsertHarvest(service, {
      id: form.id,
      name: form.name ?? null,
      strainId: form.strainId ?? null,
      plantCount: form.plantCount,
      wetWeight: form.wetWeight,
      dryWeight: form.dryWeight,
      status: form.status,
    });
    revalidatePath("/cultivation");
    return { ok: true, id: row.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save harvest." };
  }
}

export async function movePlantPhaseAction(id: string, phase: PlantPhase): Promise<Result> {
  const service = await svc();
  try {
    await movePlantPhase(service, id, phase);
    revalidatePath("/cultivation");
    revalidatePath(`/cultivation/plants/${id}`);
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not move plant phase." };
  }
}

export async function advancePlantBatchPhaseAction(
  id: string,
  to?: PlantPhase,
): Promise<Result> {
  const service = await svc();
  try {
    await advancePlantBatchPhase(service, id, to);
    revalidatePath("/cultivation");
    revalidatePath(`/cultivation/plant-batches/${id}`);
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not advance batch." };
  }
}

export type PlantEventForm = {
  plantId?: string | null;
  plantBatchId?: string | null;
  type: PlantEventType;
  note?: string | null;
};

export async function logPlantEventAction(form: PlantEventForm): Promise<Result> {
  const service = await svc();
  try {
    const row = await logPlantEvent(service, {
      plantId: form.plantId ?? null,
      plantBatchId: form.plantBatchId ?? null,
      type: form.type,
      note: form.note ?? null,
    });
    if (form.plantId) revalidatePath(`/cultivation/plants/${form.plantId}`);
    if (form.plantBatchId) revalidatePath(`/cultivation/plant-batches/${form.plantBatchId}`);
    return { ok: true, id: row.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not log event." };
  }
}

export type PackageHarvestForm = {
  harvestId: string;
  productId: string;
  locationId: string;
  quantity?: number;
  packageTag?: string;
};

export async function packageHarvestAction(
  form: PackageHarvestForm,
): Promise<Result & { packageTag?: string; lotNumber?: string }> {
  if (!form.productId) return { ok: false, error: "Choose a product to package into." };
  if (!form.locationId) return { ok: false, error: "Choose a destination location." };
  const service = await svc();
  try {
    const res = await packageHarvest(service, {
      harvestId: form.harvestId,
      productId: form.productId,
      locationId: form.locationId,
      quantity: form.quantity,
      packageTag: form.packageTag,
    });
    revalidatePath("/cultivation");
    revalidatePath(`/cultivation/harvests/${form.harvestId}`);
    return { ok: true, id: res.package.id, packageTag: res.package.packageTag, lotNumber: res.lotNumber };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not package harvest." };
  }
}
