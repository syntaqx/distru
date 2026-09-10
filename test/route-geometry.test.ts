import { beforeEach, describe, expect, it } from "vitest";

// ROUTING_PROVIDER=none makes the routing seam return null for every route, so
// these tests exercise the pure geometry math and the honest straight-line
// fallback with no network. Set before importing the module under test.
process.env.ROUTING_PROVIDER = "none";

const {
  metersBetween,
  bearingOf,
  polylineMeters,
  walkAlong,
  getRoadRoute,
  getRunGeometry,
} = await import("@/lib/modules/logistics/route-geometry");

// A short L-shaped path near the Austin depot: east then north, ~ right angle.
const LINE: [number, number][] = [
  [-97.7431, 30.2672],
  [-97.7331, 30.2672], // ~960 m due east
  [-97.7331, 30.2772], // ~1113 m due north
];

describe("polyline math", () => {
  it("measures east/north legs at city scale", () => {
    const east = metersBetween(LINE[0], LINE[1]);
    const north = metersBetween(LINE[1], LINE[2]);
    expect(east).toBeGreaterThan(800);
    expect(east).toBeLessThan(1100);
    expect(north).toBeGreaterThan(1000);
    expect(north).toBeLessThan(1200);
    expect(polylineMeters(LINE)).toBeCloseTo(east + north, 5);
  });

  it("reports compass bearings (E=90, N=0)", () => {
    expect(bearingOf(LINE[0], LINE[1])).toBe(90); // due east
    expect(bearingOf(LINE[1], LINE[2])).toBe(0); // due north
  });
});

describe("walkAlong", () => {
  it("advances along the polyline and reports remaining distance", () => {
    const total = polylineMeters(LINE);
    const w = walkAlong(LINE, LINE[0], 500); // 500 m in from the start
    expect(w.metersToEnd).toBeCloseTo(total - 500, -1);
    expect(w.point[0]).toBeGreaterThan(LINE[0][0]); // moved east
    expect(w.heading).toBe(90);
  });

  it("projects an off-line point onto the path before walking", () => {
    // A point just north of the first (east-bound) leg projects back onto it.
    const off: [number, number] = [-97.7381, 30.2675];
    const w = walkAlong(LINE, off, 0);
    // Nearest point is on leg 1 (still heading east), well before the end.
    expect(w.metersToEnd).toBeGreaterThan(1000);
    expect(w.heading).toBe(90);
  });

  it("clamps at the end of the line (arrival)", () => {
    const w = walkAlong(LINE, LINE[0], 1e6);
    expect(w.metersToEnd).toBe(0);
    expect(w.point).toEqual(LINE[LINE.length - 1]);
  });
});

describe("routing fallback (ROUTING_PROVIDER=none)", () => {
  beforeEach(() => {
    // getRoadRoute caches; distinct waypoints per assertion avoid cross-talk.
  });

  it("returns null rather than throwing when routing is unavailable", async () => {
    expect(await getRoadRoute([LINE[0], LINE[1]])).toBeNull();
    expect(await getRoadRoute([LINE[0]])).toBeNull(); // too few waypoints
  });

  it("getRunGeometry yields null geometry but still maps legs to stops", async () => {
    const depot = { lat: 30.2672, lng: -97.7431 };
    const stops = [
      { id: "d1", lat: 30.2672, lng: -97.7331 },
      { id: "d2", lat: 30.2772, lng: -97.7331 },
    ];
    const { route, legDeliveryIds } = await getRunGeometry(depot, stops);
    expect(route).toBeNull(); // no provider geometry
    // depot->d1, d1->d2, then d2->depot (return leg, no delivery id).
    expect(legDeliveryIds).toEqual(["d1", "d2", null]);
  });

  it("getRunGeometry with no stops is a no-op", async () => {
    const { route, legDeliveryIds } = await getRunGeometry(
      { lat: 30.2672, lng: -97.7431 },
      [],
    );
    expect(route).toBeNull();
    expect(legDeliveryIds).toEqual([]);
  });
});
