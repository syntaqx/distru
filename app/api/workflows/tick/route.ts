import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { hasAnthropicKey } from "@/lib/anthropic";
import type { ServiceCtx } from "@/lib/modules/shared";
import {
  advanceSchedule,
  listDueWorkflows,
  runWorkflow,
} from "@/lib/harness/workflows";

// Firing due schedules drives agent loops; give it room.
export const maxDuration = 300;

/**
 * The scheduler tick: runs every scheduled workflow that is due, then re-arms
 * its next run. Meant to be hit on an interval by a platform cron (Vercel Cron,
 * a GitHub Action, etc.). This is the in-process default behind the durable-
 * runtime seam described in the spec - a real deployment would hand firing +
 * retries to Inngest/Temporal and keep this executor as the step body.
 *
 * Guarded by CRON_SECRET when set: `Authorization: Bearer <CRON_SECRET>`.
 */
async function tick(req: Request) {
  if (env.cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${env.cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  if (!hasAnthropicKey()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 400 });
  }

  const due = await listDueWorkflows();
  const fired: { id: string; status: string }[] = [];

  for (const wf of due) {
    const ctx: ServiceCtx = {
      orgId: wf.organizationId,
      actor: "system:cron",
      actorType: "system",
    };
    try {
      const run = await runWorkflow(ctx, wf.id, { trigger: "schedule" });
      fired.push({ id: wf.id, status: run.status });
    } catch (err) {
      fired.push({ id: wf.id, status: err instanceof Error ? err.message : "error" });
    } finally {
      await advanceSchedule(wf);
    }
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), due: due.length, fired });
}

export async function POST(req: Request) {
  return tick(req);
}

// Allow GET so platform crons that only issue GETs (e.g. Vercel Cron) can call it.
export async function GET(req: Request) {
  return tick(req);
}
