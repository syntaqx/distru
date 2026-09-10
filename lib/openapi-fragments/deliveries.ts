/**
 * OpenAPI fragment: logistics / delivery endpoints.
 *
 * Deliveries are Distru's Onfleet-style dispatch layer: one delivery fulfills one
 * sales order, carries its own driver/vehicle assignment, schedule, address
 * snapshot, and stop sequence, and drives the order's fulfillment lifecycle
 * forward as it advances (OUT_FOR_DELIVERY -> order DELIVERING, DELIVERED ->
 * order DELIVERED).
 *
 * Register in lib/openapi-extra.ts:
 *   import * as deliveries from "./openapi-fragments/deliveries";
 *   EXTRA_PATHS:   ...deliveries.paths
 *   EXTRA_SCHEMAS: ...deliveries.schemas
 */

const STATUS_ENUM = ["DRAFT", "ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"];

const unauthorized = { $ref: "#/components/responses/Unauthorized" };
const notFound = { $ref: "#/components/responses/NotFound" };

const idRef = (description: string) => ({
  type: "object",
  nullable: true,
  description,
  properties: { id: { type: "string", format: "uuid" } },
});

const pageParams = [
  {
    name: "page[number]",
    in: "query",
    schema: { type: "integer", minimum: 1, default: 1 },
    description:
      "1-based page number - the primary pagination scheme; follow the response's next_page URL for the following page. Defaults to 1.",
  },
  {
    name: "page[after]",
    in: "query",
    schema: { type: "string" },
    description: "Also accepted: an opaque cursor from a prior response's next_page.",
  },
];

const idParam = [
  { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
];

export const paths: Record<string, unknown> = {
  "/api/v1/deliveries": {
    get: {
      tags: ["Deliveries"],
      summary: "List deliveries",
      description:
        "List deliveries, newest first within stop sequence. Filter by `status`, " +
        "`driver_id`, and a `scheduled_datetime` range (Distru's comma-delimited " +
        "inclusive range, e.g. `2026-01-01T00:00:00Z,`).",
      parameters: [
        {
          name: "status",
          in: "query",
          schema: { type: "string", enum: STATUS_ENUM },
          description: "Filter to a single delivery status.",
        },
        {
          name: "driver_id",
          in: "query",
          schema: { type: "string", format: "uuid" },
          description: "Filter to deliveries assigned to one driver.",
        },
        {
          name: "scheduled_datetime",
          in: "query",
          schema: { type: "string" },
          description:
            "Inclusive scheduled-datetime range, comma-delimited (`from,to`); either side may be omitted.",
        },
        ...pageParams,
      ],
      responses: {
        "200": {
          description: "A page of deliveries.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/DeliveryList" } } },
        },
        "401": unauthorized,
      },
    },
    post: {
      tags: ["Deliveries"],
      summary: "Upsert a delivery",
      description:
        "Create or update a delivery (Distru-style sparse upsert: omit `id` to " +
        "create, include it to update only the fields sent). On create, identify " +
        "the order by `order_id` or `order_number`; the delivery snapshots the " +
        "order's shipping address. Setting `status` to OUT_FOR_DELIVERY or " +
        "DELIVERED nudges the order's fulfillment status forward.",
      requestBody: {
        required: true,
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/DeliveryUpsert" } },
        },
      },
      responses: {
        "200": {
          description: "The updated delivery.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/DeliveryEnvelope" } } },
        },
        "201": {
          description: "The created delivery.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/DeliveryEnvelope" } } },
        },
        "401": unauthorized,
        "404": notFound,
      },
    },
  },

  "/api/v1/deliveries/{id}": {
    get: {
      tags: ["Deliveries"],
      summary: "Get a delivery",
      description: "Fetch a single delivery by id.",
      parameters: idParam,
      responses: {
        "200": {
          description: "The delivery.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/DeliveryEnvelope" } } },
        },
        "401": unauthorized,
        "404": notFound,
      },
    },
  },

  "/api/v1/fleet/telemetry": {
    get: {
      tags: ["Deliveries"],
      summary: "Get the live fleet telemetry snapshot",
      description:
        "The live dispatch snapshot behind the Dispatch board: every vehicle's " +
        "last-known position, speed, heading, and movement status (IDLE, " +
        "EN_ROUTE, STOPPED, RETURNING), its driver, the delivery it is currently " +
        "running (with destination coordinates and a distance-based ETA), and " +
        "per-vehicle plus fleet-wide stop counts for today. Coordinates are within " +
        "the Austin, TX operating area. Read-only; not paginated (a fleet is small).",
      responses: {
        "200": {
          description: "The fleet telemetry snapshot.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/FleetTelemetryEnvelope" } },
          },
        },
        "401": unauthorized,
      },
    },
  },
};

const TELEMETRY_STATUS_ENUM = ["IDLE", "EN_ROUTE", "STOPPED", "RETURNING"];

const LatLng = {
  type: "object",
  nullable: true,
  properties: {
    lat: { type: "number", format: "double" },
    lng: { type: "number", format: "double" },
  },
};

