/**
 * Agents command - Show available AI agents status
 */

import { printAgentStatus } from "../agents.js";

/**
 * Run the agents command
 */
export async function runAgents(): Promise<void> {
  printAgentStatus();
}
