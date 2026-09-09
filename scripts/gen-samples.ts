/**
 * Generate ready-to-drop demo CSVs into samples/. Deterministic (stable output,
 * no noisy diffs). Run: npm run samples   (or: npm run samples -- 20000)
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = "samples";
const CATEGORIES = ["Flower", "Pre-Rolls", "Edibles", "Vapes", "Concentrates"];
const VENDORS = ["Sungrown Farms", "Kush Co", "Cloud9 Labs", "Nebula Extracts"];
const STRAINS = [
  "Blue Dream", "OG Kush", "Sour Diesel", "Gelato", "Wedding Cake",
  "GDP", "Pineapple Express", "Northern Lights", "Runtz", "Zkittlez",
];
const UNITS = ["Gram", "Unit"];

function write(name: string, rows: string[]) {
  writeFileSync(join(OUT, name), rows.join("\n") + "\n", "utf8");
  console.log(`  ${name.padEnd(24)} ${rows.length - 1} rows`);
}

function priceFor(i: number) {
  return (15 + ((i * 7) % 55)).toFixed(2); // deterministic 15.00 - 69.00
}

// 1) Clean catalog - everything valid, friendly headers.
function clean() {
  const rows = ["Product Name,SKU,Category,Brand,Unit,Price"];
  for (let i = 1; i <= 25; i++) {
    const strain = STRAINS[i % STRAINS.length];
    rows.push(
      [
        `${strain} 3.5g`,
        `CLEAN-${String(i).padStart(3, "0")}`,
        CATEGORIES[i % CATEGORIES.length],
        VENDORS[i % VENDORS.length],
        UNITS[i % UNITS.length],
        priceFor(i),
      ].join(","),
    );
  }
  write("catalog-clean.csv", rows);
}

// 2) Terrible, mostly-missing catalog - most rows should error.
function broken() {
  const rows = ["Name,SKU,Category,Vendor,Unit,Price"];
  rows.push("Real Product One,BROK-1,Flower,Kush Co,Gram,22.00"); // valid
  rows.push(",BROK-2,Flower,Kush Co,Gram,20.00"); // missing name
  rows.push("Missing SKU Item,,Edibles,Cloud9 Labs,Unit,18.00"); // missing sku
  rows.push("No Unit Item,BROK-4,Vapes,Cloud9 Labs,,35.00"); // missing unit
  rows.push("Bad Price Item,BROK-5,Flower,Kush Co,Gram,call for price"); // non-numeric price
  rows.push("Weird Unit Item,BROK-6,Flower,Kush Co,sploots,15.00"); // unknown unit
  rows.push("Real Product Two,BROK-7,Concentrates,Kush Co,Gram,40.00"); // valid
  rows.push(",,,,,"); // totally empty
  rows.push("Only A Name,,,,,"); // only name
  rows.push("Half Filled,BROK-10,,,,"); // sku only
  rows.push("Real Product Three,BROK-11,Edibles,Cloud9 Labs,Unit,12.00"); // valid
  rows.push("No Price No Unit,BROK-12,Flower,Kush Co,,"); // missing unit + price
  write("catalog-broken.csv", rows);
}

// 3) Upsert pair - upload v1, then v2; v2 updates the same SKUs and adds two.
function upsert() {
  const v1 = ["Product Name,SKU,Category,Brand,Unit,Price"];
  const v2 = ["Product Name,SKU,Category,Brand,Unit,Price"];
  for (let i = 1; i <= 12; i++) {
    const sku = `UP-${String(i).padStart(3, "0")}`;
    const strain = STRAINS[i % STRAINS.length];
    v1.push(`${strain} 3.5g,${sku},${CATEGORIES[i % CATEGORIES.length]},${VENDORS[i % VENDORS.length]},Gram,${priceFor(i)}`);
    // v2: same SKUs, +$5 price and two renamed; then two brand-new SKUs.
    const renamed = i % 6 === 0 ? `${strain} 3.5g (2026 Harvest)` : `${strain} 3.5g`;
    v2.push(`${renamed},${sku},${CATEGORIES[i % CATEGORIES.length]},${VENDORS[i % VENDORS.length]},Gram,${(Number(priceFor(i)) + 5).toFixed(2)}`);
  }
  v2.push("Brand New Strain 3.5g,UP-013,Flower,Nebula Extracts,Gram,38.00");
  v2.push("Another New Drop 1g,UP-014,Concentrates,Kush Co,Gram,55.00");
  write("catalog-upsert-v1.csv", v1);
  write("catalog-upsert-v2.csv", v2);
}

// 4) Big catalog - N rows through the chunked engine (default 10k). Messy headers.
function big(n: number) {
  const rows = ["Item Name,Item #,Product Category,Brand,UOM,Wholesale Price"];
  for (let i = 1; i <= n; i++) {
    rows.push(
      [
        `${STRAINS[i % STRAINS.length]} #${i}`,
        `BULK-${String(i).padStart(5, "0")}`,
        CATEGORIES[i % CATEGORIES.length],
        VENDORS[i % VENDORS.length],
        i % 2 === 0 ? "g" : "each",
        priceFor(i),
      ].join(","),
    );
  }
  write(`catalog-${n >= 1000 ? `${Math.round(n / 1000)}k` : n}.csv`, rows);
}

const N = Number(process.argv[2]) || 10000;
console.log("Generating sample CSVs into samples/ ...");
clean();
broken();
upsert();
big(N);
console.log("Done.");
