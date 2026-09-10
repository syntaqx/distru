/**
 * Compile the markdown docs under the docs/ tree into a bundled data module
 * (lib/docs/_generated.ts). The markdown files are the single source of truth -
 * both what GitHub shows and what the site renders. This runs in prebuild,
 * vercel-build, and predev, so the compiled module is always fresh.
 *
 * Frontmatter is `key: <JSON value>` per line (title/section/summary strings,
 * keywords an array, order a number); slug is the filename.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

type Doc = {
  slug: string;
  section: string;
  title: string;
  summary: string;
  keywords: string[];
  body: string;
  order: number;
};

const DOCS_DIR = "docs";

function findMarkdown(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findMarkdown(full));
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

function parse(path: string): Doc {
  const raw = readFileSync(path, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`No frontmatter in ${path}`);
  const [, fm, body] = m;
  const meta: Record<string, unknown> = {};
  for (const line of fm.split("\n")) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const rawVal = line.slice(i + 1).trim();
    try {
      meta[key] = JSON.parse(rawVal);
    } catch {
      meta[key] = rawVal.replace(/^["']|["']$/g, "");
    }
  }
  const slug = basename(path, ".md");
  for (const req of ["title", "section", "summary"] as const) {
    if (typeof meta[req] !== "string") throw new Error(`${path}: missing "${req}"`);
  }
  return {
    slug,
    section: meta.section as string,
    title: meta.title as string,
    summary: meta.summary as string,
    keywords: Array.isArray(meta.keywords) ? (meta.keywords as string[]) : [],
    body: body.replace(/^\n+/, "").replace(/\s+$/, "") + "\n",
    order: typeof meta.order === "number" ? meta.order : 9999,
  };
}

const docs = findMarkdown(DOCS_DIR)
  .map(parse)
  .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));

const slugs = new Set<string>();
for (const d of docs) {
  if (slugs.has(d.slug)) throw new Error(`Duplicate doc slug: ${d.slug}`);
  slugs.add(d.slug);
}

const payload = docs.map((d) => ({
  slug: d.slug,
  section: d.section,
  title: d.title,
  summary: d.summary,
  keywords: d.keywords,
  body: d.body,
}));
const out =
  "// AUTO-GENERATED from docs/**/*.md by scripts/build-docs.ts. Do not edit.\n" +
  'import type { DocArticle } from "./types";\n\n' +
  "export const DOCS: DocArticle[] = " +
  JSON.stringify(payload, null, 2) +
  ";\n";

writeFileSync("lib/docs/_generated.ts", out, "utf8");
console.log(`build-docs: compiled ${docs.length} docs → lib/docs/_generated.ts`);
