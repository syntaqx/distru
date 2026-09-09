/**
 * OpenAPI self-documentation guard (run on every build via prebuild).
 *
 * The route.ts filesystem under app/public/v1 is the source of truth for what
 * public endpoints exist. This asserts the OpenAPI spec documents EXACTLY those:
 *   1. every route on disk is documented (or explicitly opted out) - no endpoint
 *      ever ships undocumented;
 *   2. every documented path/method actually exists on disk - no phantom docs;
 *   3. every documented operation carries a 2xx response schema - "documented"
 *      means real, not an empty stub.
 * Opt out an endpoint (a health probe, say) by adding its path to OPENAPI_IGNORE
 * in lib/openapi.ts.
 *
 * Run: npm run check:openapi
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { buildOpenApiSpec, OPENAPI_IGNORE } from "@/lib/openapi";

const ROOT = process.cwd();
const ROUTES_DIR = join(ROOT, "app", "public", "v1");
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const ignore = new Set(OPENAPI_IGNORE);

/** Every route.ts under app/public/v1, as { openApiPath -> exported methods }. */
function routesOnDisk(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry === "route.ts") {
        const rel = relative(ROUTES_DIR, dir).split(sep).join("/");
        const raw = "/public/v1" + (rel ? "/" + rel : "");
        const path = raw.replace(/\[(\w+)\]/g, "{$1}");
        const src = readFileSync(full, "utf8");
        const methods = new Set(
          METHODS.filter((m) =>
            new RegExp("export\\s+(async\\s+)?function\\s+" + m + "\\b").test(src),
          ),
        );
        found.set(path, methods);
      }
    }
  };
  walk(ROUTES_DIR);
  return found;
}

type Op = { responses?: Record<string, unknown> };

function main() {
  const disk = routesOnDisk();
  const spec = buildOpenApiSpec("http://localhost:3000") as {
    paths: Record<string, Record<string, Op>>;
  };
  const specPaths = new Map<string, Record<string, Op>>();
  for (const [p, ops] of Object.entries(spec.paths)) {
    if (p.startsWith("/public/v1")) specPaths.set(p, ops);
  }

  const problems: string[] = [];

  // (1) every route on disk is documented (or opted out); methods line up.
  for (const [path, methods] of disk) {
    if (ignore.has(path)) continue;
    const ops = specPaths.get(path);
    if (!ops) {
      problems.push(
        "undocumented endpoint: " + path + " (" + [...methods].join(",") +
          ") - add it to the OpenAPI spec, or to OPENAPI_IGNORE in lib/openapi.ts",
      );
      continue;
    }
    const docMethods = new Set(Object.keys(ops).map((k) => k.toUpperCase()).filter((k) => (METHODS as readonly string[]).includes(k)));
    for (const m of methods) if (!docMethods.has(m)) problems.push("route " + path + " implements " + m + " but the spec omits it");
    for (const m of docMethods) if (!methods.has(m)) problems.push("spec documents " + m + " " + path + " but the route does not implement it");
  }

  // (2) no phantom documented paths.
  for (const path of specPaths.keys()) {
    if (ignore.has(path)) continue;
    if (!disk.has(path)) problems.push("spec documents " + path + " but no route.ts exists");
  }

  // (3) every documented operation has a 2xx response with a schema.
  for (const [path, ops] of specPaths) {
    if (ignore.has(path)) continue;
    for (const [method, op] of Object.entries(ops)) {
      if (!(METHODS as readonly string[]).includes(method.toUpperCase())) continue;
      const responses = op.responses ?? {};
      const ok = Object.keys(responses).some((code) => {
        if (!/^2\d\d$/.test(code)) return false;
        const body = responses[code] as { content?: Record<string, { schema?: unknown }> } | { $ref?: string };
        if ("$ref" in body && body.$ref) return true;
        const content = (body as { content?: Record<string, { schema?: unknown }> }).content;
        return !!content && Object.values(content).some((c) => !!c.schema);
      });
      if (!ok) problems.push("operation " + method.toUpperCase() + " " + path + " has no 2xx response schema");
    }
  }

  if (problems.length) {
    console.error("X OpenAPI self-documentation check failed (" + problems.length + "):");
    for (const p of problems.sort()) console.error("  - " + p);
    process.exit(1);
  }
  const documented = [...disk.keys()].filter((p) => !ignore.has(p)).length;
  console.log(
    "OK: OpenAPI documents all " + documented + " public routes" +
      (ignore.size ? " (" + ignore.size + " explicitly opted out)" : "") +
      " - paths, methods, and 2xx schemas.",
  );
  process.exit(0);
}

main();
