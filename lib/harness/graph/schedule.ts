import type { WorkflowGraph } from "./types";

/**
 * A small standard-cron evaluator (5 fields: minute hour day-of-month month
 * day-of-week). Supports "*", a number, step values, ranges "a-b", and comma
 * lists. Enough to make schedules real without pulling a dependency; the durable
 * runtime seam (Inngest et al.) would own this in production.
 */
function matchField(field: string, value: number, min: number, max: number): boolean {
  if (field === "*") return true;
  for (const part of field.split(",")) {
    if (part.includes("/")) {
      const [range, stepStr] = part.split("/");
      const step = Number(stepStr);
      if (!step) continue;
      const [lo, hi] = range === "*" ? [min, max] : rangeBounds(range, min, max);
      for (let v = lo; v <= hi; v += step) if (v === value) return true;
    } else if (part.includes("-")) {
      const [lo, hi] = rangeBounds(part, min, max);
      if (value >= lo && value <= hi) return true;
    } else if (Number(part) === value) {
      return true;
    }
  }
  return false;
}

function rangeBounds(range: string, min: number, max: number): [number, number] {
  const [a, b] = range.split("-").map(Number);
  return [Number.isNaN(a) ? min : a, Number.isNaN(b) ? max : b];
}

function matches(cron: string, d: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [min, hr, dom, mon, dow] = parts;
  return (
    matchField(min, d.getUTCMinutes(), 0, 59) &&
    matchField(hr, d.getUTCHours(), 0, 23) &&
    matchField(dom, d.getUTCDate(), 1, 31) &&
    matchField(mon, d.getUTCMonth() + 1, 1, 12) &&
    matchField(dow, d.getUTCDay(), 0, 6)
  );
}

/** Next minute (UTC) at or after `from` that the cron matches, within a year. */
export function nextRunFromCron(cron: string, from: Date = new Date()): Date | null {
  const d = new Date(from);
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(d.getUTCMinutes() + 1);
  for (let i = 0; i < 366 * 24 * 60; i++) {
    if (matches(cron, d)) return new Date(d);
    d.setUTCMinutes(d.getUTCMinutes() + 1);
  }
  return null;
}

/** The active schedule of a graph, read from its trigger.schedule node. */
export function deriveSchedule(graph: WorkflowGraph | null | undefined): {
  isScheduled: boolean;
  cron: string | null;
  description: string | null;
} {
  const node = graph?.nodes?.find((n) => n.type === "trigger.schedule");
  if (!node) return { isScheduled: false, cron: null, description: null };
  const p = node.params as { cron?: string; description?: string };
  return {
    isScheduled: true,
    cron: p.cron?.trim() || null,
    description: p.description?.trim() || p.cron?.trim() || null,
  };
}
