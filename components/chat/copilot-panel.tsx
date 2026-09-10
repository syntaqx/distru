"use client";

import { useEffect, useRef, useState } from "react";
import { ChatView } from "./chat-view";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const MIN_W = 320;
const MIN_H = 360;
const MARGIN = 8;
const STORE_KEY = "copilot.frame.v1";

type Frame = { x: number; y: number; w: number; h: number };
type Dir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** The eight resize handles: edges (thin strips) + corners (small squares). */
const HANDLES: { dir: Dir; className: string; cursor: string }[] = [
  { dir: "n", className: "left-2 right-2 top-0 h-1.5", cursor: "ns-resize" },
  { dir: "s", className: "left-2 right-2 bottom-0 h-1.5", cursor: "ns-resize" },
  { dir: "e", className: "top-2 bottom-2 right-0 w-1.5", cursor: "ew-resize" },
  { dir: "w", className: "top-2 bottom-2 left-0 w-1.5", cursor: "ew-resize" },
  { dir: "nw", className: "left-0 top-0 h-3 w-3", cursor: "nwse-resize" },
  { dir: "se", className: "right-0 bottom-0 h-3 w-3", cursor: "nwse-resize" },
  { dir: "ne", className: "right-0 top-0 h-3 w-3", cursor: "nesw-resize" },
  { dir: "sw", className: "left-0 bottom-0 h-3 w-3", cursor: "nesw-resize" },
];

/**
 * A floating, draggable, freely-resizable Copilot window (GitHub Copilot style)
 * that hovers over the page rather than pushing it. Drag by the header; drag any
 * edge or corner to resize; the header button maximizes/restores; ⌘/Ctrl+J or the
 * top-right trigger toggles it. Size + position persist to localStorage, and it
 * stays mounted (hidden) so chat state survives open/close.
 */
export function CopilotPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [frame, setFrame] = useState<Frame | null>(null);
  const [maximized, setMaximized] = useState(false);
  const restore = useRef<Frame | null>(null);
  const gesture = useRef<{ mode: "move" | Dir; sx: number; sy: number; start: Frame } | null>(null);
  // Reopening starts a fresh chat (like claude.ai): bump a key on each
  // closed -> open transition so ChatView remounts new instead of continuing the
  // previous thread. History stays reachable via the History view.
  const [chatKey, setChatKey] = useState(0);
  const prevOpen = useRef(open);
  useEffect(() => {
    if (open && !prevOpen.current) setChatKey((k) => k + 1);
    prevOpen.current = open;
  }, [open]);

  // Initial frame: restore a saved one (clamped on-screen), else bottom-right.
  useEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let f: Frame | null = null;
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) f = JSON.parse(saved) as Frame;
    } catch {
      /* ignore unreadable storage */
    }
    if (!f || typeof f.w !== "number") {
      f = { w: 400, h: 620, x: 0, y: 0 };
      f.x = vw - f.w - 24;
      f.y = Math.max(72, vh - f.h - 24);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrame(onScreen(f, vw, vh));
  }, []);

  // Persist frame changes; keep it on-screen when the viewport resizes.
  useEffect(() => {
    if (!frame || maximized) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(frame));
    } catch {
      /* ignore unwritable storage */
    }
  }, [frame, maximized]);

  useEffect(() => {
    const onResize = () =>
      setFrame((f) => (f ? onScreen(f, window.innerWidth, window.innerHeight) : f));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function onScreen(f: Frame, vw: number, vh: number): Frame {
    const w = clamp(f.w, MIN_W, vw - MARGIN * 2);
    const h = clamp(f.h, MIN_H, vh - MARGIN * 2);
    return {
      w,
      h,
      x: clamp(f.x, MARGIN, vw - w - MARGIN),
      y: clamp(f.y, MARGIN, vh - h - MARGIN),
    };
  }

  function beginGesture(mode: "move" | Dir, e: React.PointerEvent) {
    if (!frame) return;
    e.preventDefault();
    // Tearing off (drag or resize) from maximized starts at the full-size rect,
    // so it restores to a real frame instead of snapping back to the old size.
    const start = maximized
      ? { x: MARGIN, y: MARGIN, w: window.innerWidth - MARGIN * 2, h: window.innerHeight - MARGIN * 2 }
      : frame;
    if (maximized) setMaximized(false);
    gesture.current = { mode, sx: e.clientX, sy: e.clientY, start };
    const move = (ev: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      const dx = ev.clientX - g.sx;
      const dy = ev.clientY - g.sy;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (g.mode === "move") {
        setFrame(onScreen({ ...g.start, x: g.start.x + dx, y: g.start.y + dy }, vw, vh));
      } else {
        setFrame(resizeFrame(g.start, g.mode, dx, dy, vw, vh));
      }
    };
    const up = () => {
      gesture.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function toggleMax() {
    if (maximized) {
      setMaximized(false);
      if (restore.current) setFrame(restore.current);
    } else {
      restore.current = frame;
      setMaximized(true);
    }
  }

  const view: Frame | null = maximized
    ? {
        x: MARGIN,
        y: MARGIN,
        w: (typeof window !== "undefined" ? window.innerWidth : 1200) - MARGIN * 2,
        h: (typeof window !== "undefined" ? window.innerHeight : 900) - MARGIN * 2,
      }
    : frame;

  return (
    <div
      className="fixed z-50 flex flex-col overflow-hidden rounded-xl border shadow-2xl"
      style={{
        display: open ? "flex" : "none",
        left: view?.x ?? undefined,
        top: view?.y ?? undefined,
        right: view ? undefined : 24,
        bottom: view ? undefined : 24,
        width: view?.w ?? 400,
        height: view?.h ?? 620,
        maxWidth: "calc(100vw - 16px)",
        maxHeight: "calc(100dvh - 16px)",
        background: "var(--color-surface)",
      }}
    >
      <ChatView
        key={chatKey}
        compact
        onClose={onClose}
        onHeaderPointerDown={(e) => beginGesture("move", e)}
        onToggleExpand={toggleMax}
        expanded={maximized}
      />
      {!maximized &&
        HANDLES.map((hd) => (
          <div
            key={hd.dir}
            onPointerDown={(e) => beginGesture(hd.dir, e)}
            className={`absolute z-10 ${hd.className}`}
            style={{ cursor: hd.cursor, touchAction: "none" }}
          />
        ))}
    </div>
  );
}

/** Apply a resize in direction `dir` to `start`, clamped to min size + viewport. */
function resizeFrame(start: Frame, dir: Dir, dx: number, dy: number, vw: number, vh: number): Frame {
  let { x, y, w, h } = start;
  if (dir.includes("e")) w = start.w + dx;
  if (dir.includes("s")) h = start.h + dy;
  if (dir.includes("w")) {
    w = start.w - dx;
    if (w < MIN_W) w = MIN_W;
    if (w > start.x + start.w - MARGIN) w = start.x + start.w - MARGIN;
    x = start.x + start.w - w;
  }
  if (dir.includes("n")) {
    h = start.h - dy;
    if (h < MIN_H) h = MIN_H;
    if (h > start.y + start.h - MARGIN) h = start.y + start.h - MARGIN;
    y = start.y + start.h - h;
  }
  w = clamp(w, MIN_W, vw - x - MARGIN);
  h = clamp(h, MIN_H, vh - y - MARGIN);
  return { x, y, w, h };
}
