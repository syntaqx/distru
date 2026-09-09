"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A YouTube-style top loading bar for App Router navigations. There's no built-in
 * router-event API, so we start the bar when an internal link is clicked (or on
 * back/forward) and finish it when the route (path or query) actually commits -
 * which is precisely when Next has finished loading the new page. Dependency-free.
 */
export function TopProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  // `active` is a ref (not state) so start/finish decisions are synchronous and
  // don't race the async router commit — and so the initial mount doesn't flash.
  const active = useRef(false);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAll = useCallback(() => {
    if (trickle.current) clearInterval(trickle.current);
    trickle.current = null;
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const finish = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    clearAll();
    setWidth(100);
    timers.current.push(setTimeout(() => setVisible(false), 250));
    timers.current.push(setTimeout(() => setWidth(0), 450));
  }, [clearAll]);

  const start = useCallback(() => {
    if (active.current) return;
    active.current = true;
    clearAll();
    setVisible(true);
    setWidth(8);
    // Ease toward 90% and hold, so a slow page keeps showing progress.
    trickle.current = setInterval(() => setWidth((w) => (w < 90 ? w + (90 - w) * 0.12 : w)), 220);
    // Safety net: never leave the bar hung if a nav is cancelled/blocked.
    timers.current.push(setTimeout(() => finish(), 12000));
  }, [clearAll, finish]);

  // Start on same-origin link navigations (plain left-clicks only) + back/forward.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      const href = a?.getAttribute("href");
      if (!a || !href || a.getAttribute("target") === "_blank" || a.hasAttribute("download")) return;
      try {
        const url = new URL(href, location.href);
        if (url.origin !== location.origin) return;
        if (url.pathname === location.pathname && url.search === location.search) return; // same page
      } catch {
        return;
      }
      start();
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
    };
  }, [start]);

  // The route committed → the new page is ready → finish.
  useEffect(() => {
    finish();
  }, [pathname, searchParams, finish]);

  useEffect(() => () => clearAll(), [clearAll]);

  if (!visible && width === 0) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-200 h-0.5">
      <div
        className="h-full bg-accent transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${width}%`, opacity: visible ? 1 : 0, boxShadow: "0 0 8px var(--color-accent)" }}
      />
    </div>
  );
}
