/** OpenAPI fragment: cultivation endpoints (plant batches, plants, harvests). */

const PHASE_ENUM = ["IMMATURE", "VEGETATIVE", "FLOWERING", "HARVESTED", "DESTROYED"];
const STATUS_ENUM = ["ACTIVE", "FINISHED"];
const EVENT_TYPE_ENUM = ["MOVE", "FEED", "PHASE_CHANGE", "DESTROY", "HARVEST", "NOTE"];

/** A nullable `{ id }` reference stub, as emitted by the *ToApi mappers. */
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

const unauthorized = { $ref: "#/components/responses/Unauthorized" };
const notFound = { $ref: "#/components/responses/NotFound" };

function listResponse(schemaName: string, description: string) {
  return {
    "200": {
      description,
      content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaName}` } } },
    },
    "401": unauthorized,
  };
}

function upsertResponses(envelope: string) {
  return {
    "200": {
      description: "The updated record (when `id` was supplied).",
      content: { "application/json": { schema: { $ref: `#/components/schemas/${envelope}` } } },
    },
    "201": {
      description: "The created record.",
      content: { "application/json": { schema: { $ref: `#/components/schemas/${envelope}` } } },
    },
    "400": { $ref: "#/components/responses/BadRequest" },
    "401": unauthorized,
  };
}

function detailResponses(envelope: string, description: string) {
  return {
    "200": {
      description,
      content: { "application/json": { schema: { $ref: `#/components/schemas/${envelope}` } } },
    },
    "401": unauthorized,
    "404": notFound,
  };
}

export const paths: Record<string, unknown> = {
  "/public/v1/plant-batches": {
    get: {
      tags: ["Cultivation"],
      summary: "List plant batches",
      description: "A page of cultivation plant batches, most recently planted first.",
      parameters: pageParams,
      responses: listResponse("PlantBatchList", "A page of plant batches."),
    },
    post: {
      tags: ["Cultivation"],
      summary: "Create or update a plant batch (sparse upsert)",
      description:
        "Omit `id` to create (a batch number is generated when omitted); include `id` to update. Only the fields you send change.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/PlantBatchUpsert" } } },
      },
      responses: upsertResponses("PlantBatchEnvelope"),
    },
  },
  "/public/v1/plant-batches/{id}": {
    get: {
      tags: ["Cultivation"],
      summary: "Get a plant batch by id",
      parameters: idParam,
      responses: detailResponses("PlantBatchEnvelope", "The plant batch."),
    },
  },
  "/public/v1/plants": {
    get: {
      tags: ["Cultivation"],
      summary: "List plants",
      description: "A page of individual plants, most recently planted first.",
      parameters: [
        ...pageParams,
        {
          name: "phase",
          in: "query",
          schema: { type: "string", enum: PHASE_ENUM },
          description: "Filter to a single lifecycle phase.",
        },
      ],
      responses: listResponse("PlantList", "A page of plants."),
    },
    post: {
      tags: ["Cultivation"],
      summary: "Create or update a plant (sparse upsert)",
      description:
        "Omit `id` to create (a plant tag is generated when omitted); include `id` to update. Only the fields you send change.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/PlantUpsert" } } },
      },
      responses: upsertResponses("PlantEnvelope"),
    },
  },
  "/public/v1/plants/{id}": {
    get: {
      tags: ["Cultivation"],
      summary: "Get a plant by id",
      parameters: idParam,
      responses: detailResponses("PlantEnvelope", "The plant."),
    },
  },
  "/public/v1/harvests": {
    get: {
      tags: ["Cultivation"],
      summary: "List harvests",
      description: "A page of harvests, most recently harvested first.",
      parameters: pageParams,
      responses: listResponse("HarvestList", "A page of harvests."),
    },
    post: {
      tags: ["Cultivation"],
      summary: "Create or update a harvest (sparse upsert)",
      description:
        "Omit `id` to create (a harvest number is generated when omitted); include `id` to update. Only the fields you send change.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/HarvestUpsert" } } },
      },
      responses: upsertResponses("HarvestEnvelope"),
    },
  },
  "/public/v1/harvests/{id}": {
    get: {
      tags: ["Cultivation"],
      summary: "Get a harvest by id",
      parameters: idParam,
      responses: detailResponses("HarvestEnvelope", "The harvest."),
    },
  },
  "/public/v1/plant-events": {
    get: {
      tags: ["Cultivation"],
      summary: "List plant lifecycle events",
      description:
        "The lifecycle event timeline (moves, feedings, phase changes, destroys, harvests, notes), most recent first. Filter to one subject with `plant_id` and/or `plant_batch_id`.",
      parameters: [
        ...pageParams,
        {
          name: "plant_id",
          in: "query",
          schema: { type: "string", format: "uuid" },
          description: "Only events for this plant.",
        },
        {
          name: "plant_batch_id",
          in: "query",
          schema: { type: "string", format: "uuid" },
          description: "Only events for this plant batch.",
        },
      ],
      responses: listResponse("PlantEventList", "A page of plant events."),
    },
    post: {
      tags: ["Cultivation"],
      summary: "Log a plant lifecycle event",
      description:
        "Append an event to a plant or plant batch. Exactly one of `plant_id` / `plant_batch_id` is required.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/PlantEventCreate" } } },
      },
      responses: {
        "201": {
          description: "The created event.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/PlantEventEnvelope" } } },
        },
        "400": { $ref: "#/components/responses/BadRequest" },
        "401": unauthorized,
      },
    },
  },
};

