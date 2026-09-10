/**
 * Road geometry for the dispatch map + simulator. Wraps the routing provider
 * seam (`lib/integrations/routing`, OSRM by default) with a small in-process
 * TTL cache keyed on the rounded waypoint list, so a day's stable stop sequence
 * is routed once and reused by every telemetry read and simulate tick rather
 * than hammering the directions API. Also carries the pure polyline math the
 * simulator uses to walk a vehicle down a real street leg.
 *
 * Everything degrades honestly: if the provider can't route (offline, rate
 * limited, `ROUTING_PROVIDER=none`), `getRoadRoute` returns null and callers
 * fall back to straight lines - the map still works, the trucks still move.
 */
// Import the routing seam directly (not the barrel) so this module - and its
// pure geometry math - stays free of the DB-backed integration adapters.
import { getRoutingProvider, type LngLat, type RouteResult } from "@/lib/integrations/routing";

type LatLng = { lat: number; lng: number };

// ---- Cache -------------------------------------------------------------------

const TTL_MS = 30 * 60 * 1000; // 30 min - a route's stops don't change intraday.
const cache = new Map<string, { result: RouteResult | null; expires: number }>();

/** Cache key from waypoints rounded to ~1m so tiny float drift still hits. */
export function keyOf(waypoints: LngLat[]): string {
  return waypoints.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(";");
}

/** The ordered waypoint list for a run: depot -> each stop -> back to depot. */
export function runWaypoints(
  depot: { lat: number; lng: number },
  stops: { lat: number; lng: number }[],
): LngLat[] {
  return [
    [depot.lng, depot.lat],
    ...stops.map((s) => [s.lng, s.lat] as LngLat),
    [depot.lng, depot.lat],
  ];
}

/** The leg->delivery mapping for a run (leg k arrives at stop k; last leg = depot). */
export function runLegDeliveryIds(stops: { id: string }[]): (string | null)[] {
  return [...stops.map((s) => s.id), null];
}

/**
 * Road route through `waypoints` (each [lng,lat]), cached. Returns null when
 * routing is unavailable so callers fall back to straight lines. Negative
 * results are cached too (briefly) to avoid re-hitting a down provider per row.
 */
export async function getRoadRoute(waypoints: LngLat[]): Promise<RouteResult | null> {
  if (waypoints.length < 2) return null;
  const key = keyOf(waypoints);
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expires > now) return hit.result;

  const result = await getRoutingProvider().route(waypoints);
  // Cache a hit for the full TTL; a miss only briefly so a transient outage
  // doesn't blank the roads for half an hour.
  cache.set(key, { result, expires: now + (result ? TTL_MS : 60_000) });
  return result;
}

/**
 * Build the ordered waypoint list for a run - depot, each stop in sequence, then
 * back to the depot - and route it. Returns the RouteResult plus a `legIndexFor`
 * map from a stop's delivery id to the leg that *arrives* at it (leg k connects
 * waypoint k -> k+1). The final leg (last stop -> depot) has no delivery id and
 * is used to animate a RETURNING vehicle.
 */
export async function getRunGeometry(
  depot: LatLng,
  stops: { id: string; lat: number; lng: number }[],
  // Injectable so a caller can wrap routing in a persistent (DB) cache; defaults
  // to the in-memory-cached provider call.
  fetchRoute: (waypoints: LngLat[]) => Promise<RouteResult | null> = getRoadRoute,
): Promise<{ route: RouteResult | null; legDeliveryIds: (string | null)[] }> {
  if (stops.length === 0) return { route: null, legDeliveryIds: [] };
  const route = await fetchRoute(runWaypoints(depot, stops));
  // leg 0: depot -> stop[0], leg k: stop[k-1] -> stop[k], last leg: stop[n-1] -> depot.
  return { route, legDeliveryIds: runLegDeliveryIds(stops) };
}

// ---- Pure polyline math (city-scale equirectangular) -------------------------

const M_PER_DEG_LAT = 111_320;
function mPerDegLng(lat: number): number {
  return 111_320 * Math.cos((lat * Math.PI) / 180);
}

