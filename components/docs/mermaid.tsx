"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Expand, Maximize2, Minus, Plus } from "lucide-react";

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
    return <MermaidViewer svg={svg} />;
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

/**
 * A pan/zoom viewport for a rendered mermaid SVG. Dense diagrams were being
 * squeezed to container width (labels overlapping / "stacked"); here the SVG is
 * shown at its natural size inside a fixed-height, clipped viewport that you can
 * drag to pan, wheel/buttons to zoom, fit-to-width, and open fullscreen.
 */
function MermaidViewer({ svg }: { svg: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const natural = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const clampScale = (s: number) => Math.min(4, Math.max(0.2, s));

  const fit = useCallback(() => {
    const viewport = viewportRef.current;
    const { w, h } = natural.current;
    if (!viewport || !w) return;
    const pad = 24;
    const vw = viewport.clientWidth - pad;
    const vh = viewport.clientHeight - pad;
    const s = Math.min(vw / w, vh / h, 1.5) || 1;
    setScale(s);
    setTx((viewport.clientWidth - w * s) / 2);
    setTy((viewport.clientHeight - h * s) / 2);
  }, []);

  // Prep the freshly-injected SVG: read its natural size, drop mermaid's inline
  // max-width, then fit it to the viewport.
  useEffect(() => {
    const el = contentRef.current?.querySelector("svg");
    const viewport = viewportRef.current;
    if (!el || !viewport) return;
    let w = 0;
    let h = 0;
    const vb = el.getAttribute("viewBox");
    if (vb) {
      const p = vb.split(/[\s,]+/).map(Number);
      w = p[2];
      h = p[3];
    }
    if (!w || !h) {
      const r = el.getBoundingClientRect();
      w = r.width;
      h = r.height;
    }
    natural.current = { w, h };
    el.removeAttribute("style");
    el.setAttribute("width", String(w));
    el.setAttribute("height", String(h));
    fit();
  }, [svg, fit]);

  const zoomBy = useCallback((factor: number, cx?: number, cy?: number) => {
    setScale((prev) => {
      const next = clampScale(prev * factor);
      const ratio = next / prev;
      if (cx != null && cy != null) {
        setTx((p) => cx - (cx - p) * ratio);
        setTy((p) => cy - (cy - p) * ratio);
      }
      return next;
    });
  }, []);

  // Native non-passive wheel listener so we can zoom without scrolling the page.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      zoomBy(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - r.left, e.clientY - r.top);
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  const toggleFullscreen = () => {
    const vp = viewportRef.current;
    if (!vp) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else vp.requestFullscreen?.().then(fit).catch(() => {});
  };

  return (
    <div
      ref={viewportRef}
      className="doc-mermaid-viewer"
      role="group"
      aria-label="Diagram — drag to pan, scroll or use the buttons to zoom"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY, tx, ty };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        setTx(drag.current.tx + (e.clientX - drag.current.x));
        setTy(drag.current.ty + (e.clientY - drag.current.y));
      }}
      onPointerUp={(e) => {
        drag.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onDoubleClick={fit}
    >
      <div
        ref={contentRef}
        className="doc-mermaid-content"
        style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
        // svg is produced by mermaid in strict (sanitized) mode from our own source
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="doc-mermaid-controls">
        <button type="button" onClick={() => zoomBy(0.83)} aria-label="Zoom out" title="Zoom out">
          <Minus size={15} />
        </button>
        <button type="button" onClick={fit} aria-label="Fit to view" title="Fit to view">
          <Maximize2 size={14} />
        </button>
        <button type="button" onClick={() => zoomBy(1.2)} aria-label="Zoom in" title="Zoom in">
          <Plus size={15} />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label="Fullscreen"
          title="Fullscreen"
        >
          <Expand size={14} />
        </button>
      </div>
      <div className="doc-mermaid-hint">Drag to pan · scroll to zoom · double-click to fit</div>
    </div>
  );
}
