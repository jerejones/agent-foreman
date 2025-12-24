/**
 * AI Strategy Executor
 * Main executor class for AI verification strategy
 */

import type { Feature } from "../../types/index.js";
import type { VerificationVerdict } from "../../verifier/types/index.js";
import type { StrategyExecutor, StrategyResult } from "../../strategy-executor.js";
import { buildAutonomousVerificationPrompt } from "../../verifier/index.js";

import type { ExtendedAiVerificationStrategy, AIAgentInterface } from "./types.js";
import { DefaultAIAgent } from "./agent.js";
import { buildCustomPrompt, buildDiffPrompt } from "./prompts.js";
import { parseAIResponse } from "./parser.js";
import { formatAIOutput } from "./output.js";

/** Default minimum confidence threshold */
const DEFAULT_MIN_CONFIDENCE = 0.7;

/** Default timeout for AI verification (5 minutes) */
const DEFAULT_TIMEOUT = 300000;

/**
 * AI Strategy Executor
 * Uses AI to verify acceptance criteria through diff analysis or autonomous exploration
 */
export class AIStrategyExecutor implements StrategyExecutor<ExtendedAiVerificationStrategy> {
  readonly type = "ai" as const;

  private aiAgent: AIAgentInterface;

  constructor(aiAgent?: AIAgentInterface) {
    this.aiAgent = aiAgent ?? new DefaultAIAgent();
  }

  /**
   * Set AI agent interface (for testing)
   */
  setAIAgent(aiAgent: AIAgentInterface): void {
    this.aiAgent = aiAgent;
  }

  /**
   * Execute AI verification strategy
   *
   * @param cwd - Current working directory
   * @param strategy - The AI strategy configuration
   * @param feature - The feature being verified
   * @returns Strategy execution result
   */
  async execute(
    cwd: string,
    strategy: ExtendedAiVerificationStrategy,
    feature: Feature
  ): Promise<StrategyResult> {
    const startTime = Date.now();
    const timeout = strategy.timeout ?? DEFAULT_TIMEOUT;
    const minConfidence = strategy.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
    const mode = strategy.mode ?? "autonomous";

    try {
      // Build the prompt based on mode
      let prompt: string;

      if (strategy.customPrompt) {
        // Use custom prompt, optionally extended with context
        prompt = buildCustomPrompt(cwd, strategy.customPrompt, feature);
      } else if (mode === "diff") {
        // Diff mode: analyze git diff against acceptance criteria
        prompt = await buildDiffPrompt(cwd, feature);
      } else {
        // Autonomous mode: reuse existing verification logic
        prompt = buildAutonomousVerificationPrompt(cwd, feature, []);
      }

      // Call AI agent
      const result = await this.aiAgent.call(prompt, {
        timeoutMs: timeout,
        cwd,
        preferredModel: strategy.model,
      });

      const duration = Date.now() - startTime;

      if (!result.success) {
        return {
          success: false,
          output: `AI verification failed: ${result.error ?? "Unknown error"}`,
          duration,
          details: {
            reason: "ai-call-failed",
            error: result.error,
            agentUsed: result.agentUsed,
          },
        };
      }

      // Parse AI response
      const parsed = parseAIResponse(result.output, feature.acceptance);

      // Check if all criteria meet minimum confidence
      const lowConfidenceCriteria = parsed.criteriaResults.filter(
        (r) => r.satisfied && r.confidence < minConfidence
      );

      // Determine success based on verdict and confidence
      let success = parsed.verdict === "pass";
      let verdictOverride: VerificationVerdict | undefined;

      if (lowConfidenceCriteria.length > 0 && success) {
        // Override success if confidence is too low
        success = false;
        verdictOverride = "needs_review";
      }

      return {
        success,
        output: formatAIOutput(parsed, verdictOverride),
        duration,
        details: {
          mode,
          agentUsed: result.agentUsed,
          verdict: verdictOverride ?? parsed.verdict,
          criteriaResults: parsed.criteriaResults,
          overallReasoning: parsed.overallReasoning,
          suggestions: parsed.suggestions,
          minConfidence,
          lowConfidenceCriteria: lowConfidenceCriteria.map((c) => c.criterion),
        },
      };
    } catch (error) {
      return {
        success: false,
        output: `AI verification failed: ${(error as Error).message}`,
        duration: Date.now() - startTime,
        details: {
          reason: "error",
          error: (error as Error).message,
        },
      };
    }
  }
}
