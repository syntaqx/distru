/**
 * DB-backed persistence for road geometry (over the pure, in-memory-cached
 * `route-geometry` helper). A dispatch fleet can be dozens of trucks; without a
 * durable cache, a cold page load would fire one live directions call per run.
 * This persists each run's provider result in `route_geometry_cache` keyed by the
 * waypoint hash, so geometry is fetched once - ideally warmed at seed - and every
 * later read (across processes and restarts) is a single indexed row lookup.
 *
 * Kept separate from `route-geometry.ts` so that module stays DB-free (and unit
 * testable); this is the thin service-layer wrapper the telemetry code uses.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { routeGeometryCache } from "@/db/schema";
import type { ServiceCtx } from "../shared";
import type { LngLat, RouteResult } from "@/lib/integrations/routing";
import {
  getRunGeometry,
  keyOf,
  runWaypoints,
  getRoadRoute,
} from "./route-geometry";

type LatLng = { lat: number; lng: number };

/**
 * A routing fetcher backed by `route_geometry_cache`: DB hit → return it; miss →
 * call the provider (via the in-memory-cached `getRoadRoute`) and, on a real
 * result, persist it. Null results (provider down / disabled) are not cached, so
 * they can be recomputed later and the map simply falls back to straight lines.
 */
function dbFetcher(ctx: ServiceCtx): (waypoints: LngLat[]) => Promise<RouteResult | null> {
  return async (waypoints) => {
    if (waypoints.length < 2) return null;
    const cacheKey = keyOf(waypoints);
    const [hit] = await db
      .select({ result: routeGeometryCache.result })
      .from(routeGeometryCache)
      .where(
        and(
          eq(routeGeometryCache.organizationId, ctx.orgId),
          eq(routeGeometryCache.cacheKey, cacheKey),
        ),
      )
      .limit(1);
    if (hit) return hit.result as RouteResult;

    const result = await getRoadRoute(waypoints);
    if (result) {
      // Concurrent warmers can race on the same key; ignore the duplicate.
      await db
        .insert(routeGeometryCache)
        .values({ organizationId: ctx.orgId, cacheKey, result })
        .onConflictDoNothing({
          target: [routeGeometryCache.organizationId, routeGeometryCache.cacheKey],
        });
    }
    return result;
  };
}

/**
 * Persisted-cache variant of `getRunGeometry`: same shape, but geometry is read
 * from / written to the DB cache. This is what the telemetry service calls.
 */
export async function getRunGeometryPersisted(
  ctx: ServiceCtx,
  depot: LatLng,
  stops: { id: string; lat: number; lng: number }[],
) {
  return getRunGeometry(depot, stops, dbFetcher(ctx));
}

/**
 * Warm the cache for a run (used by the seed so the first real page load is
 * already fast). Returns whether real geometry was obtained. Never throws - a
 * provider hiccup during seeding just leaves that run on straight-line fallback.
 */
export async function warmRunGeometry(
  ctx: ServiceCtx,
  depot: LatLng,
  stops: { id: string; lat: number; lng: number }[],
): Promise<boolean> {
  try {
    const result = await dbFetcher(ctx)(runWaypoints(depot, stops));
    return result != null;
  } catch {
    return false;
  }
}
