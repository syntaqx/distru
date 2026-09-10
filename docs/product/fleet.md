---
title: "Dispatch"
section: "Operations"
summary: "A live fleet map, the deliveries board, and the drivers and vehicles behind them."
keywords: ["dispatch","fleet","driver","drivers","vehicle","vehicles","delivery","deliveries","map","telemetry","logistics","van","truck","roster","route"]
order: 25
---
# Dispatch

The **Dispatch** page (at `/fleet`) is where the day runs. It opens on a live **fleet map** and carries the **deliveries board**, plus the **drivers** and **vehicles** behind them - across four tabs (**Dispatch**, **Deliveries**, **Drivers**, **Vehicles**), with a header of fleet + delivery stats.

## Live fleet map

The Dispatch tab is a full-height **dispatch console**: a docked list of the day's runs on the left, and an edge-to-edge WebGL map (MapLibre GL, keyless [OpenFreeMap](https://openfreemap.org) vector tiles) on the right, centered on your **depot**.

**It runs in real time.** Each of the day's runs has a schedule - a morning departure and an afternoon completion - and every vehicle's live position, status, ETA, and drop-off times are derived from the **current wall-clock time** against that schedule. So the day plays out on its own: early morning the fleet is still loading, midday it's mid-route, and by evening every stop is delivered. There's no "simulate" button - a small **Live** clock in the header shows the board refreshing itself. (The demo seeds **10 drivers/vans**; the position feed is a realistic model walked *along the real roads*, not a live GPS/Onfleet stream.)

The map draws:

- **Route lines on the real street network** - each run is routed depot → stops → depot through a directions provider (OSRM by default), cached so the board loads instantly. The **road already driven is solid**; the road **still ahead is dotted**, so progress reads at a glance.
- **Every stop** colored by delivery status - **green delivered, amber out-for-delivery, red failed, slate pending** - with a route-colored ring tying it to its run.
- **Each moving vehicle** as a directional arrow pointing the way it's heading, driving its real street leg toward the current stop; idle vans rest at the depot.

The **left list** is sortable (most stops left / progress / soonest ETA / driver / status), filterable (all / en route / returning), and searchable by driver, van, or customer - each row shows a live progress bar and status.

**Select a driver** and the whole selected route lights up (bold, on a white casing) while the rest fade back; the map **frames the run, then auto-follows the vehicle** as it moves. A **detail overlay** slides up over the map with that driver's live vehicle data (make/model, plate, speed, heading, ETA) and a **horizontal activity timeline** of the run - depart → each stop with a check / cross / pending marker → return.

## The depot

The map centers on - and every run departs from and returns to - your **depot**: a `locations` record flagged as the depot, carrying an address and coordinates. Set a location's coordinates and mark it the depot (the demo seeds an "Austin Depot"), and the map, routing, and every schedule move with it. That's the single place the depot is configured.

## Drivers
A **driver** is a person who runs deliveries, tracked by **name**, **phone**, and **license number**. Add one with **New driver** and maintain the roster as staff change; edit or search from the Drivers tab.

## Vehicles
A **vehicle** is a delivery vehicle - a van, truck, or car - tracked by **name**, **make**, **model**, and **license plate**. Keep the fleet list current so dispatch reflects what's actually on the road.

## Deliveries
The **Deliveries** tab is the board where you assign these drivers and vehicles to outbound orders, move each delivery through its statuses, and pull a per-driver route for the day. It's covered in full in [Deliveries](/docs/deliveries).

> Drivers and vehicles are ordinary records - create, edit, and delete them as your operation changes, from the page or through the Copilot and API.