/** Meters between two [lng,lat] points (fine at city scale). */
export function metersBetween(a: LngLat, b: LngLat): number {
  const midLat = (a[1] + b[1]) / 2;
  const dx = (b[0] - a[0]) * mPerDegLng(midLat);
  const dy = (b[1] - a[1]) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

/** Compass bearing 0=N,90=E from a to b (integer 0-359). */
export function bearingOf(a: LngLat, b: LngLat): number {
  const midLat = (a[1] + b[1]) / 2;
  const dx = (b[0] - a[0]) * Math.cos((midLat * Math.PI) / 180);
  const dy = b[1] - a[1];
  return Math.round(((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360);
}

/** Total length of a polyline in meters. */
export function polylineMeters(line: LngLat[]): number {
  let m = 0;
  for (let i = 1; i < line.length; i++) m += metersBetween(line[i - 1], line[i]);
  return m;
}

/**
 * Project `p` onto polyline `line` and return the cumulative distance (meters)
 * from the line's start to the nearest point on it. Used to place a vehicle's
 * last-known ping onto its street leg before walking it forward.
 */
function distanceAlong(line: LngLat[], p: LngLat): number {
  let best = { d: Infinity, along: 0 };
  let acc = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const segLen = metersBetween(a, b);
    // Project p onto segment a->b in local meters.
    const midLat = (a[1] + b[1]) / 2;
    const ax = 0;
    const ay = 0;
    const bx = (b[0] - a[0]) * mPerDegLng(midLat);
    const by = (b[1] - a[1]) * M_PER_DEG_LAT;
    const px = (p[0] - a[0]) * mPerDegLng(midLat);
    const py = (p[1] - a[1]) * M_PER_DEG_LAT;
    const segSq = (bx - ax) ** 2 + (by - ay) ** 2 || 1e-9;
    let t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / segSq;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * (bx - ax);
    const cy = ay + t * (by - ay);
    const dist = Math.hypot(px - cx, py - cy);
    if (dist < best.d) best = { d: dist, along: acc + t * segLen };
    acc += segLen;
  }
  return best.along;
}

/** The [lng,lat] point at cumulative distance `along` meters into the line. */
function pointAt(line: LngLat[], along: number): { point: LngLat; heading: number } {
  if (line.length === 1) return { point: line[0], heading: 0 };
  let acc = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const segLen = metersBetween(a, b) || 1e-9;
    if (acc + segLen >= along) {
      const t = (along - acc) / segLen;
      return {
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        heading: bearingOf(a, b),
      };
    }
    acc += segLen;
  }
  const last = line[line.length - 1];
  const prev = line[line.length - 2];
  return { point: last, heading: bearingOf(prev, last) };
}

/**
 * The point at fraction `frac` (0..1) of the way along `line`, with the heading
 * of the segment it falls on - used to place a vehicle by *time* (how far through
 * a leg the clock says it is) rather than by stepping.
 */
export function pointAtFraction(
  line: LngLat[],
  frac: number,
): { lat: number; lng: number; heading: number } {
  if (line.length === 0) return { lat: 0, lng: 0, heading: 0 };
  if (line.length === 1) return { lat: line[0][1], lng: line[0][0], heading: 0 };
  const total = polylineMeters(line);
  const target = Math.max(0, Math.min(1, frac)) * total;
  const { point, heading } = pointAt(line, target);
  return { lat: point[1], lng: point[0], heading };
}

/**
 * Walk `meters` forward along `line` starting from wherever `current` projects
 * onto it. Returns the new point, its heading, and how far remains to the line's
 * end - so the simulator can advance a vehicle down a real street and know when
 * it has arrived.
 */
export function walkAlong(
  line: LngLat[],
  current: LngLat,
  meters: number,
): { point: LngLat; heading: number; metersToEnd: number } {
  const total = polylineMeters(line);
  const start = distanceAlong(line, current);
  const next = Math.min(total, start + meters);
  const { point, heading } = pointAt(line, next);
  return { point, heading, metersToEnd: Math.max(0, total - next) };
}
