/**
 * AI Agent Implementation
 * Default AI agent using callAnyAvailableAgent
 */

import { callAnyAvailableAgent } from "../../agents.js";
import type { AIAgentInterface } from "./types.js";

/**
 * Default implementation using callAnyAvailableAgent
 */
export class DefaultAIAgent implements AIAgentInterface {
  async call(
    prompt: string,
    options: {
      timeoutMs?: number;
      verbose?: boolean;
      cwd?: string;
      preferredModel?: string;
      showProgress?: boolean;
    } = {}
  ): Promise<{ success: boolean; output: string; agentUsed?: string; error?: string }> {
    const preferredOrder = options.preferredModel ? [options.preferredModel] : undefined;
    return callAnyAvailableAgent(prompt, {
      timeoutMs: options.timeoutMs,
      verbose: options.verbose,
      cwd: options.cwd,
      preferredOrder,
      showProgress: options.showProgress,
    });
  }
}
