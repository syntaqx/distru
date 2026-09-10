---
title: "Deliveries"
section: "Operations"
summary: "Turn orders into deliveries, assign a driver and vehicle, work the board, and run a per-driver manifest."
keywords: ["delivery","deliveries","board","kanban","driver","vehicle","assign","manifest","route","dispatch","out for delivery","delivered","stop","sequence"]
order: 25.5
---
# Deliveries

The **Deliveries** board lives on the [Dispatch](/docs/fleet) page. It turns fulfillable orders into routed stops, tracks each one from assignment to the doorstep, and gives each driver a daily manifest. It has two views - **Board** and **Driver manifest**.

## Create a delivery from an order
Click **New delivery** and pick an order. Only active, unrouted orders are offered - those in **Processing**, **Ready to ship**, or **Delivering** that don't already have a delivery. The delivery snapshots the order's shipping address, and you can set a driver, vehicle, scheduled time, and notes up front. Creating it with a driver lands it **Assigned**; without one it starts as a **Draft**.

## The board
The Board is five columns, one per status:

| Status | What it means | Move it forward |
|---|---|---|
| **Draft** | Created, no driver yet | **Assign** a driver (and vehicle) |
| **Assigned** | Driver set, not yet rolling | **Out for delivery**, or Reassign |
| **Out for delivery** | On the road | **Mark delivered**, or **Failed** |
| **Delivered** | Dropped off | Complete (terminal) |
| **Failed** | Attempt didn't land | **Retry** or Reassign |

Each card shows the order, customer, address, scheduled time, driver, and vehicle. Assigning or reassigning opens a dialog to pick the **driver**, an optional **vehicle**, and a **scheduled** date and time.

## Keeping the order in step
Advancing a delivery nudges its linked order forward automatically: sending one **Out for delivery** moves the order to Delivering, and marking it **Delivered** moves the order to Delivered and stamps the delivery time. This only ever moves an order forward - it never cancels or reverses one.

## Driver manifest
Switch to **Driver manifest**, pick a driver and a date, and you get that driver's **route for the day** - their stops in sequence, each numbered, with address and scheduled time, plus a Stops/Delivered tally. Start and mark-delivered buttons sit on each stop so a driver can work the list top to bottom.

> The Copilot and API can create and assign deliveries too, using the same drivers and vehicles from [Dispatch](/docs/fleet).
