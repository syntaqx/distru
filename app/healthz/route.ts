import { NextResponse } from "next/server";

// Liveness probe: the Next server process is up and serving requests. Checks no
// dependencies (that's /readyz) - a 200 here just means the app hasn't wedged.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok", time: new Date().toISOString() });
}
