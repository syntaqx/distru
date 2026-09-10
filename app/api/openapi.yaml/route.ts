import { buildOpenApiSpec, requestOrigin, toYaml } from "@/lib/openapi";

// Public: same spec as /api/openapi.json, in YAML for Swagger / Postman / Redoc.
export function GET(req: Request) {
  const body = toYaml(buildOpenApiSpec(requestOrigin(req))) + "\n";
  return new Response(body, {
    headers: {
      "content-type": "application/yaml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
