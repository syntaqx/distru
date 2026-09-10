"use client";

import { useEffect, useState } from "react";

function isDark() {
  const root = document.documentElement;
  return (
    root.dataset.theme === "dark" ||
    (!root.dataset.theme &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

/**
 * Render a mermaid diagram client-side from its source. Streamdown's own mermaid
 * path relies on a renderer that is never populated by default, so we drive the
 * mermaid package directly and theme it from the app's own palette tokens, so it
 * has real contrast in both light and dark. Falls back to the source on error.
 */
export function MermaidDiagram({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [themeKey, setThemeKey] = useState(0);

  // Re-render when the app theme flips (toggle or OS change).
  useEffect(() => {
    const bump = () => setThemeKey((k) => k + 1);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", bump);
    const obs = new MutationObserver(bump);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      mq.removeEventListener("change", bump);
      obs.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        const cs = getComputedStyle(document.documentElement);
        const dark = isDark();
        const t = (name: string, fallback: string) =>
          cs.getPropertyValue(name).trim() || fallback;
        const surface = t("--color-surface", dark ? "#121615" : "#ffffff");
        const surface2 = t("--color-surface2", dark ? "#1b2320" : "#eef3f0");
        const fg = t("--color-fg", dark ? "#e8efec" : "#16211d");
        const muted = t("--color-muted", dark ? "#8aa0a8" : "#5c7a86");
        const accent = t("--color-accent", dark ? "#3fb890" : "#0e7c66");
        const border = t("--color-border", dark ? "#28322e" : "#dce4e0");

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          // Never let mermaid inject its own "Syntax error" graphic into the
          // document body - we catch failures and render them inline instead.
          suppressErrorRendering: true,
          theme: "base",
          fontFamily: "inherit",
          themeVariables: {
            background: surface,
            primaryColor: surface2,
            primaryBorderColor: accent,
            primaryTextColor: fg,
            secondaryColor: surface2,
            tertiaryColor: surface,
            mainBkg: surface2,
            nodeBorder: accent,
            nodeTextColor: fg,
            lineColor: muted,
            textColor: fg,
            // sequence-diagram specifics
            actorBkg: surface2,
            actorBorder: accent,
            actorTextColor: fg,
            actorLineColor: border,
            signalColor: fg,
            signalTextColor: fg,
            labelBoxBkgColor: surface2,
            labelBoxBorderColor: border,
            labelTextColor: fg,
            loopTextColor: fg,
            noteBkgColor: surface2,
            noteTextColor: fg,
            noteBorderColor: border,
            sequenceNumberColor: surface,
          },
        });
        const id = "m" + Math.random().toString(36).slice(2);
        try {
          // Validate first; on invalid syntax this throws with a useful message
          // and we never call render (so nothing is injected into the DOM).
          await mermaid.parse(chart);
          const { svg } = await mermaid.render(id, chart);
          if (!cancelled) {
            setSvg(svg);
            setFailed(false);
            setErrorMsg(null);
          }
        } finally {
          // Belt-and-suspenders: remove any stray node mermaid may have left.
          document.getElementById(id)?.remove();
          document.getElementById("d" + id)?.remove();
        }
      } catch (err) {
        if (!cancelled) {
          setFailed(true);
          setSvg(null);
          setErrorMsg(err instanceof Error ? err.message : "Invalid diagram syntax.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, themeKey]);

  if (svg) {
    return (
      <div
        className="doc-mermaid"
        // svg is produced by mermaid in strict (sanitized) mode from our own source
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
  if (failed) {
    // Show the error right where the diagram would be, with the source, so a
    // broken diagram is easy to find and fix - and it never escapes the shell.
    return (
      <div className="doc-mermaid-error">
        <div className="doc-mermaid-error-head">⚠ Diagram failed to render</div>
        {errorMsg && <div className="doc-mermaid-error-msg">{errorMsg}</div>}
        <pre>
          <code>{chart}</code>
        </pre>
      </div>
    );
  }
  return (
    <pre className="doc-shiki" aria-busy>
      <code>{chart}</code>
    </pre>
  );
}
