import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/session";
import { allTools } from "@/lib/harness/registry";
import { ensureToolsRegistered } from "@/lib/harness/tools";
import { NODE_CATALOG } from "@/lib/harness/graph/catalog";

/**
 * The registry + node catalog the workflow canvas needs: which tools an agent
 * can be given, and which node types exist. Read-only, org-scoped by session.
 */
export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureToolsRegistered();
  const tools = allTools()
    .map((t) => ({ name: t.name, description: t.description, gate: t.gate }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ tools, nodes: NODE_CATALOG });
}
