"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  type Connection,
  type Edge,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { Braces, Check, Copy, LayoutGrid, Loader2, Play, Plus, Save, Sparkles, X } from "lucide-react";
import { NODE_CATALOG } from "@/lib/harness/graph/catalog";
import { fromReactFlow, toReactFlow, type RFNodeData } from "@/lib/harness/graph/reactflow";
import { normalizeGraph, validateGraph } from "@/lib/harness/graph/validate";
import type { NodeType, WorkflowGraph } from "@/lib/harness/graph/types";
import { AutomationNode } from "./graph-nodes";
import { NodeConfig, type ToolMeta } from "./node-config";

function ModeToggle({
  mode,
  onVisual,
  onJson,
}: {
  mode: "visual" | "json";
  onVisual: () => void;
  onJson: () => void;
}) {
  const cls = (active: boolean) =>
    `flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
      active ? "text-fg" : "text-muted hover:text-fg"
    }`;
  return (
    <div className="flex items-center gap-0.5">
      <button onClick={onVisual} className={cls(mode === "visual")} style={mode === "visual" ? { background: "var(--color-surface2)" } : undefined}>
        <LayoutGrid size={13} /> Visual
      </button>
      <button onClick={onJson} className={cls(mode === "json")} style={mode === "json" ? { background: "var(--color-surface2)" } : undefined}>
        <Braces size={13} /> JSON
      </button>
    </div>
  );
}

