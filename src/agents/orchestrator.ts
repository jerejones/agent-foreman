/**
 * AI Agent Orchestrator
 * Multi-agent orchestration and status functions
 */

import chalk from "chalk";
import { isTTY } from "../progress.js";
import { getAgentPriority } from "../timeout-config.js";
import type { AgentConfig } from "./types.js";
import { DEFAULT_AGENTS } from "./config.js";
import { commandExists, checkAvailableAgents } from "./detection.js";
import { callAgent } from "./executor.js";

/**
 * Try multiple agents in order until one succeeds
 * Uses AGENT_FOREMAN_AGENTS env var for priority order if set
 * Default priority: Claude > Codex > Gemini
 * No timeout by default - let the AI agent complete
 *
 * Set SKIP_AI_GUIDANCE=true to skip all AI calls (useful for testing)
 */
export async function callAnyAvailableAgent(
  prompt: string,
  options: {
    preferredOrder?: string[];
    timeoutMs?: number;
    verbose?: boolean;
    cwd?: string;
    /** Show "Using agent..." progress indicator (default: true) */
    showProgress?: boolean;
    /** Callback when an agent is selected, useful for updating parent spinners */
    onAgentSelected?: (agentName: string) => void;
  } = {}
): Promise<{ success: boolean; output: string; agentUsed?: string; error?: string }> {
  // Skip AI calls in test environment (prevents hanging in E2E tests)
  if (process.env.SKIP_AI_GUIDANCE === "true") {
    return {
      success: false,
      output: "",
      error: "AI calls disabled via SKIP_AI_GUIDANCE",
    };
  }

  const { preferredOrder, timeoutMs, verbose = false, cwd, showProgress = true, onAgentSelected } = options;
  const agentOrder = preferredOrder ?? getAgentPriority();

  for (const name of agentOrder) {
    const agent = DEFAULT_AGENTS.find((a) => a.name === name);
    if (!agent) continue;

    if (!commandExists(agent.command[0])) {
      if (verbose) {
        console.log(chalk.gray(`        ${name} not installed, skipping...`));
      }
      continue;
    }

    // Notify caller which agent is being used (for parent spinner updates)
    if (onAgentSelected) {
      onAgentSelected(name);
    }

    // Show which agent we're using with animated spinner (when showProgress is true)
    const startTime = Date.now();
    const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let spinnerIdx = 0;
    let spinnerInterval: NodeJS.Timeout | null = null;

    if (showProgress) {
      // Only use animated spinner in TTY mode to avoid conflicts
      if (isTTY()) {
        // Print initial message without newline
        process.stdout.write(chalk.blue(`        Using ${name}...`));
        spinnerInterval = setInterval(() => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          // Clear just this line and rewrite (don't use \r from column 0 to avoid parent spinner conflicts)
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(chalk.blue(`        Using ${name}... ${chalk.cyan(spinnerFrames[spinnerIdx])} ${chalk.gray(`(${elapsed}s)`)}`));
          spinnerIdx = (spinnerIdx + 1) % spinnerFrames.length;
        }, 100);
      } else {
        console.log(`        Using ${name}...`);
      }
    }

    const result = await callAgent(agent, prompt, { timeoutMs, cwd });

    if (spinnerInterval) {
      clearInterval(spinnerInterval);
    }
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (result.success) {
      if (showProgress && isTTY()) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        console.log(`        Using ${name}... ${chalk.green("✓")} ${chalk.gray(`(${elapsed}s)`)}`);
      } else if (showProgress) {
        console.log(`        Using ${name}... ${chalk.green("✓")} ${chalk.gray(`(${elapsed}s)`)}`);
      }
      return { ...result, agentUsed: name };
    }

    if (showProgress) {
      if (isTTY()) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
      }
      console.log(`        Using ${name}... ${chalk.red("✗")} ${chalk.gray(`(${elapsed}s)`)}`);
    }
    if (verbose) {
      console.log(chalk.yellow(`        Error: ${result.error}`));
    }
  }

  return {
    success: false,
    output: "",
    error: "No AI agents available or all failed",
  };
}

/**
 * Print available agents status
 */
export function printAgentStatus(): void {
  const agents = checkAvailableAgents();
  console.log(chalk.bold("AI Agents Status:"));
  for (const agent of agents) {
    const status = agent.available ? chalk.green("✓ available") : chalk.red("✗ not found");
    console.log(`  ${agent.name}: ${status}`);
  }
}

/**
 * Get formatted string of agent priority order
 * Returns format like "Claude > Codex > Gemini" with proper capitalization
 */
export function getAgentPriorityString(): string {
  const priority = getAgentPriority();
  // Capitalize first letter of each agent name
  const capitalized = priority.map((name) => name.charAt(0).toUpperCase() + name.slice(1));
  return capitalized.join(" > ");
}
