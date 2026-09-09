"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Bot,
  Boxes,
  Brain,
  CheckCircle2,
  Clock,
  GitBranch,
  Globe,
  Loader2,
  MousePointerClick,
  PenLine,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NodeType } from "@/lib/harness/graph/types";
import type { RFNodeData } from "@/lib/harness/graph/reactflow";

const ICON: Record<NodeType, LucideIcon> = {
  "trigger.manual": MousePointerClick,
  "trigger.schedule": Clock,
  "trigger.webhook": Globe,
  "trigger.event": Zap,
  agent: Bot,
  action: Boxes,
  if: GitBranch,
  transform: PenLine,
  tool: Wrench,
  model: Brain,
  memory: Brain,
};

function subtitle(type: NodeType, params: Record<string, unknown>): string {
  const p = params as Record<string, string | undefined>;
  switch (type) {
    case "trigger.schedule":
      return p.description || p.cron || "No schedule set";
    case "trigger.event":
      return p.event || "No event";
    case "trigger.webhook":
      return p.path ? `/${p.path}` : "Auto URL";
    case "trigger.manual":
      return "Run on demand";
    case "agent":
      return p.instruction ? p.instruction.slice(0, 80) : "No instruction yet";
    case "action":
      return p.tool || "No tool selected";
    case "tool":
      return p.tool || "No tool selected";
    case "model":
      return p.model || "Default model";
    case "if":
      return `${p.left || "?"} ${p.op || "truthy"} ${p.right ?? ""}`.trim();
    default:
      return "";
  }
}

function RunBadge({ status }: { status: string | undefined }) {
  if (status === "success")
    return <CheckCircle2 size={13} style={{ color: "var(--color-accent)" }} />;
  if (status === "error") return <XCircle size={13} style={{ color: "var(--color-danger)" }} />;
  if (status === "running") return <Loader2 size={13} className="animate-spin text-muted" />;
  return null;
}

const handleStyle = {
  width: 9,
  height: 9,
  background: "var(--color-surface)",
  border: "1.5px solid var(--color-border)",
};

export function AutomationNode({ data, selected }: NodeProps) {
  const { node, run } = data as unknown as RFNodeData;
  const Icon = ICON[node.type] ?? Boxes;
  const isTrigger = node.type.startsWith("trigger.");
  const isSub = node.type === "tool" || node.type === "model" || node.type === "memory";
  const isAgent = node.type === "agent";
  const isIf = node.type === "if";

  const tone = isTrigger
    ? "var(--color-accent)"
    : isSub
      ? "var(--color-muted)"
      : "var(--color-fg)";

  return (
    <div
      className="rounded-xl border bg-surface px-3 py-2.5 shadow-sm transition-shadow"
      style={{
        minWidth: isSub ? 150 : 210,
        borderColor: selected ? "var(--color-accent)" : "var(--color-border)",
        boxShadow: selected ? "0 0 0 2px color-mix(in srgb, var(--color-accent) 30%, transparent)" : undefined,
      }}
    >
      {/* Inputs */}
      {!isTrigger && !isSub && (
        <Handle type="target" position={Position.Left} id="in" style={handleStyle} />
      )}
      {isSub && <Handle type="source" position={Position.Top} id="out" style={handleStyle} />}

      <div className="flex items-center gap-2">
        <Icon size={15} style={{ color: tone }} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{node.name}</span>
        {run && <RunBadge status={run.status} />}
      </div>
      <div className="mt-0.5 truncate text-xs text-muted" title={subtitle(node.type, node.params)}>
        {subtitle(node.type, node.params)}
      </div>

      {/* Agent sub-node ports along the bottom */}
      {isAgent && (
        <div className="mt-2 flex items-center justify-around gap-1 border-t pt-1.5 text-[9px] uppercase tracking-wide text-muted">
          {(["ai_tool", "ai_model", "ai_memory"] as const).map((kind) => (
            <div key={kind} className="relative flex-1 text-center">
              {kind.replace("ai_", "")}
              <Handle
                type="target"
                position={Position.Bottom}
                id={kind}
                style={{ ...handleStyle, left: "50%" }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Outputs */}
      {!isSub && !isIf && (
        <Handle type="source" position={Position.Right} id="main-0" style={handleStyle} />
      )}
      {isIf && (
        <>
          <div className="absolute right-1 top-2 text-[9px] font-medium" style={{ color: "var(--color-accent)" }}>
            T
          </div>
          <div className="absolute right-1 bottom-2 text-[9px] font-medium text-muted">F</div>
          <Handle type="source" position={Position.Right} id="main-0" style={{ ...handleStyle, top: "38%" }} />
          <Handle type="source" position={Position.Right} id="main-1" style={{ ...handleStyle, top: "70%" }} />
        </>
      )}
    </div>
  );
}
