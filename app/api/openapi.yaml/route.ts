import { buildOpenApiSpec, toYaml } from "@/lib/openapi";

// Public: same spec as /api/openapi.json, in YAML for Swagger / Postman / Redoc.
export function GET(req: Request) {
  const base = new URL(req.url).origin;
  const body = toYaml(buildOpenApiSpec(base)) + "\n";
  return new Response(body, {
    headers: {
      "content-type": "application/yaml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
