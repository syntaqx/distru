import Anthropic from "@anthropic-ai/sdk";
import { env, hasAnthropicKey } from "./env";

/**
 * Shared Anthropic client + configured model for the harness.
 * Workspace-scoped API keys require the `anthropic-workspace-id` header, so we
 * pass it when ANTHROPIC_WORKSPACE_ID is set.
 */
export const anthropic = new Anthropic({
  apiKey: env.anthropicApiKey,
  ...(env.anthropicWorkspaceId
    ? { defaultHeaders: { "anthropic-workspace-id": env.anthropicWorkspaceId } }
    : {}),
});
export const MODEL = env.anthropicModel;

export { hasAnthropicKey };
