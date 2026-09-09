import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { nextRunFromCron } from "@/lib/harness/graph/schedule";

// Keep in sync with the reset cron in vercel.json (`/api/staging/reset`).
const RESET_CRON = "0 0 * * *";

/**
 * Public status for the demo-reset notice: whether this deployment auto-resets
 * nightly, and when the next reset is. No auth - it's just a boolean + a time,
 * and it's what lets the (client-side) sign-in page and sidebar show a countdown.
 */
export async function GET() {
  const enabled = env.enableStagingReset;
  return NextResponse.json({
    resetEnabled: enabled,
    nextResetAt: enabled ? (nextRunFromCron(RESET_CRON)?.toISOString() ?? null) : null,
  });
}
