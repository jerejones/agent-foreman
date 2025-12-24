/**
 * AI Agent Detection and Availability
 */

import { spawnSync } from "node:child_process";
import { getAgentPriority } from "../timeout-config.js";
import type { AgentConfig } from "./types.js";
import { DEFAULT_AGENTS } from "./config.js";

/**
 * Detect the current platform
 */
export function getPlatform(): "windows" | "unix" {
  return process.platform === "win32" ? "windows" : "unix";
}

/**
 * Check if a command exists in PATH (cross-platform)
 * Uses 'where' on Windows and 'which' on Unix-like systems
 */
export function commandExists(cmd: string): boolean {
  const isWindows = getPlatform() === "windows";
  const checkCmd = isWindows ? "where" : "which";
  const result = spawnSync(checkCmd, [cmd], { stdio: "pipe", shell: isWindows });
  return result.status === 0;
}

/**
 * Get the first available AI agent
 * Uses AGENT_FOREMAN_AGENTS env var for priority order if set
 */
export function getAvailableAgent(preferredOrder?: string[]): AgentConfig | null {
  const order = preferredOrder ?? getAgentPriority();
  for (const name of order) {
    const agent = DEFAULT_AGENTS.find((a) => a.name === name);
    if (agent && commandExists(agent.command[0])) {
      return agent;
    }
  }
  return null;
}

/**
 * Filter agents to only include those with available commands
 */
export function filterAvailableAgents(agents: AgentConfig[]): {
  available: AgentConfig[];
  unavailable: Array<{ name: string; command: string }>;
} {
  const available: AgentConfig[] = [];
  const unavailable: Array<{ name: string; command: string }> = [];

  for (const agent of agents) {
    const cmd = agent.command[0];
    if (commandExists(cmd)) {
      available.push(agent);
    } else {
      unavailable.push({ name: agent.name, command: cmd });
    }
  }

  return { available, unavailable };
}

/**
 * Check which AI agents are available
 */
export function checkAvailableAgents(): { name: string; available: boolean }[] {
  return DEFAULT_AGENTS.map((agent) => ({
    name: agent.name,
    available: commandExists(agent.command[0]),
  }));
}
