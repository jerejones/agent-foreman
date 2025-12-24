/**
 * AI Verification Strategy
 * Re-exports the public API
 */

export { AIStrategyExecutor } from "./executor.js";
export { DefaultAIAgent } from "./agent.js";
export type { ExtendedAiVerificationStrategy, AIAgentInterface } from "./types.js";
export type { ParsedAIResponse } from "./parser.js";
export { parseAIResponse } from "./parser.js";
export { formatAIOutput } from "./output.js";
export { buildCustomPrompt, buildDiffPrompt } from "./prompts.js";

// Import for registration
import { AIStrategyExecutor } from "./executor.js";
import { defaultRegistry } from "../../strategy-executor.js";

// Create and export singleton instance
export const aiStrategyExecutor = new AIStrategyExecutor();

// Register with default registry
defaultRegistry.register(aiStrategyExecutor);
