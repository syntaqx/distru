import type { NextConfig } from "next";

/**
 * The versioned public API lives at `/api/v1/*` (route handlers under
 * `app/api/v1`). A future breaking revision is just a sibling `app/api/v2` -
 * both versions serve side by side, no routing changes needed.
 *
 * Production subdomain (opt-in): set `API_HOST=api.distru.syntaqx.com` and point
 * that DNS record at this deployment. The host rewrite below then serves the API
 * at the subdomain root, dropping the `/api` segment - so:
 *     api.distru.syntaqx.com/v1/orders   -> /api/v1/orders
 *     api.distru.syntaqx.com/v2/orders   -> /api/v2/orders   (once v2 exists)
 *     api.distru.syntaqx.com/openapi.json-> /api/openapi.json
 * Left unset (as in dev), nothing changes and the API stays at /api/v1.
 */
const API_HOST = process.env.API_HOST?.trim();

const nextConfig: NextConfig = {
  // This repo sits under a folder with sibling lockfiles; pin the workspace root.
  turbopack: { root: import.meta.dirname },

  async rewrites() {
    if (!API_HOST) return [];
    return [
      {
        // On the API subdomain, the root maps to the /api tree (version stays in
        // the path), so v1 and any later v2 are both reachable at the subdomain.
        source: "/:path*",
        has: [{ type: "host", value: API_HOST }],
        destination: "/api/:path*",
      },
    ];
  },
};

export default nextConfig;
