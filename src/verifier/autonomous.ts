/**
 * Autonomous verification mode
 * AI explores the codebase itself to verify acceptance criteria
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";

import type { Feature } from "../types/index.js";
import type {
  AutomatedCheckResult,
  VerifyOptions,
  VerificationResult,
} from "./types/index.js";
import { detectCapabilities } from "../capabilities/index.js";
import { saveVerificationResult } from "../verification-store/index.js";
import { callAnyAvailableAgent } from "../agents.js";
import { getE2ETagsForFeature } from "../testing/index.js";
import { createSpinner, createStepProgress } from "../progress.js";
import { runAutomatedChecks } from "./check-executor.js";
import { RETRY_CONFIG, isTransientError, calculateBackoff } from "./ai-analysis.js";
import {
  buildAutonomousVerificationPrompt,
  parseAutonomousVerificationResponse,
} from "./autonomous-prompts.js";

// Re-export prompt functions for external use
export { buildAutonomousVerificationPrompt, parseAutonomousVerificationResponse } from "./autonomous-prompts.js";

const execAsync = promisify(exec);

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Verify a feature using autonomous AI exploration
 * The AI explores the codebase itself instead of analyzing pre-built diffs
 */
export async function verifyFeatureAutonomous(
  cwd: string,
  feature: Feature,
  options: VerifyOptions = {}
): Promise<VerificationResult> {
  const { verbose = false, skipChecks = false } = options;

  console.log(chalk.bold("\n   Verifying feature (autonomous): " + feature.id));

  // Define verification steps
  const steps = skipChecks
    ? ["AI autonomous exploration", "Save results"]
    : ["Detect capabilities", "Run automated checks", "AI autonomous exploration", "Save results"];

  const stepProgress = createStepProgress(steps);
  stepProgress.start();

  // Get commit hash for reference
  let commitHash = "unknown";
  try {
    const { stdout } = await execAsync("git rev-parse HEAD", { cwd });
    commitHash = stdout.trim();
  } catch {
    // Ignore git errors
  }

  // Step 1: Run automated checks (optional)
  let automatedResults: AutomatedCheckResult[] = [];

  if (!skipChecks) {
    const capabilities = await detectCapabilities(cwd, { verbose });
    stepProgress.completeStep(true);

    // Get E2E tags from feature
    const e2eTags = getE2ETagsForFeature(feature);

    automatedResults = await runAutomatedChecks(cwd, capabilities, {
      verbose,
      testMode: options.testMode || "full",
      skipE2E: options.skipE2E,
      e2eTags,
      e2eMode: options.e2eMode,
    });
    const allPassed = automatedResults.every((r) => r.success);
    stepProgress.completeStep(allPassed);
  }

  // Step 2: Build autonomous prompt and call AI
  const prompt = buildAutonomousVerificationPrompt(cwd, feature, automatedResults);

  console.log(chalk.blue("\n   AI Autonomous Exploration:"));
  const baseMessage = "AI exploring codebase";
  const spinner = createSpinner(baseMessage);

  let lastError: string | undefined;
  let lastAgentUsed: string | undefined;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    const attemptSuffix = attempt > 1 ? ` (attempt ${attempt}/${RETRY_CONFIG.maxRetries})` : "";
    if (attempt > 1) {
      spinner.update(`${baseMessage}${attemptSuffix}`);
    }

    const result = await callAnyAvailableAgent(prompt, {
      cwd,
      timeoutMs: options.timeout, // No default timeout - let AI explore as long as needed
      verbose: options.verbose,
      showProgress: false,
      onAgentSelected: (name) => spinner.update(`${baseMessage}${attemptSuffix} (Using ${name})`),
    });

    lastAgentUsed = result.agentUsed;

    if (result.success) {
      spinner.succeed(`AI exploration complete (${result.agentUsed})`);

      const parsed = parseAutonomousVerificationResponse(result.output, feature.acceptance);
      stepProgress.completeStep(parsed.verdict !== "fail");

      // Build verification result
      const verificationResult: VerificationResult = {
        featureId: feature.id,
        timestamp: new Date().toISOString(),
        commitHash,
        changedFiles: [],
        diffSummary: "Autonomous exploration (no diff)",
        automatedChecks: automatedResults,
        criteriaResults: parsed.criteriaResults,
        verdict: parsed.verdict,
        verifiedBy: result.agentUsed || "unknown",
        overallReasoning: parsed.overallReasoning,
        suggestions: parsed.suggestions,
        codeQualityNotes: parsed.codeQualityNotes,
        relatedFilesAnalyzed: [],
      };

      // Save result
      await saveVerificationResult(cwd, verificationResult);
      stepProgress.completeStep(true);

      return verificationResult;
    }

    lastError = result.error;

    if (!isTransientError(lastError)) {
      spinner.fail("AI exploration failed (permanent error): " + lastError);
      break;
    }

    if (attempt < RETRY_CONFIG.maxRetries) {
      const delayMs = calculateBackoff(attempt);
      spinner.warn(`AI exploration failed (attempt ${attempt}/${RETRY_CONFIG.maxRetries}): ${lastError}`);
      console.log(chalk.yellow(`   Retrying in ${(delayMs / 1000).toFixed(1)}s...`));
      await sleep(delayMs);
    } else {
      spinner.fail(`AI exploration failed after ${RETRY_CONFIG.maxRetries} attempts: ${lastError}`);
    }
  }

  // All retries exhausted
  stepProgress.complete();

  const failedResult: VerificationResult = {
    featureId: feature.id,
    timestamp: new Date().toISOString(),
    commitHash,
    changedFiles: [],
    diffSummary: "Autonomous exploration failed",
    automatedChecks: automatedResults,
    criteriaResults: feature.acceptance.map((criterion, index) => ({
      criterion,
      index,
      satisfied: false,
      reasoning: "AI exploration failed: " + (lastError || "Unknown error"),
      evidence: [],
      confidence: 0,
    })),
    verdict: "needs_review",
    verifiedBy: lastAgentUsed || "none",
    overallReasoning: "AI exploration failed after retries",
    suggestions: [],
    codeQualityNotes: [],
    relatedFilesAnalyzed: [],
  };

  await saveVerificationResult(cwd, failedResult);
  return failedResult;
}
