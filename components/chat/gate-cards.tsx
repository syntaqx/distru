"use client";

import { useState } from "react";
import { Check, HelpCircle, ShieldAlert, X } from "lucide-react";
import type { Interrupt, ToolDecision } from "@/lib/harness/types";

export function GateCard({
  interrupt,
  decided,
  onDecide,
}: {
  interrupt: Interrupt;
  decided?: ToolDecision;
  onDecide: (d: ToolDecision) => void;
}) {
  const p = interrupt.preview;
  if (p.kind === "question") {
    return (
      <QuestionCard interrupt={interrupt} decided={decided} onDecide={onDecide} />
    );
  }
  const riskColor =
    p.risk === "high"
      ? "var(--color-danger)"
      : p.risk === "low"
        ? "var(--color-muted)"
        : "var(--color-warn)";
  return (
    <div className="card border-l-2" style={{ borderLeftColor: riskColor }}>
      <div className="flex items-center gap-2">
        <span className="badge" style={{ color: riskColor }}>
          <ShieldAlert size={13} /> Confirm
        </span>
        <span className="text-sm font-medium">{p.title}</span>
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{p.summary}</p>
      {p.fields.length > 0 && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {p.fields.map((f, i) => (
            <div key={i} className="contents">
              <dt className="text-[var(--color-muted)]">{f.label}</dt>
              <dd className="font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {decided ? (
        <div className="mt-3 text-sm" style={{ color: decided.decision === "approve" ? "var(--color-accent)" : "var(--color-muted)" }}>
          {decided.decision === "approve" ? "✓ Approved" : "✕ Rejected"}
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            className="btn btn-primary text-sm"
            onClick={() => onDecide({ toolUseId: interrupt.toolUseId, decision: "approve" })}
          >
            <Check size={15} /> Approve
          </button>
          <button
            className="btn btn-outline text-sm"
            onClick={() => onDecide({ toolUseId: interrupt.toolUseId, decision: "reject" })}
          >
            <X size={15} /> Reject
          </button>
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  interrupt,
  decided,
  onDecide,
}: {
  interrupt: Interrupt;
  decided?: ToolDecision;
  onDecide: (d: ToolDecision) => void;
}) {
  const p = interrupt.preview;
  const [text, setText] = useState("");
  if (p.kind !== "question") return null;

  return (
    <div className="card border-l-2" style={{ borderLeftColor: "var(--color-info)" }}>
      <div className="flex items-center gap-2">
        <span className="badge" style={{ color: "var(--color-info)" }}>
          <HelpCircle size={13} /> Question
        </span>
      </div>
      <p className="mt-1 text-sm font-medium">{p.question}</p>
      {decided ? (
        <div className="mt-2 text-sm text-[var(--color-accent)]">
          ✓ {decided.decision === "answer" ? decided.value : "Answered"}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {p.options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {p.options.map((o) => (
                <button
                  key={o.value}
                  className="btn btn-outline text-sm"
                  title={o.description}
                  onClick={() =>
                    onDecide({ toolUseId: interrupt.toolUseId, decision: "answer", value: o.value })
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {p.allowFreeText && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim())
                  onDecide({ toolUseId: interrupt.toolUseId, decision: "answer", value: text.trim() });
              }}
            >
              <input
                className="input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type your answer…"
              />
              <button className="btn btn-primary text-sm">Send</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
