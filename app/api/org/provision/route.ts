import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/session";
import { seedUnitTypes, provisionOrgSampleData } from "@/lib/seed-data";
import { getDefaultLocation } from "@/lib/services/reference";
import { systemCtx } from "@/lib/services/context";

export const maxDuration = 120;

export async function POST(req: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { samples?: boolean };

  if (body.samples === false) {
    await seedUnitTypes();
    await getDefaultLocation(systemCtx(ctx.orgId));
  } else {
    await provisionOrgSampleData(ctx.orgId);
  }
  return NextResponse.json({ ok: true });
}
