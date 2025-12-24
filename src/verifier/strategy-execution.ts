/**
 * Strategy-based verification execution (UVS Phase 4)
 * Executes verification strategies and combines results
 */

import chalk from "chalk";

import type { Feature } from "../types/index.js";
import type {
  VerificationStrategy,
  VerificationResult,
  VerificationVerdict,
  CriterionResult,
  VerifyOptions,
} from "./types/index.js";
import { executeStrategy, initializeStrategies, type StrategyResult } from "../strategies/index.js";
import { saveVerificationResult } from "../verification-store/index.js";
import { createStepProgress } from "../progress.js";
import { getGitDiffForFeature } from "./git-operations.js";
import { getVerificationStrategies } from "./strategy-conversion.js";
import type { StrategyExecutionResult } from "./types.js";

/**
 * Execute all verification strategies for a feature
 * Phase 4 of Universal Verification Strategy RFC
 *
 * @param cwd - Current working directory
 * @param feature - The feature being verified
 * @param strategies - Array of verification strategies to execute
 * @returns Strategy execution result with overall verdict
 */
export async function executeVerificationStrategies(
  cwd: string,
  feature: Feature,
  strategies: VerificationStrategy[]
): Promise<StrategyExecutionResult> {
  // Initialize strategy executors
  initializeStrategies();

  const results: Array<{
    strategy: VerificationStrategy;
    result: StrategyResult;
  }> = [];

  // Execute all strategies in order, collecting results
  for (const strategy of strategies) {
    try {
      const result = await executeStrategy(cwd, strategy, feature);
      results.push({ strategy, result });

      // Log progress with clear distinction between required and optional strategies
      if (result.success) {
        console.log(chalk.gray(`   ${chalk.green("✓")} Strategy ${strategy.type}: passed`));
      } else if (strategy.required === false) {
        // Optional strategy failed - use yellow/skip indicator instead of red error
        console.log(chalk.gray(`   ${chalk.yellow("○")} Strategy ${strategy.type}: skipped ${chalk.gray("(optional, no matching tests)")}`));
      } else {
        // Required strategy failed - use red error
        console.log(chalk.gray(`   ${chalk.red("✗")} Strategy ${strategy.type}: failed`));
      }
    } catch (error) {
      // Handle executor not found or other errors
      const errorResult: StrategyResult = {
        success: false,
        output: `Strategy execution error: ${(error as Error).message}`,
        details: {
          error: (error as Error).message,
          strategyType: strategy.type,
        },
      };
      results.push({ strategy, result: errorResult });
      console.log(chalk.gray(`   ${chalk.red("✗")} Strategy ${strategy.type}: error - ${(error as Error).message}`));
    }
  }

  // Determine overall verdict based on strategy results
  const verdict = determineOverallVerdict(results);

  // Combine outputs into overall reasoning
  const overallReasoning = buildOverallReasoning(results);

  // Map strategy results to criteria results
  const criteriaResults = mapToCriteriaResults(feature, results);

  // Collect agent info from AI strategies
  const aiResults = results.filter((r) => r.strategy.type === "ai");
  const agentUsed = aiResults.length > 0
    ? (aiResults[0].result.details?.agentUsed as string | undefined)
    : undefined;

  // Collect suggestions from all strategies
  const suggestions = results
    .filter((r) => r.result.details?.suggestions)
    .flatMap((r) => (r.result.details?.suggestions ?? []) as string[]);

  // Collect code quality notes
  const codeQualityNotes = results
    .filter((r) => r.result.details?.codeQualityNotes)
    .flatMap((r) => (r.result.details?.codeQualityNotes ?? []) as string[]);

  return {
    results,
    verdict,
    overallReasoning,
    criteriaResults,
    agentUsed,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
    codeQualityNotes: codeQualityNotes.length > 0 ? codeQualityNotes : undefined,
  };
}

/**
 * Determine overall verdict from strategy results
 * Logic:
 * - If any required strategy fails → fail
 * - If any strategy needs_review → needs_review
 * - If all required strategies pass → pass
 */
function determineOverallVerdict(
  results: Array<{ strategy: VerificationStrategy; result: StrategyResult }>
): VerificationVerdict {
  // Check for required strategy failures
  const requiredFailures = results.filter(
    (r) => r.strategy.required !== false && !r.result.success
  );
  if (requiredFailures.length > 0) {
    return "fail";
  }

  // Check for needs_review verdicts
  const needsReview = results.some(
    (r) => r.result.details?.verdict === "needs_review"
  );
  if (needsReview) {
    return "needs_review";
  }

  // All required strategies passed
  return "pass";
}

