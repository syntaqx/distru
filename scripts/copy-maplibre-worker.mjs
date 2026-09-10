// Self-host MapLibre GL's Web Worker.
//
// maplibre-gl v6 loads its worker as a *separate* ES module whose URL it builds
// at runtime: `new URL('./maplibre-gl-worker.mjs', import.meta.url)`. Neither
// webpack nor Turbopack can see that dynamic construction, so the worker file is
// never emitted as a served asset and the browser gets the HTML 404 page back
// ("Failed to load module script: non-JavaScript MIME type text/html") -> the
// map renders blank. We copy the worker (and the shared chunk it imports) into
// /public so Next serves them as real static assets, then point MapLibre at the
// stable URL via `setWorkerUrl` (see components/fleet/dispatch-map.tsx).
//
// Runs in `prebuild` (Vercel) and in the local compose command, so the copied
// files always match the installed maplibre-gl version.
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
// Resolve the package's dist dir from its manifest (works regardless of CWD).
const distDir = dirname(require.resolve("maplibre-gl/package.json"));
const version = require("maplibre-gl/package.json").version;
const src = join(distDir, "dist");
const out = join(process.cwd(), "public", "maplibre");

// The worker + the shared chunk it imports (`import ... from "./maplibre-gl-shared.mjs"`),
// plus the stylesheet (served from /public and linked by the map component - the
// bundler's client-component CSS import for this package doesn't reliably apply,
// which collapses the map canvas and hides the controls).
const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs", "maplibre-gl.css"];

mkdirSync(out, { recursive: true });
for (const f of files) copyFileSync(join(src, f), join(out, f));

console.log(`✓ maplibre worker v${version} -> public/maplibre/ (${files.join(", ")})`);
