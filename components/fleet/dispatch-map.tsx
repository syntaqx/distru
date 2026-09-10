"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker as MlMarker } from "maplibre-gl";
import type { FleetTelemetrySnapshot } from "./dispatch-board";
// maplibre's stylesheet is served from /public (copied by
// scripts/copy-maplibre-worker.mjs) and linked in the JSX below via React's
// stylesheet hoisting - the bundler's client-component CSS import for this
// package didn't reliably emit, which collapsed the canvas and hid the controls.
const MAP_CSS_HREF = "/maplibre/maplibre-gl.css";

// OpenFreeMap: free, keyless vector tiles (Carto now needs an API key). MapLibre
// renders them with WebGL. `liberty` is a clean street style.
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Per-driver route colors, assigned by the order routes arrive in the snapshot.
const ROUTE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#8b5cf6", "#ef4444"];

const VEHICLE_COLOR: Record<string, string> = {
  EN_ROUTE: "#f59e0b",
  IDLE: "#94a3b8",
  RETURNING: "#3b82f6",
  STOPPED: "#a855f7",
};

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/** Does this browser actually have a usable WebGL context? (maplibre needs one.) */
function webglSupported(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(
      c.getContext("webgl2") ||
      c.getContext("webgl") ||
      c.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

/** A numbered, colored stop pin (route color + sequence label). */
function stopEl(color: string, label: string): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText =
    `display:grid;place-items:center;width:22px;height:22px;border-radius:9999px;` +
    `background:${color};color:#fff;font:600 11px/1 system-ui,sans-serif;` +
    `border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer`;
  el.textContent = label;
  return el;
}

function dot(color: string): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = `width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);cursor:pointer`;
  return el;
}

/** A rotatable van arrow marker element (rotation applied via marker.setRotation). */
function vanEl(color: string): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = "width:26px;height:26px;cursor:pointer;will-change:transform";
  el.innerHTML =
    `<svg viewBox="-13 -13 26 26" width="26" height="26">` +
    `<circle r="12" fill="${color}" opacity="0.2"/>` +
    `<path d="M 0 -10 L 7 8 L 0 4 L -7 8 Z" fill="${color}" stroke="#fff" stroke-width="1.4"/></svg>`;
  return el;
}

type RoutesGeoJSON = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: { color: string };
    geometry: { type: "LineString"; coordinates: [number, number][] };
  }[];
};

/** Build one LineString per driver: depot -> each stop in sequence. */
function routesToGeoJSON(t: FleetTelemetrySnapshot): RoutesGeoJSON {
  return {
    type: "FeatureCollection",
    features: t.routes
      .filter((r) => r.stops.length > 0)
      .map((r, i) => ({
        type: "Feature" as const,
        properties: { color: ROUTE_COLORS[i % ROUTE_COLORS.length] },
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [t.depot.lng, t.depot.lat] as [number, number],
            ...r.stops.map((s) => [s.lng, s.lat] as [number, number]),
          ],
        },
      })),
  };
}

/**
 * A real WebGL map of the fleet (MapLibre GL + OpenFreeMap tiles). Draws one
 * colored route line per driver (depot -> ordered stops) with numbered stop pins,
 * plus live vehicle arrows that tween along an arc so the map reads as moving.
 * The base map inits once; markers + route data rebuild when the telemetry
 * snapshot changes (a simulate tick), so tiles aren't reloaded.
 */
