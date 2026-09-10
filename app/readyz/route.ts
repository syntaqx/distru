import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Readiness probe: the app is up AND everything it needs to serve traffic is
 * healthy - currently a live Postgres connection. Returns 503 (not 200) until
 * ready, so an orchestrator/compose only routes traffic once the app can
 * actually do work, not merely when Node started listening.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {};
  let ready = true;

  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    checks.database = `ok (${Date.now() - started}ms)`;
  } catch (err) {
    ready = false;
    checks.database = err instanceof Error ? `error: ${err.message}` : "error";
  }

  return NextResponse.json(
    { status: ready ? "ready" : "not_ready", checks, time: new Date().toISOString() },
    { status: ready ? 200 : 503 },
  );
}
