"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import type { ServiceCtx } from "@/lib/modules/shared";
import {
  movePlantPhase,
  upsertHarvest,
  upsertPlant,
  upsertPlantBatch,
  type HarvestStatus,
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
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not move plant phase." };
  }
}
