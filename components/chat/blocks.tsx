"use client";

import { useState } from "react";
import { Streamdown } from "streamdown";
import {
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleX,
  Download,
  Loader,
} from "lucide-react";

export type ChatBlock =
  | { type: "user"; text: string }
  | { type: "assistant"; text: string }
  | { type: "thinking"; text: string }
  | {
      type: "tool";
      toolUseId: string;
      name: string;
      status: string;
      ok?: boolean | null;
      summary?: string | null;
      data?: unknown;
    };

const TOOL_LABELS: Record<string, string> = {
  search_products: "Searched products",
  get_product: "Looked up product",
  list_categories: "Listed categories",
  list_vendors: "Listed vendors",
  list_locations: "Listed locations",
  inventory_report: "Inventory report",
  create_product: "Create product",
  update_product: "Update product",
  archive_product: "Archive product",
  adjust_inventory: "Adjust inventory",
  set_on_hand: "Set on-hand",
  create_category: "Create category",
  create_vendor: "Create company",
  propose_column_mapping: "Proposed column mapping",
  set_column_mapping: "Updated mapping",
  validate_import: "Validated import",
  commit_import: "Committed import",
  get_error_report: "Error report",
  ask_user: "Asked a question",
};

const toolLabel = (name: string) => TOOL_LABELS[name] ?? name;

export function ToolBlock({ block }: { block: Extract<ChatBlock, { type: "tool" }> }) {
  const [open, setOpen] = useState(false);
  const running = block.status === "running" || block.status === "pending";
  const failed = block.ok === false || block.status === "error";
  const data = block.data as { errorReportUrl?: string | null } | null | undefined;

  const StatusIcon = running ? Loader : failed ? CircleX : CircleCheck;
  const statusColor = running
    ? "var(--color-warn)"
    : failed
      ? "var(--color-danger)"
      : "var(--color-accent)";

  return (
    <div className="rounded-lg border px-3 py-2 text-sm" style={{ background: "var(--color-surface)" }}>
      <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
        <StatusIcon
          size={15}
          style={{ color: statusColor }}
          className={running ? "animate-spin" : ""}
        />
        <span className="font-medium">{toolLabel(block.name)}</span>
        {block.summary && (
          <span className="truncate text-[var(--color-muted)]">- {block.summary}</span>
        )}
        <span className="ml-auto text-[var(--color-muted)]">
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>
      </button>
      {data?.errorReportUrl && (
        <a
          href={data.errorReportUrl}
          className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
        >
          <Download size={13} /> Download error CSV
        </a>
      )}
      {open && (
        <pre
          className="mt-2 max-h-64 overflow-auto rounded-md border p-2 text-xs text-[var(--color-muted)]"
          style={{ background: "var(--color-bg)" }}
        >
          {JSON.stringify(block.data ?? {}, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;
  return (
    <div className="text-xs">
      <button
        className="flex items-center gap-1 text-[var(--color-muted)] hover:underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {open ? "Hide reasoning" : "Show reasoning"}
      </button>
      {open && (
        <p className="mt-1 whitespace-pre-wrap border-l pl-3 italic text-[var(--color-muted)]">{text}</p>
      )}
    </div>
  );
}

export function ThinkingDots({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
      <span className="inline-flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-bounce rounded-full"
            style={{ background: "var(--color-accent)", animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      {label}
    </div>
  );
}

export function BlockView({ block }: { block: ChatBlock }) {
  if (block.type === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm px-4 py-2 text-sm"
          style={{ background: "var(--color-surface2)" }}
        >
          {block.text.split("\n\n[System:")[0]}
        </div>
      </div>
    );
  }
  if (block.type === "assistant") {
    return (
      <div className="copilot-md max-w-[85%] text-sm leading-relaxed">
        <Streamdown shikiTheme={["github-light", "github-dark"]}>{block.text}</Streamdown>
      </div>
    );
  }
  if (block.type === "thinking") return <ThinkingBlock text={block.text} />;
  return <ToolBlock block={block} />;
}