export const schemas: Record<string, unknown> = {
  PlantBatch: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      batch_number: { type: "string" },
      strain: idRef("The strain, if assigned."),
      location: idRef("The location, if assigned."),
      count: { type: "string", description: "Number of plants in the batch (stringified integer)." },
      phase: { type: "string", enum: PHASE_ENUM },
      source_type: { type: "string", nullable: true },
      planted_date: { type: "string", format: "date-time", nullable: true },
      inserted_datetime: { type: "string", format: "date-time" },
      updated_datetime: { type: "string", format: "date-time" },
    },
  },
  PlantBatchUpsert: {
    type: "object",
    description: "Include `id` to update an existing plant batch; omit it to create.",
    properties: {
      id: { type: "string", format: "uuid" },
      batch_number: { type: "string" },
      strain_id: { type: "string", format: "uuid", nullable: true },
      location_id: { type: "string", format: "uuid", nullable: true },
      count: { type: "integer" },
      phase: { type: "string", enum: PHASE_ENUM },
      source_type: { type: "string", nullable: true },
    },
  },
  PlantBatchList: {
    type: "object",
    properties: {
      data: { type: "array", items: { $ref: "#/components/schemas/PlantBatch" } },
      next_page: { type: "string", nullable: true },
      total: { type: "integer" },
    },
  },
  PlantBatchEnvelope: {
    type: "object",
    properties: { data: { $ref: "#/components/schemas/PlantBatch" } },
  },
  Plant: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      plant_tag: { type: "string" },
      strain: idRef("The strain, if assigned."),
      location: idRef("The location, if assigned."),
      plant_batch: idRef("The source plant batch, if any."),
      phase: { type: "string", enum: PHASE_ENUM },
      planted_date: { type: "string", format: "date-time", nullable: true },
      inserted_datetime: { type: "string", format: "date-time" },
      updated_datetime: { type: "string", format: "date-time" },
    },
  },
  PlantUpsert: {
    type: "object",
    description: "Include `id` to update an existing plant; omit it to create.",
    properties: {
      id: { type: "string", format: "uuid" },
      plant_tag: { type: "string" },
      strain_id: { type: "string", format: "uuid", nullable: true },
      location_id: { type: "string", format: "uuid", nullable: true },
      plant_batch_id: { type: "string", format: "uuid", nullable: true },
      phase: { type: "string", enum: PHASE_ENUM },
    },
  },
  PlantList: {
    type: "object",
    properties: {
      data: { type: "array", items: { $ref: "#/components/schemas/Plant" } },
      next_page: { type: "string", nullable: true },
      total: { type: "integer" },
    },
  },
  PlantEnvelope: {
    type: "object",
    properties: { data: { $ref: "#/components/schemas/Plant" } },
  },
  Harvest: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      harvest_number: { type: "string" },
      name: { type: "string", nullable: true },
      strain: idRef("The strain, if assigned."),
      location: idRef("The location, if assigned."),
      plant_count: { type: "string", description: "Number of plants harvested (stringified integer)." },
      wet_weight: { type: "number", nullable: true },
      dry_weight: { type: "number", nullable: true },
      status: { type: "string", enum: STATUS_ENUM },
      harvested_date: { type: "string", format: "date-time", nullable: true },
      inserted_datetime: { type: "string", format: "date-time" },
      updated_datetime: { type: "string", format: "date-time" },
    },
  },
  HarvestUpsert: {
    type: "object",
    description: "Include `id` to update an existing harvest; omit it to create.",
    properties: {
      id: { type: "string", format: "uuid" },
      harvest_number: { type: "string" },
      name: { type: "string", nullable: true },
      strain_id: { type: "string", format: "uuid", nullable: true },
      location_id: { type: "string", format: "uuid", nullable: true },
      plant_count: { type: "integer" },
      wet_weight: { type: "number", nullable: true },
      dry_weight: { type: "number", nullable: true },
      status: { type: "string", enum: STATUS_ENUM },
    },
  },
  HarvestList: {
    type: "object",
    properties: {
      data: { type: "array", items: { $ref: "#/components/schemas/Harvest" } },
      next_page: { type: "string", nullable: true },
      total: { type: "integer" },
    },
  },
  HarvestEnvelope: {
    type: "object",
    properties: { data: { $ref: "#/components/schemas/Harvest" } },
  },
  PlantEvent: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      plant_id: { type: "string", format: "uuid", nullable: true },
      plant_batch_id: { type: "string", format: "uuid", nullable: true },
      type: { type: "string", enum: EVENT_TYPE_ENUM },
      note: { type: "string", nullable: true },
      detail: { type: "string", nullable: true, description: "Optional JSON payload, e.g. { from, to }." },
      occurred_datetime: { type: "string", format: "date-time", nullable: true },
      inserted_datetime: { type: "string", format: "date-time" },
      updated_datetime: { type: "string", format: "date-time" },
    },
  },
  PlantEventCreate: {
    type: "object",
    description: "One of plant_id / plant_batch_id is required.",
    required: ["type"],
    properties: {
      plant_id: { type: "string", format: "uuid", nullable: true },
      plant_batch_id: { type: "string", format: "uuid", nullable: true },
      type: { type: "string", enum: EVENT_TYPE_ENUM },
      note: { type: "string", nullable: true },
      detail: { type: "string", nullable: true },
      occurred_at: { type: "string", format: "date-time", nullable: true },
    },
  },
  PlantEventList: {
    type: "object",
    properties: {
      data: { type: "array", items: { $ref: "#/components/schemas/PlantEvent" } },
      next_page: { type: "string", nullable: true },
      total: { type: "integer" },
    },
  },
  PlantEventEnvelope: {
    type: "object",
    properties: { data: { $ref: "#/components/schemas/PlantEvent" } },
  },
};
