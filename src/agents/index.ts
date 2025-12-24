/**
 * AI Agent subprocess management
 * Re-exports the public API
 */

// Types
export type { AgentConfig, AgentState, CallAgentOptions } from "./types.js";

// Configuration
export { DEFAULT_AGENTS } from "./config.js";

// Detection and availability
export {
  getPlatform,
  commandExists,
  getAvailableAgent,
  filterAvailableAgents,
  checkAvailableAgents,
} from "./detection.js";

// Executor functions
export { callAgent, callAgentWithRetry } from "./executor.js";

// Orchestrator functions
export { callAnyAvailableAgent, printAgentStatus, getAgentPriorityString } from "./orchestrator.js";
