/**
 * Live harness smoke: drives ONE real model turn through the provider seam to
 * prove the runner still streams, calls a read tool, and finishes. Uses the
 * configured MODEL_PROVIDER (default anthropic) and the demo org.
 *
 * Run inside the app container: docker compose exec app npx tsx scripts/harness-smoke.ts
 */
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {}
}

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization } from "@/db/schema";
import { systemCtx } from "@/lib/modules/shared";
import { createConversation, appendMessage } from "@/lib/harness/conversations";
import { runConversationTurn } from "@/lib/harness/runner";
import { getModelProvider } from "@/lib/harness/providers";
import type { HarnessEvent } from "@/lib/harness/types";

async function main() {
  const provider = getModelProvider();
  console.log(`provider: ${provider.id} (${provider.model}), configured: ${provider.isConfigured()}`);
  if (!provider.isConfigured()) throw new Error(`Provider ${provider.id} is not configured (missing key).`);

  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, "green-leaf-collective"))
    .limit(1);
  if (!org) throw new Error("Demo org not found - run db:seed first.");
  const ctx = systemCtx(org.id);

  const conv = await createConversation(ctx, { title: "harness smoke" });
  await appendMessage(ctx, conv.id, "user", [
    { type: "text", text: "How many products are in my catalog right now? Use your tools, then answer in one sentence." },
  ]);

  const counts: Record<string, number> = {};
  let toolCalled = "";
  let answer = "";
  const emit = (e: HarnessEvent) => {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
    if (e.type === "tool_start") toolCalled = e.name;
    if (e.type === "token") answer += e.text;
  };

  await runConversationTurn(
    { service: ctx, userId: null, conversationId: conv.id, emit },
    { autoApprove: false },
  );

  console.log("event counts:", JSON.stringify(counts));
  console.log("tool called: ", toolCalled || "(none)");
  console.log("answer:      ", answer.trim().slice(0, 200));
  if (!counts["done"]) throw new Error("Turn did not reach 'done'.");
  console.log("\n✓ Harness turn completed through the provider seam.");
  process.exit(0);
}

main().catch((e) => {
  console.error("✗ Harness smoke failed:", e);
  process.exit(1);
});
