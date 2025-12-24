/**
 * AI Agent Types
 */

import type { ChildProcess } from "node:child_process";

/**
 * Agent configuration
 */
export interface AgentConfig {
  name: string;
  command: string[];
  promptViaStdin?: boolean;
  promptViaFile?: boolean; // Pass prompt via @filename argument (for CLIs that don't support stdin)
  env?: Record<string, string>; // Custom environment variables for this agent
}

/**
 * Agent execution state
 */
export interface AgentState {
  config: AgentConfig;
  status: "pending" | "running" | "completed" | "error" | "killed" | "timeout";
  stdout: string[];
  stderr: string[];
  startTime?: number;
  endTime?: number;
  exitCode?: number | null;
  errorMessage?: string;
  process?: ChildProcess;
  timeoutHandle?: NodeJS.Timeout;
}

/**
 * Options for calling an AI agent
 */
export interface CallAgentOptions {
  timeoutMs?: number;
  cwd?: string; // Working directory for the agent
}
