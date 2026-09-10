import { buildOpenApiSpec, requestOrigin } from "@/lib/openapi";

// Public: the API description is documentation, no auth required.
export function GET(req: Request) {
  return Response.json(buildOpenApiSpec(requestOrigin(req)), {
    headers: { "cache-control": "public, max-age=300" },
  });
}
