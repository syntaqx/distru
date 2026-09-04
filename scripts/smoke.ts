/**
 * End-to-end smoke test of the service layer + import pipeline against the
 * running Postgres (no LLM spend - uses deterministic mapping). Also mints an
 * API token so you can exercise the HTTP faces with curl.
 *
 * Run: npm run smoke   (after docker compose up + db:seed)
 */
try {
  process.loadEnvFile(".env");
} catch {}

import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization } from "@/db/schema";
import { systemCtx } from "@/lib/services/context";
import { listProducts, createProduct, getProductBySku } from "@/lib/services/products";
import { adjustInventory, getOnHand } from "@/lib/services/inventory";
import { getDefaultLocation, resolveUnitType } from "@/lib/services/reference";
import { parseTabular } from "@/lib/imports/parse";
import { deterministicMapping } from "@/lib/imports/mapping";
import { productsTarget } from "@/lib/imports/targets/products";
import {
  createImportFile,
  createImportJob,
  insertRows,
  updateJob,
} from "@/lib/services/imports";
import { validateImport, commitImport } from "@/lib/imports/pipeline";
import { buildErrorCsv } from "@/lib/imports/errors-csv";
import { createToken } from "@/lib/services/tokens";

function log(label: string, value: unknown) {
  console.log(`  ${label.padEnd(26)} ${JSON.stringify(value)}`);
}

async function main() {
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, "green-leaf-collective"))
    .limit(1);
  if (!org) throw new Error("Demo org not found - run `npm run db:seed` first.");
  const ctx = systemCtx(org.id);

  console.log("\n1. Catalog reads");
  const before = await listProducts(ctx, { limit: 5 });
  log("products (total)", before.total);

  console.log("\n2. Direct mutation (create + inventory)");
  const sku = "SMOKE-1";
  if (!(await getProductBySku(ctx, sku))) {
    const loc = await getDefaultLocation(ctx);
    const unit = await resolveUnitType("Unit");
    const p = await createProduct(ctx, {
      name: "Smoke Test Widget",
      sku,
      unitTypeId: unit?.id ?? null,
      unitPrice: 9.99,
    });
    await adjustInventory(ctx, { productId: p.product.id, locationId: loc.id, delta: 42 });
    log("created", { sku: p.product.sku, onHand: await getOnHand(ctx, p.product.id) });
  } else {
    log("created", "already exists");
  }

  console.log("\n3. Import pipeline (messy CSV → map → validate → commit)");
  const buffer = readFileSync("samples/messy-catalog.csv");
  const parsed = parseTabular({
    filename: "messy-catalog.csv",
    contentType: "text/csv",
    buffer,
  });
  log("headers", parsed.headers);
  const file = await createImportFile(ctx, {
    filename: "messy-catalog.csv",
    contentType: "text/csv",
    sizeBytes: buffer.byteLength,
    contentBase64: buffer.toString("base64"),
    headers: parsed.headers,
    sampleRows: parsed.rows.slice(0, 20),
    rowCount: parsed.rows.length,
  });
  const job = await createImportJob(ctx, {
    fileId: file.id,
    targetKey: "products",
    totalRows: parsed.rows.length,
  });
  await insertRows(ctx, job.id, parsed.rows.map((raw, i) => ({ rowIndex: i, raw })));

  const mapping = deterministicMapping(parsed.headers, productsTarget);
  log(
    "mapping",
    mapping.entries.filter((e) => e.sourceColumn).map((e) => `${e.targetField}<-${e.sourceColumn}`),
  );
  await updateJob(ctx, job.id, { mapping, status: "MAPPING" });

  const summary = await validateImport(ctx, job.id);
  log("validation", {
    total: summary.total,
    valid: summary.valid,
    warning: summary.warning,
    error: summary.error,
  });
  log("top errors", summary.topErrors.map((e) => `${e.count}x ${e.message}`));
  log("new refs", summary.newReferences);

  const { committed, errorRows } = await commitImport(ctx, job.id);
  log("commit", { committed, errorRows });

  const errCsv = await buildErrorCsv(ctx, job.id);
  if (errCsv && errCsv.errorRows > 0) {
    console.log(`\n  Error CSV (${errCsv.errorRows} rows):`);
    console.log(
      errCsv.csv
        .split("\n")
        .slice(0, 6)
        .map((l) => "    " + l)
        .join("\n"),
    );
  }

  console.log("\n4. Catalog after import");
  const after = await listProducts(ctx, { limit: 5 });
  log("products (total)", after.total);

  console.log("\n5. Mint API token for HTTP testing");
  const { token } = await createToken(ctx, { name: "smoke-test" });
  console.log(`  TOKEN=${token}`);

  console.log("\n✓ Smoke test passed.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n✗ Smoke test failed:", err);
  process.exit(1);
});
