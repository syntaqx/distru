/**
 * Routing provider seam - road-following directions for the dispatch map. Same
 * shape as the other integration seams (env-selected, swappable, honest
 * fallback): a tenant runs the default keyless OSRM demo server, points
 * `ROUTING_PROVIDER=mapbox` at their own Mapbox Directions token, or sets
 * `none` to fall back to straight lines. Nothing here calls a paid API unless a
 * tenant wired one up.
 *
 * A `route(waypoints)` call returns the real street geometry through the
 * waypoints in order, split into one leg per consecutive pair - so the map can
 * draw the true road path and the simulator can walk a vehicle down it. Every
 * adapter returns `null` (never throws) when it can't route, so callers degrade
 * to straight lines without a broken map.
 */
import { env } from "@/lib/env";

export type LngLat = [number, number];

export type RouteLeg = {
  /** Street geometry for this leg, ordered [lng,lat] pairs. */
  geometry: LngLat[];
  distanceMeters: number;
  durationSeconds: number;
};

export type RouteResult = {
  /** The full path through every waypoint, concatenated ([lng,lat]). */
  geometry: LngLat[];
  /** One entry per consecutive waypoint pair (waypoints.length - 1 legs). */
  legs: RouteLeg[];
  distanceMeters: number;
  durationSeconds: number;
};

export interface RoutingProvider {
  readonly id: string;
  /** True when this adapter can actually route (a real one checks its token). */
  isConnected(): boolean;
  /**
   * Road route through `waypoints` (each [lng,lat]), in order. Returns null when
   * routing is unavailable or fewer than two waypoints are given, so callers can
   * fall back to straight lines. Never throws.
   */
  route(waypoints: LngLat[]): Promise<RouteResult | null>;
}

/** Abort a slow directions call rather than stall a page render. */
const ROUTE_TIMEOUT_MS = 6000;

async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ROUTE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    // Network error, abort, non-JSON - all mean "route unavailable", not fatal.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------- OSRM (default: free, keyless real roads) ----------------

/**
 * Shape of the slice of the OSRM `/route` response we consume. Requested with
 * `overview=full&geometries=geojson&steps=true` so each leg carries its own
 * per-step GeoJSON geometry we can stitch together.
 */
type OsrmResponse = {
  code: string;
  routes?: {
    distance: number;
    duration: number;
    legs?: {
      distance: number;
      duration: number;
      steps?: { geometry?: { coordinates?: LngLat[] } }[];
    }[];
  }[];
};

function osrm(baseUrl: string): RoutingProvider {
  return {
    id: "osrm",
    isConnected: () => true,
    async route(waypoints) {
      if (waypoints.length < 2) return null;
      const coords = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(";");
      const url =
        `${baseUrl.replace(/\/$/, "")}/route/v1/driving/${coords}` +
        `?overview=full&geometries=geojson&steps=true&annotations=false`;
      const json = (await fetchJson(url)) as OsrmResponse | null;
      const route = json?.code === "Ok" ? json.routes?.[0] : undefined;
      if (!route?.legs?.length) return null;

      const legs: RouteLeg[] = route.legs.map((leg) => {
        // Stitch the leg's step geometries into one polyline (dropping the shared
        // vertex between consecutive steps so the line has no duplicate points).
        const geometry: LngLat[] = [];
        for (const step of leg.steps ?? []) {
          const pts = step.geometry?.coordinates ?? [];
          for (const p of pts) {
            const last = geometry[geometry.length - 1];
            if (!last || last[0] !== p[0] || last[1] !== p[1]) geometry.push(p);
          }
        }
        return {
          geometry,
          distanceMeters: leg.distance ?? 0,
          durationSeconds: leg.duration ?? 0,
        };
      });

      // Full path = legs concatenated, again de-duping the shared junctions.
      const geometry: LngLat[] = [];
      for (const leg of legs) {
        for (const p of leg.geometry) {
          const last = geometry[geometry.length - 1];
          if (!last || last[0] !== p[0] || last[1] !== p[1]) geometry.push(p);
        }
      }
      if (geometry.length < 2) return null;

      return {
        geometry,
        legs,
        distanceMeters: route.distance ?? 0,
        durationSeconds: route.duration ?? 0,
      };
    },
  };
}

// ---------------- Mapbox Directions (real, tenant-supplied token) ----------------

type MapboxResponse = {
  code?: string;
  routes?: {
    distance: number;
    duration: number;
    legs?: { distance: number; duration: number }[];
    geometry?: { coordinates?: LngLat[] };
  }[];
};

/**
 * Real Mapbox Directions adapter - active only when a tenant sets MAPBOX_TOKEN.
 * Mapbox returns one overview geometry (not per-leg step geometry at this
 * verbosity), so legs carry distance/duration and the whole geometry rides on
 * the first leg; the map still draws the true road path. Unconfigured, it
 * reports not-connected and callers fall back.
 */
function mapbox(token: string): RoutingProvider {
  return {
    id: "mapbox",
    isConnected: () => token.length > 0,
    async route(waypoints) {
      if (waypoints.length < 2 || !token) return null;
      const coords = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(";");
      const url =
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
        `?overview=full&geometries=geojson&access_token=${encodeURIComponent(token)}`;
      const json = (await fetchJson(url)) as MapboxResponse | null;
      const route = json?.code === "Ok" ? json.routes?.[0] : undefined;
      const geometry = route?.geometry?.coordinates;
      if (!geometry || geometry.length < 2) return null;
      const legs: RouteLeg[] = (route.legs ?? []).map((leg, i) => ({
        geometry: i === 0 ? geometry : [],
        distanceMeters: leg.distance ?? 0,
        durationSeconds: leg.duration ?? 0,
      }));
      return {
        geometry,
        legs: legs.length ? legs : [{ geometry, distanceMeters: route.distance ?? 0, durationSeconds: route.duration ?? 0 }],
        distanceMeters: route.distance ?? 0,
        durationSeconds: route.duration ?? 0,
      };
    },
  };
}

// ---------------- None (honest straight-line fallback) ----------------

const noneRouting: RoutingProvider = {
  id: "none",
  isConnected: () => false,
  route: async () => null,
};

export function getRoutingProvider(): RoutingProvider {
  switch (env.routingProvider) {
    case "none":
      return noneRouting;
    case "mapbox":
      return mapbox(env.mapboxToken);
    case "osrm":
    default:
      return osrm(env.routingBaseUrl);
  }
}