export function DispatchMap({
  telemetry,
  selected,
  onSelect,
}: {
  telemetry: FleetTelemetrySnapshot;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Init the map once.
  useEffect(() => {
    if (!webglSupported()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("This browser has no WebGL, which the map needs to render.");
      return;
    }
    let cancelled = false;
    let map: MlMap | null = null;
    let resizeObs: ResizeObserver | null = null;
    (async () => {
      try {
        // maplibre-gl is pure named ESM (no default export) - use the namespace.
        const maplibregl = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;
        mlRef.current = maplibregl;
        // maplibre v6 builds its worker URL dynamically (`new URL('./…worker.mjs',
        // import.meta.url)`), which the bundler can't emit -> the worker 404s and
        // the canvas stays blank. Point it at the self-hosted copy in /public
        // (see scripts/copy-maplibre-worker.mjs). Idempotent across re-inits.
        maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
        map = new maplibregl.Map({
          container: containerRef.current,
          style: MAP_STYLE,
          center: [telemetry.depot.lng, telemetry.depot.lat],
          zoom: 10.5,
          attributionControl: { compact: true },
        });
        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        // Keep the canvas sized to its container (it can measure 0 at init inside
        // a grid/tab, which leaves the map blank until it resizes).
        const ro = new ResizeObserver(() => map?.resize());
        ro.observe(containerRef.current);
        resizeObs = ro;
        map.on("error", (e: { error?: { message?: string } }) => {
          // Tile/style fetch failures shouldn't crash the panel; surface once.
          const msg = e?.error?.message;
          if (!cancelled && msg) {
            console.warn("[fleet-map] map error:", msg);
            setError(msg);
          }
        });
        map.on("load", () => {
          if (cancelled || !map) return;
          // Route lines source + layer (data set in the telemetry effect).
          map.addSource("routes", { type: "geojson", data: routesToGeoJSON(telemetry) });
          map.addLayer({
            id: "routes-line",
            type: "line",
            source: "routes",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": ["get", "color"],
              "line-width": 3,
              "line-opacity": 0.85,
            },
          });
          const b = telemetry.bounds;
          map.fitBounds(
            [
              [b.west, b.south],
              [b.east, b.north],
            ],
            { padding: 48, duration: 0 },
          );
          map.resize(); // the container may have been sized after init
          // The container's height can settle a frame or two after load (grid/tab
          // layout); resize again so the canvas fills it instead of collapsing.
          requestAnimationFrame(() => map?.resize());
          setTimeout(() => map?.resize(), 300);
          setReady(true);
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Map failed to load.";
        console.error("[fleet-map] init failed:", err);
        if (!cancelled) setError(msg);
      }
    })();
    return () => {
      cancelled = true;
      resizeObs?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
    // Re-init only if the depot/bounds identity changes (effectively never).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Re)build route data + markers whenever telemetry changes and the map is ready.
  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = mlRef.current;
    if (!map || !maplibregl || !ready) return;

    // Update the route lines in place (no tile reload).
    const src = map.getSource("routes") as { setData?: (d: RoutesGeoJSON) => void } | undefined;
    src?.setData?.(routesToGeoJSON(telemetry));

    const markers: MlMarker[] = [];
    let raf = 0;

    // Depot.
    const depotEl = document.createElement("div");
    depotEl.style.cssText =
      "width:16px;height:16px;background:#0ea5e9;border:2px solid #fff;transform:rotate(45deg);box-shadow:0 1px 3px rgba(0,0,0,.4)";
    markers.push(
      new maplibregl.Marker({ element: depotEl })
        .setLngLat([telemetry.depot.lng, telemetry.depot.lat])
        .setPopup(new maplibregl.Popup({ offset: 16 }).setText("Depot"))
        .addTo(map),
    );

    // Numbered stop pins, colored by their driver's route.
    const stopColor = new Map<string, string>();
    telemetry.routes.forEach((r, i) => {
      const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
      for (const s of r.stops) stopColor.set(s.id, color);
    });
    for (const s of telemetry.stops) {
      const color = stopColor.get(s.id);
      const el = color ? stopEl(color, s.sequence != null ? String(s.sequence) : "•") : dot("#94a3b8");
      markers.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([s.lng, s.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 16 }).setText(
              `${s.sequence != null ? `#${s.sequence} · ` : ""}${s.customer ?? s.orderNumber ?? "Stop"}${
                s.address ? ` — ${s.address}` : ""
              }`,
            ),
          )
          .addTo(map),
      );
    }

    // Vehicles: static (idle/stopped) or animated (en route/returning) along an arc.
    type Anim = { marker: MlMarker; loop: [number, number][]; total: number; cum: number[]; phase: number; duration: number };
    const anims: Anim[] = [];

    for (const v of telemetry.vehicles) {
      const t = v.telemetry;
      if (!t) continue;
      const color = VEHICLE_COLOR[t.status] ?? "#94a3b8";
      const el = vanEl(color);
      el.addEventListener("click", () => onSelect(v.vehicle.id));
      const marker = new maplibregl.Marker({ element: el, rotationAlignment: "map" })
        .setLngLat([t.lng, t.lat])
        .setRotation(t.headingDeg)
        .addTo(map);
      markers.push(marker);

      let target: [number, number] | null = null;
      if (t.status === "EN_ROUTE" && v.currentDelivery?.lat != null && v.currentDelivery?.lng != null) {
        target = [v.currentDelivery.lng, v.currentDelivery.lat];
      } else if (t.status === "RETURNING") {
        target = [telemetry.depot.lng, telemetry.depot.lat];
      }
      if (!target) continue; // idle/stopped stay put

      const start: [number, number] = [t.lng, t.lat];
      const jitter = hash01(v.vehicle.id);
      const dx = target[0] - start[0];
      const dy = target[1] - start[1];
      const len = Math.hypot(dx, dy) || 1e-6;
      const px = -dy / len;
      const py = dx / len;
      const bow = len * (0.12 + jitter * 0.08);
      const mid: [number, number] = [(start[0] + target[0]) / 2, (start[1] + target[1]) / 2];
      const loop: [number, number][] = [
        start,
        [mid[0] + px * bow, mid[1] + py * bow],
        target,
        [mid[0] - px * bow, mid[1] - py * bow],
        start,
      ];
      const cum = [0];
      let total = 0;
      for (let i = 1; i < loop.length; i++) {
        total += Math.hypot(loop[i][0] - loop[i - 1][0], loop[i][1] - loop[i - 1][1]);
        cum.push(total);
      }
      anims.push({ marker, loop, cum, total: total || 1, phase: jitter, duration: 16000 + jitter * 9000 });
    }

    if (anims.length > 0) {
      const step = (now: number) => {
        for (const a of anims) {
          const p = ((now / a.duration + a.phase) % 1) * a.total;
          let i = 1;
          while (i < a.cum.length && a.cum[i] < p) i++;
          const s = a.loop[i - 1];
          const e = a.loop[Math.min(i, a.loop.length - 1)];
          const segLen = a.cum[Math.min(i, a.cum.length - 1)] - a.cum[i - 1] || 1;
          const f = (p - a.cum[i - 1]) / segLen;
          const lng = s[0] + (e[0] - s[0]) * f;
          const lat = s[1] + (e[1] - s[1]) * f;
          a.marker.setLngLat([lng, lat]);
          a.marker.setRotation((Math.atan2(e[0] - s[0], e[1] - s[1]) * 180) / Math.PI);
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }

    return () => {
      cancelAnimationFrame(raf);
      for (const m of markers) m.remove();
    };
  }, [telemetry, ready, onSelect]);

  // Highlight the selected vehicle: recenter on it (keeps the panel + map in sync).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected) return;
    const v = telemetry.vehicles.find((x) => x.vehicle.id === selected);
    if (v?.telemetry) map.easeTo({ center: [v.telemetry.lng, v.telemetry.lat], duration: 500 });
  }, [selected, telemetry.vehicles]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg">
      {/* Vendor stylesheet served from /public; React hoists + dedupes it. */}
      <link rel="stylesheet" href={MAP_CSS_HREF} precedence="default" />
      {/* The map element carries the height DIRECTLY (in-flow block) rather than
          relying on an absolute-inset-0 child to inherit a parent height - inside
          this grid/card the parent height wasn't resolving, so the canvas
          collapsed to 0 (diagnosed via cont W×0). */}
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: "clamp(380px, 52vh, 640px)", background: "var(--color-surface2)" }}
        role="img"
        aria-label="Live WebGL map of the delivery fleet across Austin, Texas"
      />

      {/* Loading shimmer until the first style load completes. */}
      {!ready && !error && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-xs text-muted backdrop-blur-sm dark:bg-white/5">
            <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Loading map…
          </div>
        </div>
      )}

      {/* Prominent, readable error state (so a real failure never looks "blank"). */}
      {error && (
        <div className="absolute inset-0 grid place-items-center p-4">
          <div className="max-w-sm rounded-xl border border-danger/40 bg-surface/95 p-4 text-center shadow-lg backdrop-blur-sm">
            <div className="text-sm font-semibold text-danger">Map couldn’t load</div>
            <p className="mt-1 wrap-break-word text-xs text-muted">{error}</p>
            <p className="mt-2 text-xs text-muted">
              The fleet list on the right is still live. Route lines and stops are listed there too.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
