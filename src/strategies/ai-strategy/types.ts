/**
 * AI Strategy Types
 * Type definitions for AI verification strategy
 */

import type { AiVerificationStrategy } from "../../verifier/types/index.js";

/**
 * Extended AI strategy that supports mode and custom prompt
 * The base AiVerificationStrategy from verification-types.ts is extended here
 */
export interface ExtendedAiVerificationStrategy extends AiVerificationStrategy {
  /** Verification mode: diff (analyze git diff) or autonomous (explore codebase) */
  mode?: "diff" | "autonomous";
  /** Custom prompt to extend or replace default verification prompt */
  customPrompt?: string;
}

/**
 * Interface for AI agent calls (allows mocking in tests)
 */
export interface AIAgentInterface {
  call(
    prompt: string,
    options?: {
      timeoutMs?: number;
      verbose?: boolean;
      cwd?: string;
      preferredModel?: string;
      /** Show "Using agent..." progress indicator (default: true) */
      showProgress?: boolean;
    }
  ): Promise<{ success: boolean; output: string; agentUsed?: string; error?: string }>;
}
