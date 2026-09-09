"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { nodeSpec } from "@/lib/harness/graph/catalog";
import type { IfOp, WorkflowNode } from "@/lib/harness/graph/types";

export type ToolMeta = { name: string; description: string; gate: string };

type Patch = { name?: string; params?: Record<string, unknown> };

export function NodeConfig({
  node,
  tools,
  onChange,
  onDelete,
}: {
  node: WorkflowNode;
  tools: ToolMeta[];
  onChange: (patch: Patch) => void;
  onDelete: () => void;
}) {
  const spec = nodeSpec(node.type);
  const p = node.params as Record<string, unknown>;
  const setParam = (key: string, value: unknown) =>
    onChange({ params: { ...p, [key]: value } });

  const toolOptions = tools.map((t) => ({ value: t.name, label: t.name }));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted">{spec?.label ?? node.type}</div>
        </div>
        <button className="btn btn-ghost px-2" title="Delete node" onClick={onDelete}>
          <Trash2 size={15} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-4">
        <div>
          <label className="label">Name</label>
          <input
            className="input"
            value={node.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>

        {node.type === "trigger.schedule" && (
          <>
            <div>
              <label className="label">Cron (UTC)</label>
              <input
                className="input font-mono"
                value={String(p.cron ?? "")}
                onChange={(e) => setParam("cron", e.target.value)}
                placeholder="0 8 * * *"
              />
              <p className="mt-1 text-xs text-muted">
                minute hour day month weekday. e.g. <code>0 8 * * 1-5</code> = 8:00am UTC on weekdays.
              </p>
            </div>
            <div>
              <label className="label">Description</label>
              <input
                className="input"
                value={String(p.description ?? "")}
                onChange={(e) => setParam("description", e.target.value)}
                placeholder="Every weekday at 8am"
              />
            </div>
          </>
        )}

        {node.type === "trigger.event" && (
          <div>
            <label className="label">Event</label>
            <Select
              ariaLabel="Event"
              value={String(p.event ?? "")}
              onValueChange={(v) => setParam("event", v)}
              options={[
                { value: "order.create", label: "order.create" },
                { value: "order.status", label: "order.status" },
                { value: "invoice.create", label: "invoice.create" },
                { value: "payment.record", label: "payment.record" },
                { value: "product.create", label: "product.create" },
                { value: "inventory.adjust", label: "inventory.adjust" },
                { value: "purchase_order.received", label: "purchase_order.received" },
              ]}
            />
          </div>
        )}

        {node.type === "trigger.webhook" && (
          <div>
            <label className="label">Path</label>
            <input
              className="input font-mono"
              value={String(p.path ?? "")}
              onChange={(e) => setParam("path", e.target.value)}
              placeholder="new-lead"
            />
          </div>
        )}

        {node.type === "agent" && (
          <>
            <div>
              <label className="label">Instruction</label>
              <textarea
                className="input min-h-40 resize-y"
                value={String(p.instruction ?? "")}
                onChange={(e) => setParam("instruction", e.target.value)}
                placeholder="Describe the task in plain language. The agent will plan and call its attached tools. You can reference earlier results with {{ nodes.<id>.summary }}."
              />
              <p className="mt-1 text-xs text-muted">
                Attach tools to this node on the canvas (drag a Tool sub-node into its tool port). With no
                tools attached, the agent may use the full toolset.
              </p>
            </div>
            <div>
              <label className="label">Max steps</label>
              <input
                type="number"
                className="input"
                value={Number(p.maxSteps ?? 12)}
                onChange={(e) => setParam("maxSteps", Number(e.target.value) || 12)}
              />
            </div>
          </>
        )}

        {(node.type === "action" || node.type === "tool") && (
          <div>
            <label className="label">Tool</label>
            <Combobox
              ariaLabel="Tool"
              value={String(p.tool ?? "")}
              onValueChange={(v) => setParam("tool", v)}
              options={toolOptions}
              placeholder="Search tools…"
            />
            {node.type === "action" && <ActionInput value={p.input} onChange={(v) => setParam("input", v)} />}
            {p.tool ? (
              <p className="mt-1 text-xs text-muted">
                {tools.find((t) => t.name === p.tool)?.description ?? ""}
              </p>
            ) : null}
          </div>
        )}

        {node.type === "model" && (
          <div>
            <label className="label">Model id</label>
            <input
              className="input font-mono"
              value={String(p.model ?? "")}
              onChange={(e) => setParam("model", e.target.value)}
              placeholder="claude-opus-5"
            />
          </div>
        )}

        {node.type === "if" && (
          <>
            <div>
              <label className="label">Left</label>
              <input
                className="input font-mono"
                value={String(p.left ?? "")}
                onChange={(e) => setParam("left", e.target.value)}
                placeholder="{{ nodes.check.summary }}"
              />
            </div>
            <div>
              <label className="label">Operator</label>
              <Select
                ariaLabel="Operator"
                value={String(p.op ?? "truthy")}
                onValueChange={(v) => setParam("op", v as IfOp)}
                options={[
                  { value: "truthy", label: "is truthy" },
                  { value: "exists", label: "is not empty" },
                  { value: "eq", label: "equals" },
                  { value: "ne", label: "not equals" },
                  { value: "contains", label: "contains" },
                  { value: "gt", label: "greater than" },
                  { value: "lt", label: "less than" },
                  { value: "gte", label: "greater or equal" },
                  { value: "lte", label: "less or equal" },
                ]}
              />
            </div>
            {p.op !== "truthy" && p.op !== "exists" && (
              <div>
                <label className="label">Right</label>
                <input
                  className="input font-mono"
                  value={String(p.right ?? "")}
                  onChange={(e) => setParam("right", e.target.value)}
                />
              </div>
            )}
          </>
        )}

        {node.type === "transform" && (
          <Assignments
            value={(p.assignments as { key: string; value: string }[]) ?? []}
            onChange={(v) => setParam("assignments", v)}
          />
        )}
      </div>
    </div>
  );
}

function ActionInput({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mt-3">
      <label className="label">Input (JSON)</label>
      <textarea
        className="input min-h-28 resize-y font-mono text-xs"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(e.target.value.trim() ? JSON.parse(e.target.value) : {});
            setErr(null);
          } catch {
            setErr("Invalid JSON");
          }
        }}
      />
      {err && <p className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  );
}

function Assignments({
  value,
  onChange,
}: {
  value: { key: string; value: string }[];
  onChange: (v: { key: string; value: string }[]) => void;
}) {
  return (
    <div>
      <label className="label">Assignments</label>
      <div className="space-y-2">
        {value.map((a, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="input"
              placeholder="key"
              value={a.key}
              onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
            />
            <input
              className="input font-mono"
              placeholder="value or {{ ref }}"
              value={a.value}
              onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
            />
            <button
              className="btn btn-ghost px-2"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button className="btn btn-outline mt-2 text-xs" onClick={() => onChange([...value, { key: "", value: "" }])}>
        Add assignment
      </button>
    </div>
  );
}
