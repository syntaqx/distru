/**
 * Verifies the products import target downloads + attaches images from a CSV's
 * image column: one data URL (guaranteed) and one real URL (tests egress).
 * Run: docker compose exec app npx tsx scripts/img-import-test.ts
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
import { getProductBySku } from "@/lib/modules/catalog";
import { productsTarget } from "@/lib/imports/targets/products";

const DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function main() {
  const [org] = await db.select().from(organization).where(eq(organization.slug, "green-leaf-collective")).limit(1);
  if (!org) throw new Error("Demo org not found.");
  const ctx = systemCtx(org.id);
  const prep = await productsTarget.prepare(ctx);

  const cases = [
    { sku: "IMG-HTTP-1", name: "Two HTTP images", image: "https://placehold.co/80x80/png, https://placehold.co/100x100/png" },
    { sku: "IMG-DATA-1", name: "One data URL", image: DATA_URL },
  ];
  let allOk = true;
  for (const c of cases) {
    const vr = productsTarget.validateRow({ ...c, unit_type: "Gram", unit_price: "10" }, prep);
    if (!vr.ok) throw new Error("validateRow failed: " + JSON.stringify(vr.errors));
    await productsTarget.commitRows([{ value: vr.value }], ctx, prep);
    const p = await getProductBySku(ctx, c.sku);
    const imgs = p?.images ?? [];
    const valid = imgs.every((i) => i.dataUrl.startsWith("data:image/") && i.dataUrl.length > 40);
    console.log(`${c.sku}: mapped ${vr.value.imageUrls.length}, attached ${imgs.length}, all valid: ${valid}`);
    if (imgs.length < 1 || !valid) allOk = false;
  }
  console.log(allOk ? "\n✓ CSV image import works (http + data URLs)." : "\n✗ image import problem");
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error("✗", e);
  process.exit(1);
});
