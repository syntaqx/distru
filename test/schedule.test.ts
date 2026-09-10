import { describe, expect, it } from "vitest";
import { deriveSchedule, nextRunFromCron } from "@/lib/harness/graph/schedule";
import type { WorkflowGraph } from "@/lib/harness/graph/types";

// A fixed Monday (2024-01-01T00:00:00Z is a Monday) so day-of-week cases are stable.
const MONDAY = new Date("2024-01-01T00:00:00.000Z");

describe("nextRunFromCron", () => {
  it("advances to the next step boundary and never returns the current minute", () => {
    // from is exactly on a boundary; the evaluator advances one minute first,
    // so the very next match is 15 minutes later, not 00:00.
    const next = nextRunFromCron("*/15 * * * *", MONDAY);
    expect(next?.toISOString()).toBe("2024-01-01T00:15:00.000Z");
  });

  it("rolls to the next day for a daily midnight schedule", () => {
    const from = new Date("2024-01-01T12:34:00.000Z");
    const next = nextRunFromCron("0 0 * * *", from);
    expect(next?.toISOString()).toBe("2024-01-02T00:00:00.000Z");
  });

  it("honors a specific minute-and-hour on the matching weekday", () => {
    const next = nextRunFromCron("30 9 * * 1", MONDAY); // 09:30 on Mondays
    expect(next?.toISOString()).toBe("2024-01-01T09:30:00.000Z");
  });

  it("matches hour ranges", () => {
    const next = nextRunFromCron("0 9-17 * * *", MONDAY);
    expect(next?.toISOString()).toBe("2024-01-01T09:00:00.000Z");
  });

  it("matches stepped ranges (every 6 hours within 0-12)", () => {
    const from = new Date("2024-01-01T01:00:00.000Z");
    const next = nextRunFromCron("0 0-12/6 * * *", from); // hours 0, 6, 12
    expect(next?.toISOString()).toBe("2024-01-01T06:00:00.000Z");
  });

  it("matches comma lists in the minute field", () => {
    const from = new Date("2024-01-01T00:05:00.000Z");
    const next = nextRunFromCron("0,30 * * * *", from);
    expect(next?.toISOString()).toBe("2024-01-01T00:30:00.000Z");
  });

  it("returns null for a malformed cron (wrong field count)", () => {
    expect(nextRunFromCron("* * *", MONDAY)).toBeNull();
    expect(nextRunFromCron("0 0 * * * *", MONDAY)).toBeNull();
  });

  it("returns null when no minute in a year matches an impossible day/month combo", () => {
    // Feb 30th never exists.
    expect(nextRunFromCron("0 0 30 2 *", MONDAY)).toBeNull();
  });
});

describe("deriveSchedule", () => {
  const scheduled: WorkflowGraph = {
    nodes: [
      {
        id: "s1",
        type: "trigger.schedule",
        name: "Every morning",
        params: { cron: " 0 9 * * * ", description: "  Morning report " },
        position: { x: 0, y: 0 },
      },
    ],
    connections: {},
  };

  it("reads and trims the cron and description from the schedule node", () => {
    expect(deriveSchedule(scheduled)).toEqual({
      isScheduled: true,
      cron: "0 9 * * *",
      description: "Morning report",
    });
  });

  it("falls back to the cron string when no description is set", () => {
    const graph: WorkflowGraph = {
      nodes: [
        {
          id: "s1",
          type: "trigger.schedule",
          name: "s",
          params: { cron: "*/5 * * * *" },
          position: { x: 0, y: 0 },
        },
      ],
      connections: {},
    };
    expect(deriveSchedule(graph)).toMatchObject({ cron: "*/5 * * * *", description: "*/5 * * * *" });
  });

  it("reports not-scheduled when there is no schedule trigger node", () => {
    const graph: WorkflowGraph = {
      nodes: [{ id: "m", type: "trigger.manual", name: "m", params: {}, position: { x: 0, y: 0 } }],
      connections: {},
    };
    expect(deriveSchedule(graph)).toEqual({ isScheduled: false, cron: null, description: null });
  });

  it("handles null/undefined graphs", () => {
    expect(deriveSchedule(null)).toEqual({ isScheduled: false, cron: null, description: null });
    expect(deriveSchedule(undefined)).toEqual({ isScheduled: false, cron: null, description: null });
  });

  it("returns null cron when the schedule node has an empty cron", () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: "s", type: "trigger.schedule", name: "s", params: { cron: "   " }, position: { x: 0, y: 0 } },
      ],
      connections: {},
    };
    expect(deriveSchedule(graph)).toEqual({ isScheduled: true, cron: null, description: null });
  });
});