/**
 * Build combined reasoning from all strategy outputs
 */
function buildOverallReasoning(
  results: Array<{ strategy: VerificationStrategy; result: StrategyResult }>
): string {
  const lines: string[] = [];

  for (const { strategy, result } of results) {
    const status = result.success ? "✓ PASS" : "✗ FAIL";
    lines.push(`[${strategy.type.toUpperCase()}] ${status}`);
    if (result.output) {
      // Indent output lines
      const outputLines = result.output.split("\n").map((l) => `  ${l}`);
      lines.push(...outputLines);
    }
    lines.push(""); // Empty line between strategies
  }

  return lines.join("\n").trim();
}

/**
 * Map strategy results to criteria results format
 * This allows strategy-based verification to fit into the existing
 * VerificationResult structure
 */
function mapToCriteriaResults(
  feature: Feature,
  results: Array<{ strategy: VerificationStrategy; result: StrategyResult }>
): CriterionResult[] {
  const criteriaResults: CriterionResult[] = [];

  // If any AI strategy has criteriaResults, use those
  for (const { result } of results) {
    if (result.details?.criteriaResults && Array.isArray(result.details.criteriaResults)) {
      return result.details.criteriaResults as CriterionResult[];
    }
  }

  // Otherwise, map each acceptance criterion to strategy results
  for (let i = 0; i < feature.acceptance.length; i++) {
    const criterion = feature.acceptance[i];

    // Default to pass if all required strategies passed
    const allRequiredPassed = results.every(
      (r) => r.strategy.required === false || r.result.success
    );

    criteriaResults.push({
      criterion,
      index: i,
      satisfied: allRequiredPassed,
      reasoning: allRequiredPassed
        ? "Verified by strategy execution"
        : "One or more required strategies failed",
      confidence: allRequiredPassed ? 0.8 : 0.3,
    });
  }

  return criteriaResults;
}

/**
 * Verify a feature using the strategy framework (UVS Phase 4)
 * This is the new verification path for features with explicit strategies
 *
 * @param cwd - Current working directory
 * @param feature - The feature being verified
 * @param options - Verification options
 * @returns VerificationResult compatible with existing system
 */
export async function verifyWithStrategies(
  cwd: string,
  feature: Feature,
  options: VerifyOptions = {}
): Promise<VerificationResult> {
  const { verbose = false } = options;

  console.log(chalk.magenta(`   Using strategy-based verification`));

  // Get strategies for this feature
  const strategies = getVerificationStrategies(feature);
  console.log(chalk.gray(`   Strategies: ${strategies.map((s) => s.type).join(", ")}`));

  // Define progress steps
  const steps = ["Get git diff", "Execute strategies", "Save results"];
  const stepProgress = createStepProgress(steps);
  stepProgress.start();

  // Step 1: Get git diff
  const { diff, files: changedFiles, commitHash } = await getGitDiffForFeature(cwd);
  stepProgress.completeStep(true);

  if (verbose) {
    console.log(chalk.gray(`   Changed files: ${changedFiles.length}`));
    changedFiles.slice(0, 5).forEach((f) => console.log(chalk.gray(`     - ${f}`)));
    if (changedFiles.length > 5) {
      console.log(chalk.gray(`     ... and ${changedFiles.length - 5} more`));
    }
  }

  // Step 2: Execute strategies
  const strategyResult = await executeVerificationStrategies(cwd, feature, strategies);
  stepProgress.completeStep(strategyResult.verdict === "pass");

  // Step 3: Build verification result
  const result: VerificationResult = {
    featureId: feature.id,
    timestamp: new Date().toISOString(),
    commitHash,
    changedFiles,
    diffSummary: `${changedFiles.length} files changed`,
    automatedChecks: [], // Strategy results replace automated checks
    criteriaResults: strategyResult.criteriaResults,
    verdict: strategyResult.verdict,
    verifiedBy: strategyResult.agentUsed ?? "strategy-framework",
    overallReasoning: strategyResult.overallReasoning,
    suggestions: strategyResult.suggestions,
    codeQualityNotes: strategyResult.codeQualityNotes,
    relatedFilesAnalyzed: changedFiles,
    // Include strategy execution details
    strategyResults: strategyResult.results.map((r) => ({
      type: r.strategy.type,
      required: r.strategy.required !== false,
      success: r.result.success,
      output: r.result.output,
      duration: r.result.duration,
    })),
  };

  // Step 4: Save result
  await saveVerificationResult(cwd, result);
  stepProgress.completeStep(true);

  return result;
}
