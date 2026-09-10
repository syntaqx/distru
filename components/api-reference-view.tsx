"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import "@scalar/api-reference-react/style.css";

/**
 * The interactive OpenAPI explorer (Scalar), rendering the live spec at
 * /api/openapi.json - the same drift-guarded spec the API is built from. It's an
 * app-shell-mounted client component (Scalar is browser-only, so ssr:false) and
 * follows the app's own light/dark theme instead of forcing its own.
 */
const ApiReferenceReact = dynamic(
  () => import("@scalar/api-reference-react").then((m) => m.ApiReferenceReact),
  {
    ssr: false,
    loading: () => (
      <div className="p-6 text-sm text-muted">Loading the API reference…</div>
    ),
  },
);

function appIsDark(): boolean {
  const root = document.documentElement;
  return (
    root.dataset.theme === "dark" ||
    (!root.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

export function ApiReferenceView() {
  const [dark, setDark] = useState<boolean | null>(null);

  // Track the app theme (explicit toggle via data-theme, or the OS setting) and
  // keep Scalar in sync.
  useEffect(() => {
    const update = () => setDark(appIsDark());
    update();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      mq.removeEventListener("change", update);
      obs.disconnect();
    };
  }, []);

  if (dark === null) {
    return <div className="p-6 text-sm text-muted">Loading the API reference…</div>;
  }

  return (
    <ApiReferenceReact
      // Remount when the theme flips so Scalar re-applies its palette cleanly.
      key={dark ? "dark" : "light"}
      configuration={{
        url: "/api/openapi.json",
        hideDownloadButton: false,
        // Follow the app theme; hide Scalar's own toggle so there's one source.
        darkMode: dark,
        forceDarkModeState: dark ? "dark" : "light",
        hideDarkModeToggle: true,
      }}
    />
  );
}
