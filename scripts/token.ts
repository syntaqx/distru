/**
 * Mint an API token for the demo org and print it - for driving the public API
 * or the MCP server from your own agent (see README "Use your own agent").
 *
 *   npm run token                                  (host)
 *   docker compose exec app npm run token          (Docker)
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
import { createToken } from "@/lib/modules/platform";

async function main() {
  const slug = process.argv[2] || "green-leaf-collective";
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);
  if (!org) {
    console.error(`Org "${slug}" not found. Run: npm run db:seed`);
    process.exit(1);
  }
  const { token } = await createToken(systemCtx(org.id), { name: "cli" });
  console.log(token);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
