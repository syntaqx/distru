"use client";

import { useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "What are my top categories and how much stock do I have?",
  "Which products are lowest on stock?",
  "Add a new product to the catalog",
  "Import a CSV of products or customers",
];

function ask(text: string) {
  const t = text.trim();
  if (!t) return;
  window.dispatchEvent(new CustomEvent("distru:copilot:open"));
  window.dispatchEvent(new CustomEvent("distru:copilot:prompt", { detail: { text: t } }));
}

export function CopilotHero({ firstName }: { firstName: string }) {
  const [value, setValue] = useState("");

  return (
    <div className="mb-10 flex flex-col items-center pt-4 text-center">
      <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-muted">
        <Sparkles size={13} style={{ color: "var(--color-accent)" }} />
        Distru Copilot
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">
        What can I help you run today, {firstName}?
      </h1>

      <form
        className="mt-6 w-full max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          ask(value);
          setValue("");
        }}
      >
        <div className="relative">
          <Sparkles size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input h-12 rounded-xl pl-11 pr-12 text-sm"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ask about your catalog, make a change, or import a file..."
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="btn btn-primary absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-lg p-0 disabled:opacity-40"
            aria-label="Ask the Copilot"
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            className="rounded-full border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface2 hover:text-fg"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
