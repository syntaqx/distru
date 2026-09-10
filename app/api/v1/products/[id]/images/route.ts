import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { addProductImage, getProduct, listProductImages } from "@/lib/modules/catalog";

type ImageRow = Awaited<ReturnType<typeof listProductImages>>[number];

function imageToApi(row: ImageRow) {
  return {
    id: row.id,
    url: row.dataUrl,
    position: row.position,
    is_primary: row.isPrimary,
    inserted_datetime: row.createdAt.toISOString(),
  };
}

// GET /api/v1/products/{id}/images - list a product's images.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const product = await getProduct(auth.ctx, id);
  if (!product) return distruError(404, "Product not found", ["id"], "path");
  const images = await listProductImages(auth.ctx, id);
  return Response.json({ data: images.map(imageToApi) });
}

// POST /api/v1/products/{id}/images - attach an image to a product.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:write");
  if (scopeErr) return scopeErr;
  const { id } = await params;

  const product = await getProduct(auth.ctx, id);
  if (!product) return distruError(404, "Product not found", ["id"], "path");

  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  const url = body && typeof body.url === "string" ? body.url.trim() : "";
  // Accept a data URL directly, or an http(s) URL which we store as-is.
  if (!url) {
    return distruError(422, "url is required (a data URL or http(s) URL)", ["url"], "body");
  }

  await addProductImage(auth.ctx, id, url);
  const images = await listProductImages(auth.ctx, id);
  return Response.json({ data: images.map(imageToApi) });
}
