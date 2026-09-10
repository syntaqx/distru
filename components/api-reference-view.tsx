"use client";

import dynamic from "next/dynamic";
import "@scalar/api-reference-react/style.css";

/**
 * The interactive OpenAPI explorer (Scalar), rendering the live spec at
 * /api/openapi.json — the same drift-guarded spec the API is built from. It's an
 * app-shell-mounted client component (Scalar is browser-only, so ssr:false).
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

export function ApiReferenceView() {
  return (
    <ApiReferenceReact
      configuration={{
        url: "/api/openapi.json",
        hideDownloadButton: false,
        hideDarkModeToggle: false,
      }}
    />
  );
}
