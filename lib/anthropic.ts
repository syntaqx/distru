import Anthropic from "@anthropic-ai/sdk";
import { env, hasAnthropicKey } from "./env";

/** Shared Anthropic client + configured model for the harness. */
export const anthropic = new Anthropic({ apiKey: env.anthropicApiKey });
export const MODEL = env.anthropicModel;

export { hasAnthropicKey };
