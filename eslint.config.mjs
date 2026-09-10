import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated coverage output (vitest --coverage / CI).
    "coverage/**",
    // Vendored, minified maplibre worker copied in by scripts/copy-maplibre-worker.mjs.
    "public/maplibre/**",
  ]),

  // --- Architecture boundaries (modular monolith) ---
  // These rules make the dependency direction load-bearing: the domain modules
  // stay decoupled and extractable into services as the platform grows, and the
  // AI/Copilot layer stays strictly on top of the domain.

  // Everyone imports a module through its public barrel, never its internals.
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/modules/*/*"],
              message:
                "Import a module's public barrel (@/lib/modules/<module>), not its internals.",
            },
          ],
        },
      ],
    },
  },

  // Piece 1 (domain modules) must not depend on Piece 2 (the Copilot/harness)
  // or on the UI/faces. The AI layer sits on top of the domain, never the reverse.
  {
    files: ["lib/modules/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/harness", "@/lib/harness/*"],
              message:
                "Domain modules must not import the Copilot/harness - the AI layer depends on the domain, never the reverse.",
            },
            {
              group: ["@/app/*"],
              message: "Domain modules must not import the UI/faces.",
            },
            {
              group: ["@/lib/modules/*/*"],
              message: "Import a sibling module's public barrel, not its internals.",
            },
          ],
        },
      ],
    },
  },

  // The shared kernel depends on nothing else in the domain, the AI layer, or faces.
  {
    files: ["lib/modules/shared/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/modules/*",
                "../catalog",
                "../inventory",
                "../sales",
                "../purchasing",
                "../manufacturing",
                "../compliance",
                "../logistics",
                "../platform",
                "../imports",
              ],
              message: "The shared kernel must not depend on other domain modules.",
            },
            {
              group: ["@/lib/harness", "@/lib/harness/*", "@/app/*"],
              message: "The shared kernel must not depend on the AI layer or faces.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
