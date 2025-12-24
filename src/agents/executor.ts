/**
 * AI Agent Executor
 * Core functions for calling AI agents
 */

import { spawn, type ChildProcess } from "node:child_process";
import chalk from "chalk";
import { getTimeout } from "../timeout-config.js";
import type { AgentConfig, AgentState, CallAgentOptions } from "./types.js";

/**
 * Call an AI agent with a prompt
 */
export async function callAgent(
  config: AgentConfig,
  prompt: string,
  options: CallAgentOptions = {}
): Promise<{ success: boolean; output: string; error?: string }> {
  const { timeoutMs, cwd } = options;

  const state: AgentState = {
    config,
    status: "pending",
    stdout: [],
    stderr: [],
  };

  const useStdin = config.promptViaStdin !== false;
  state.startTime = Date.now();
  state.status = "running";

  let child: ChildProcess;
  try {
    child = useStdin
      ? spawn(config.command[0], config.command.slice(1), {
          stdio: ["pipe", "pipe", "pipe"],
          cwd,
        })
      : spawn(config.command[0], [...config.command.slice(1), prompt], {
          stdio: ["ignore", "pipe", "pipe"],
          cwd,
        });
  } catch (err) {
    return {
      success: false,
      output: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }

  state.process = child;

  if (useStdin && child.stdin) {
    child.stdin.write(prompt);
    child.stdin.end();
  }

  child.stdout?.on("data", (chunk) => {
    state.stdout.push(chunk.toString());
  });

  child.stderr?.on("data", (chunk) => {
    state.stderr.push(chunk.toString());
  });

  const completion = new Promise<AgentState>((resolve) => {
    child.on("close", (code) => {
      state.exitCode = code;
      state.endTime = Date.now();
      if (state.status === "killed" || state.status === "timeout") {
        return resolve(state);
      }
      state.status = code === 0 ? "completed" : "error";
      resolve(state);
    });

    child.on("error", (err) => {
      state.endTime = Date.now();
      state.status = "error";
      state.errorMessage = err instanceof Error ? err.message : String(err);
      resolve(state);
    });
  });

  // Set timeout if specified
  if (timeoutMs && timeoutMs > 0) {
    state.timeoutHandle = setTimeout(() => {
      if (state.process && state.status === "running") {
        state.status = "timeout";
        state.endTime = Date.now();
        state.process.kill("SIGTERM");
      }
    }, timeoutMs);
  }

  const result = await completion;
  if (state.timeoutHandle) clearTimeout(state.timeoutHandle);

  const output = result.stdout.join("");
  const errorOutput = result.stderr.join("");

  if (result.status === "completed") {
    return { success: true, output };
  } else if (result.status === "timeout") {
    return { success: false, output, error: "Agent timed out" };
  } else {
    return {
      success: false,
      output,
      error: result.errorMessage || errorOutput || "Unknown error",
    };
  }
}

/**
 * Call AI agent with retry logic
 */
export async function callAgentWithRetry(
  config: AgentConfig,
  prompt: string,
  options: {
    timeoutMs?: number;
    maxRetries?: number;
    delayMs?: number;
    verbose?: boolean;
    cwd?: string;
  } = {}
): Promise<{ success: boolean; output: string; error?: string }> {
  const { timeoutMs = getTimeout("AI_DEFAULT"), maxRetries = 2, delayMs = 1000, verbose = false, cwd } = options;

  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (verbose && attempt > 1) {
      console.log(chalk.yellow(`  Retry attempt ${attempt}/${maxRetries}...`));
    }

    const result = await callAgent(config, prompt, { timeoutMs, cwd });

    if (result.success) {
      return result;
    }

    lastError = result.error;

    if (attempt < maxRetries) {
      // Wait before retry with configurable delay
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return {
    success: false,
    output: "",
    error: lastError || "All retry attempts failed",
  };
}
