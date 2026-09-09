import { buildOpenApiSpec } from "@/lib/openapi";

// Public: the API description is documentation, no auth required.
export function GET(req: Request) {
  const base = new URL(req.url).origin;
  return Response.json(buildOpenApiSpec(base), {
    headers: { "cache-control": "public, max-age=300" },
  });
}