const VehicleTelemetry = {
  type: "object",
  properties: {
    vehicle: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string" },
        make: { type: "string", nullable: true },
        model: { type: "string", nullable: true },
        license_plate: { type: "string", nullable: true },
      },
    },
    driver: idRef("The driver currently running this vehicle."),
    status: { type: "string", enum: TELEMETRY_STATUS_ENUM },
    location: { ...LatLng, description: "Last-known position." },
    speed_mph: { type: "number", format: "double", nullable: true },
    heading_deg: { type: "integer", nullable: true, description: "Compass heading (0=N, 90=E)." },
    updated_datetime: { type: "string", format: "date-time", nullable: true },
    current_delivery: {
      type: "object",
      nullable: true,
      description: "The stop this vehicle is currently driving toward.",
      properties: {
        id: { type: "string", format: "uuid" },
        order_number: { type: "string", nullable: true },
        customer: { type: "string", nullable: true },
        address: { type: "string", nullable: true },
        location: LatLng,
        sequence: { type: "integer", nullable: true },
        status: { type: "string", enum: STATUS_ENUM },
        eta_minutes: { type: "integer", nullable: true, description: "Estimated minutes to the stop." },
      },
    },
    stops_delivered_today: { type: "integer" },
    stops_remaining_today: { type: "integer" },
    stops_total_today: { type: "integer" },
  },
};

const FleetTelemetry = {
  type: "object",
  properties: {
    depot: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" } } },
    bounds: {
      type: "object",
      description: "The lat/lng bounding box of the operating area (Austin, TX).",
      properties: {
        south: { type: "number" },
        north: { type: "number" },
        west: { type: "number" },
        east: { type: "number" },
      },
    },
    fleet: {
      type: "object",
      properties: {
        en_route: { type: "integer" },
        idle: { type: "integer" },
        returning: { type: "integer" },
        stops_remaining: { type: "integer" },
      },
    },
    vehicles: { type: "array", items: { $ref: "#/components/schemas/VehicleTelemetry" } },
  },
};

const Delivery = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    status: { type: "string", enum: STATUS_ENUM },
    order: {
      type: "object",
      nullable: true,
      description: "The sales order this delivery fulfills.",
      properties: {
        id: { type: "string", format: "uuid" },
        order_number: { type: "string", nullable: true },
      },
    },
    company: idRef("The order's customer company."),
    driver: idRef("The assigned driver."),
    vehicle: idRef("The assigned vehicle."),
    route_id: { type: "string", format: "uuid", nullable: true },
    sequence: { type: "integer", nullable: true, description: "1-based stop number on the route." },
    address: {
      type: "object",
      nullable: true,
      additionalProperties: { type: "string", nullable: true },
      description: "Address snapshot taken from the order at creation.",
    },
    lat: { type: "number", format: "double", nullable: true, description: "Destination latitude." },
    lng: { type: "number", format: "double", nullable: true, description: "Destination longitude." },
    scheduled_datetime: { type: "string", format: "date-time", nullable: true },
    delivered_datetime: { type: "string", format: "date-time", nullable: true },
    notes: { type: "string", nullable: true },
    inserted_datetime: { type: "string", format: "date-time", nullable: true },
    updated_datetime: { type: "string", format: "date-time", nullable: true },
  },
};

export const schemas: Record<string, unknown> = {
  Delivery,
  DeliveryEnvelope: {
    type: "object",
    properties: { data: { $ref: "#/components/schemas/Delivery" } },
  },
  DeliveryList: {
    type: "object",
    properties: {
      data: { type: "array", items: { $ref: "#/components/schemas/Delivery" } },
      next_page: { type: "string", nullable: true },
      total: { type: "integer" },
    },
  },
  DeliveryUpsert: {
    type: "object",
    description:
      "Sparse upsert body. On create, one of `order_id`/`order_number` is required.",
    properties: {
      id: { type: "string", format: "uuid", description: "Include to update; omit to create." },
      order_id: { type: "string", format: "uuid" },
      order_number: { type: "string", description: "Alternative to order_id on create." },
      driver_id: { type: "string", format: "uuid", nullable: true },
      vehicle_id: { type: "string", format: "uuid", nullable: true },
      route_id: { type: "string", format: "uuid", nullable: true },
      status: { type: "string", enum: STATUS_ENUM },
      sequence: { type: "integer", nullable: true },
      scheduled_datetime: { type: "string", format: "date-time", nullable: true },
      delivered_datetime: { type: "string", format: "date-time", nullable: true },
      notes: { type: "string", nullable: true },
      lat: { type: "number", format: "double", nullable: true, description: "Destination latitude." },
      lng: { type: "number", format: "double", nullable: true, description: "Destination longitude." },
      address: {
        type: "object",
        nullable: true,
        additionalProperties: { type: "string", nullable: true },
      },
    },
  },
  VehicleTelemetry,
  FleetTelemetry,
  FleetTelemetryEnvelope: {
    type: "object",
    properties: { data: { $ref: "#/components/schemas/FleetTelemetry" } },
  },
};
