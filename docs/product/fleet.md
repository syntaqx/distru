---
title: "Dispatch"
section: "Operations"
summary: "A live fleet map, the deliveries board, and the drivers and vehicles behind them."
keywords: ["dispatch","fleet","driver","drivers","vehicle","vehicles","delivery","deliveries","map","telemetry","logistics","van","truck","roster","route"]
order: 25
---
# Dispatch

The **Dispatch** page (at `/dispatch`) is where the day runs. It opens on a live **fleet map** and carries the **deliveries board**, plus the **drivers** and **vehicles** behind them - across four tabs (**Dispatch**, **Deliveries**, **Drivers**, **Vehicles**), with a header of fleet + delivery stats.

## Live fleet map

The Dispatch tab shows a real **WebGL map** (MapLibre GL, rendered from keyless [OpenFreeMap](https://openfreemap.org) vector tiles) centered on **Austin, TX**: the depot, every delivery stop (colored by status), and each vehicle as a marker that **moves** along its route to its current stop, with a side panel of per-vehicle telemetry - driver, speed, heading, current stop, ETA, and stops done/remaining. The position feed is a **simulated** telemetry stream (a deterministic mock, not a live GPS/Onfleet integration); a "Simulate tick" button advances the day. Seed data lays out a realistic Austin day - runs out on the road now, more assigned for tomorrow - refreshed on every nightly/deploy reseed.

## Drivers
A **driver** is a person who runs deliveries, tracked by **name**, **phone**, and **license number**. Add one with **New driver** and maintain the roster as staff change; edit or search from the Drivers tab.

## Vehicles
A **vehicle** is a delivery vehicle - a van, truck, or car - tracked by **name**, **make**, **model**, and **license plate**. Keep the fleet list current so dispatch reflects what's actually on the road.

## Deliveries
The **Deliveries** tab is the board where you assign these drivers and vehicles to outbound orders, move each delivery through its statuses, and pull a per-driver route for the day. It's covered in full in [Deliveries](/docs/deliveries).

> Drivers and vehicles are ordinary records - create, edit, and delete them as your operation changes, from the page or through the Copilot and API.
