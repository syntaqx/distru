import { env } from "@/lib/env";
import type { ModelProvider } from "./types";
import { anthropicProvider } from "./anthropic";
import { openaiProvider } from "./openai";

export type { ModelProvider, ModelTurn, ModelTurnRequest, ModelToolSpec } from "./types";

/**
 * The provider registry. Adding a model vendor is one entry here plus one file
 * implementing `ModelProvider` - nothing in the runner changes. The active one
 * is chosen by `MODEL_PROVIDER` (default anthropic).
 */
const PROVIDERS: Record<string, ModelProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
};

export function getModelProvider(): ModelProvider {
  const provider = PROVIDERS[env.modelProvider];
  if (!provider) {
    throw new Error(
      `Unknown MODEL_PROVIDER "${env.modelProvider}". Available: ${Object.keys(PROVIDERS).join(", ")}.`,
    );
  }
  return provider;
}

export function listModelProviders(): string[] {
  return Object.keys(PROVIDERS);
}
