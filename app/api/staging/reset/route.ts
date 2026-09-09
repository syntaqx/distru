import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { resetAndReseed } from "@/lib/seed-tenant";

// A full wipe + reseed drives many inserts + a better-auth signup; give it room.
export const maxDuration = 300;

/**
 * Nightly staging reset: wipe the database and rebuild the demo tenant with a
 * lived-in state (catalog, sales, cultivation, plus showcase reports, a completed
 * automation run, and notifications). Meant for the demo deployment only.
 *
 * DOUBLE-GATED, because it is destructive:
 *   1. `ENABLE_STAGING_RESET` must be "1"/"true" (set only on the demo project).
 *   2. `CRON_SECRET` must match `Authorization: Bearer <secret>` (Vercel Cron
 *      sends this automatically when CRON_SECRET is set).
 */
async function handle(req: Request) {
  if (!env.enableStagingReset) {
    return NextResponse.json({ error: "staging reset is disabled" }, { status: 403 });
  }
  if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { orgId } = await resetAndReseed();
    return NextResponse.json({ ok: true, resetAt: new Date().toISOString(), orgId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "reset failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return handle(req);
}

// Vercel Cron issues GET requests.
export async function GET(req: Request) {
  return handle(req);
}
