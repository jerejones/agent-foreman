/**
 * AI Agent subprocess management
 * Re-exports from modular agents/ directory
 *
 * This file is kept for backward compatibility with existing imports.
 */

export type { AgentConfig, AgentState, CallAgentOptions } from "./agents/index.js";

export {
  DEFAULT_AGENTS,
  getPlatform,
  commandExists,
  getAvailableAgent,
  filterAvailableAgents,
  checkAvailableAgents,
  callAgent,
  callAgentWithRetry,
  callAnyAvailableAgent,
  printAgentStatus,
  getAgentPriorityString,
} from "./agents/index.js";
