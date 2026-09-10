import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit-test config for pure TypeScript logic ONLY. This intentionally does not
 * load Next's webpack/JSX pipeline: tests target framework-free, DB-free modules
 * (importing anything that transitively pulls in `@/db` would open a connection).
 *
 * The `@/` path alias from tsconfig is mirrored here so `@/lib/...` imports
 * resolve to the repo root, matching the app.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov"],
      include: ["lib/**"],
      exclude: [
        "lib/docs/_generated.ts",
        "**/*.d.ts",
        "**/*.config.{ts,js,mjs,cjs}",
        "db/**",
        "scripts/**",
        "**/__tests__/**",
        "**/*.{test,spec}.ts",
      ],
    },
  },
});