function Canvas({
  workflowId,
  initialGraph,
  tools,
  onRunComplete,
}: {
  workflowId: string;
  initialGraph: WorkflowGraph;
  tools: ToolMeta[];
  onRunComplete?: () => void;
}) {
  const init = useMemo(() => toReactFlow(initialGraph), [initialGraph]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<RFNodeData>>(init.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(init.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [mode, setMode] = useState<"visual" | "json">("visual");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { screenToFlowPosition } = useReactFlow();
  const paletteRef = useRef<HTMLDivElement>(null);

  const nodeTypes = useMemo(() => ({ automation: AutomationNode }), []);

  const markDirty = useCallback(() => {
    setDirty(true);
    setSavedAt(null);
  }, []);

  const currentGraph = useCallback(
    () => fromReactFlow(nodes, edges),
    [nodes, edges],
  );

  const issues = useMemo(() => validateGraph(fromReactFlow(nodes, edges)), [nodes, edges]);
  const errorCount = issues.filter((i) => i.level === "error").length;

  // --- Advanced (JSON) mode: edit the canonical graph directly, for copy-paste
  // sharing. Entering serializes the current canvas; Apply parses it back. ---
  const enterJson = useCallback(() => {
    setJsonText(JSON.stringify(currentGraph(), null, 2));
    setJsonError(null);
    setMode("json");
  }, [currentGraph]);

  const applyJson = useCallback((): boolean => {
    try {
      const g = normalizeGraph(JSON.parse(jsonText));
      const rf = toReactFlow(g);
      setNodes(rf.nodes);
      setEdges(rf.edges);
      setSelectedId(null);
      markDirty();
      setJsonError(null);
      return true;
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "Invalid JSON");
      return false;
    }
  }, [jsonText, setNodes, setEdges, markDirty]);

  const copyJson = useCallback(() => {
    void navigator.clipboard?.writeText(jsonText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [jsonText]);

  const onConnect = useCallback(
    (c: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...c,
            animated: (c.targetHandle ?? "").startsWith("ai_"),
            style: (c.targetHandle ?? "").startsWith("ai_") ? { strokeDasharray: "4 4" } : undefined,
          },
          eds,
        ),
      );
      markDirty();
    },
    [setEdges, markDirty],
  );

  const isValidConnection = useCallback(
    (c: Connection | Edge) => {
      const src = nodes.find((n) => n.id === c.source);
      const isSub = (t?: NodeType) => t === "tool" || t === "model" || t === "memory";
      const th = c.targetHandle ?? "";
      // ai_* ports accept only their matching sub-node type; the main flow rejects sub-nodes.
      if (th.startsWith("ai_")) return isSub(src?.data.node.type) && src?.data.node.type === th.replace("ai_", "");
      return !isSub(src?.data.node.type);
    },
    [nodes],
  );

  const addNode = useCallback(
    (type: NodeType) => {
      const spec = NODE_CATALOG.find((s) => s.type === type)!;
      const center = screenToFlowPosition({
        x: (paletteRef.current?.getBoundingClientRect().right ?? 300) + 220,
        y: 200,
      });
      const id = crypto.randomUUID();
      const newNode: Node<RFNodeData> = {
        id,
        type: "automation",
        position: { x: center.x + Math.random() * 40, y: center.y + Math.random() * 40 },
        data: {
          node: { id, type, name: spec.label, params: { ...spec.defaults }, position: { x: 0, y: 0 } },
        },
      };
      setNodes((ns) => ns.concat(newNode));
      setSelectedId(id);
      markDirty();
    },
    [screenToFlowPosition, setNodes, markDirty],
  );

  const patchNode = useCallback(
    (id: string, patch: { name?: string; params?: Record<string, unknown> }) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  node: {
                    ...n.data.node,
                    ...(patch.name !== undefined ? { name: patch.name } : {}),
                    ...(patch.params !== undefined ? { params: patch.params } : {}),
                  },
                },
              }
            : n,
        ),
      );
      markDirty();
    },
    [setNodes, markDirty],
  );

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedId((s) => (s === id ? null : s));
      markDirty();
    },
    [setNodes, setEdges, markDirty],
  );

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graph: currentGraph() }),
      });
      if (res.ok) {
        setDirty(false);
        setSavedAt(new Date().toISOString());
      }
    } finally {
      setSaving(false);
    }
  }, [workflowId, currentGraph]);

  const applyRuns = useCallback(async () => {
    const res = await fetch(`/api/workflows/${workflowId}`);
    if (!res.ok) return;
    const { runs } = (await res.json()) as { runs: { nodeRuns?: RFNodeData["run"][] }[] };
    const latest = runs?.[0];
    const byId = new Map((latest?.nodeRuns ?? []).filter(Boolean).map((r) => [r!.nodeId, r!]));
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, run: byId.get(n.id) ?? null } })));
  }, [workflowId, setNodes]);

  const run = useCallback(async () => {
    if (dirty) await save();
    setRunning(true);
    try {
      await fetch(`/api/workflows/${workflowId}/run`, { method: "POST" });
      await applyRuns();
      onRunComplete?.();
    } finally {
      setRunning(false);
    }
  }, [dirty, save, workflowId, applyRuns, onRunComplete]);

  const selected = nodes.find((n) => n.id === selectedId)?.data.node ?? null;

  if (mode === "json") {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b p-2">
          <ModeToggle mode="json" onVisual={() => applyJson() && setMode("visual")} onJson={enterJson} />
          <span className="hidden text-xs text-muted sm:inline">
            Canonical graph JSON - edit it, or copy to share an automation.
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn btn-ghost text-xs" onClick={copyJson}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
            </button>
            <button className="btn btn-outline text-xs" onClick={() => applyJson()}>
              Apply to canvas
            </button>
            <button
              className="btn btn-primary text-xs"
              disabled={saving}
              onClick={async () => {
                if (applyJson()) await save();
              }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
            </button>
          </div>
        </div>
        {jsonError && <div className="border-b px-3 py-1.5 text-xs text-danger">{jsonError}</div>}
        <textarea
          className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-xs outline-none"
          spellCheck={false}
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            setJsonError(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0">
      {/* Palette */}
      <div ref={paletteRef} className="w-44 shrink-0 overflow-auto border-r p-2">
        {(["Triggers", "Steps", "Sub-nodes"] as const).map((group) => (
          <div key={group} className="mb-3">
            <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {group}
            </div>
            {NODE_CATALOG.filter((s) => s.group === group).map((s) => (
              <button
                key={s.type}
                onClick={() => addNode(s.type)}
                title={s.description}
                className="mb-0.5 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs text-muted transition-colors hover:bg-surface2 hover:text-fg"
              >
                <Plus size={12} className="shrink-0" /> {s.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div className="relative min-w-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={(c) => {
            onNodesChange(c);
            if (c.some((x) => x.type === "position" && x.dragging === false)) markDirty();
          }}
          onEdgesChange={(c) => {
            onEdgesChange(c);
            if (c.some((x) => x.type === "remove")) markDirty();
          }}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onPaneClick={() => setSelectedId(null)}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} color="var(--color-border)" />
          <Controls showInteractive={false} />
        </ReactFlow>

        {/* Toolbar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 p-3">
          <div className="pointer-events-auto rounded-xl border bg-surface p-1 shadow-sm">
            <ModeToggle mode="visual" onVisual={() => {}} onJson={enterJson} />
          </div>
          <div className="pointer-events-auto ml-auto flex items-center gap-2 rounded-xl border bg-surface p-1.5 shadow-sm">
            {errorCount > 0 ? (
              <span className="px-2 text-xs text-danger">{errorCount} issue{errorCount === 1 ? "" : "s"}</span>
            ) : savedAt ? (
              <span className="px-2 text-xs text-muted">Saved</span>
            ) : dirty ? (
              <span className="px-2 text-xs text-muted">Unsaved</span>
            ) : null}
            <button className="btn btn-ghost text-xs" onClick={() => setGenOpen(true)}>
              <Sparkles size={14} /> Generate
            </button>
            <button className="btn btn-outline text-xs" disabled={saving || !dirty} onClick={save}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
            </button>
            <button className="btn btn-primary text-xs" disabled={running || errorCount > 0} onClick={run}>
              {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run
            </button>
          </div>
        </div>
      </div>

      {/* Config panel */}
      {selected && (
        <div className="w-80 shrink-0 border-l bg-surface">
          <NodeConfig
            key={selected.id}
            node={selected}
            tools={tools}
            onChange={(patch) => patchNode(selected.id, patch)}
            onDelete={() => deleteNode(selected.id)}
          />
        </div>
      )}

      {genOpen && (
        <GenerateModal
          onClose={() => setGenOpen(false)}
          onGenerated={(graph) => {
            const rf = toReactFlow(graph);
            setNodes(rf.nodes);
            setEdges(rf.edges);
            setSelectedId(null);
            markDirty();
            setGenOpen(false);
          }}
        />
      )}
    </div>
  );
}

function GenerateModal({
  onClose,
  onGenerated,
}: {
  onClose: () => void;
  onGenerated: (g: WorkflowGraph) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    if (!prompt.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/workflows/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = (await res.json()) as { graph?: WorkflowGraph; error?: string };
      if (!res.ok || !data.graph) {
        setError(data.error ?? "Could not generate a workflow.");
        return;
      }
      onGenerated(data.graph);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-full max-w-lg rounded-xl border shadow-xl" style={{ background: "var(--color-surface)" }}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={15} /> Generate a workflow
          </h2>
          <button className="btn btn-ghost px-2" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="p-4">
          <textarea
            className="input min-h-28 resize-y"
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the automation in plain language. e.g. 'Every weekday at 8am, find products below 25 units and draft purchase orders to their default vendor, then post a summary.'"
          />
          <p className="mt-1 text-xs text-muted">
            The AI drafts a node graph you can edit. Replaces the current canvas.
          </p>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={go} disabled={busy || !prompt.trim()}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Generate
          </button>
        </div>
      </div>
    </div>
  );
}

export function GraphEditor(props: {
  workflowId: string;
  initialGraph: WorkflowGraph;
  tools: ToolMeta[];
  onRunComplete?: () => void;
}) {
  const [tools, setTools] = useState<ToolMeta[]>(props.tools);
  useEffect(() => {
    if (props.tools.length) return;
    fetch("/api/harness/tools")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.tools && setTools(d.tools))
      .catch(() => {});
  }, [props.tools]);

  return (
    <ReactFlowProvider>
      <Canvas {...props} tools={tools} />
    </ReactFlowProvider>
  );
}
