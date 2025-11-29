/**
 * Core verification logic
 * Orchestrates automated checks and AI analysis for feature verification
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";

import type { Feature } from "./types.js";
import { isPathWithinRoot, safeReadFile } from "./file-utils.js";
import type {
  VerificationCapabilities,
  AutomatedCheckResult,
  VerificationResult,
  VerifyOptions,
  FeatureVerificationSummary,
} from "./verification-types.js";
import {
  detectVerificationCapabilities,
  detectCapabilities,
} from "./capability-detector.js";
import { saveVerificationResult } from "./verification-store.js";
import {
  buildVerificationPrompt,
  parseVerificationResponse,
} from "./verification-prompts.js";
import { callAnyAvailableAgent } from "./agents.js";

const execAsync = promisify(exec);

// ============================================================================
// Git Operations
// ============================================================================

/**
 * Get git diff and changed files for verification
 */
export async function getGitDiffForFeature(
  cwd: string
): Promise<{ diff: string; files: string[]; commitHash: string }> {
  try {
    // Get current commit hash
    const { stdout: commitHash } = await execAsync("git rev-parse HEAD", {
      cwd,
    });

    // Get diff of uncommitted changes + last commit
    // This captures both staged and unstaged changes
    const { stdout: diffOutput } = await execAsync(
      "git diff HEAD~1 HEAD && git diff HEAD",
      { cwd, maxBuffer: 10 * 1024 * 1024 }
    );

    // Get list of changed files
    const { stdout: filesOutput } = await execAsync(
      "git diff HEAD~1 HEAD --name-only && git diff HEAD --name-only",
      { cwd }
    );

    const files = [
      ...new Set(
        filesOutput
          .trim()
          .split("\n")
          .filter((f) => f.length > 0)
      ),
    ];

    return {
      diff: diffOutput || "No changes detected",
      files,
      commitHash: commitHash.trim(),
    };
  } catch (error) {
    // Fallback: just get uncommitted changes
    try {
      const { stdout: diffOutput } = await execAsync("git diff HEAD", {
        cwd,
        maxBuffer: 10 * 1024 * 1024,
      });
      const { stdout: filesOutput } = await execAsync(
        "git diff HEAD --name-only",
        { cwd }
      );
      const { stdout: commitHash } = await execAsync("git rev-parse HEAD", {
        cwd,
      });

      const files = filesOutput
        .trim()
        .split("\n")
        .filter((f) => f.length > 0);

      return {
        diff: diffOutput || "No changes detected",
        files,
        commitHash: commitHash.trim(),
      };
    } catch {
      return {
        diff: "Unable to get git diff",
        files: [],
        commitHash: "unknown",
      };
    }
  }
}

// ============================================================================
// Automated Checks
// ============================================================================

/**
 * Run a single automated check
 */
async function runCheck(
  cwd: string,
  type: AutomatedCheckResult["type"],
  command: string
): Promise<AutomatedCheckResult> {
  const startTime = Date.now();

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      maxBuffer: 5 * 1024 * 1024,
      timeout: 300000, // 5 minute timeout
    });

    return {
      type,
      success: true,
      output: stdout + stderr,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; code?: number };
    return {
      type,
      success: false,
      output: (execError.stdout || "") + (execError.stderr || ""),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Run all available automated checks
 */
export async function runAutomatedChecks(
  cwd: string,
  capabilities: VerificationCapabilities,
  verbose: boolean = false
): Promise<AutomatedCheckResult[]> {
  const results: AutomatedCheckResult[] = [];

  // Run tests
  if (capabilities.hasTests && capabilities.testCommand) {
    if (verbose) {
      process.stdout.write(chalk.blue("   Running tests... "));
    }
    const result = await runCheck(cwd, "test", capabilities.testCommand);
    results.push(result);
    if (verbose) {
      console.log(result.success ? chalk.green("PASSED") : chalk.red("FAILED"));
    }
  }

  // Run type check
  if (capabilities.hasTypeCheck && capabilities.typeCheckCommand) {
    if (verbose) {
      process.stdout.write(chalk.blue("   Running type check... "));
    }
    const result = await runCheck(cwd, "typecheck", capabilities.typeCheckCommand);
    results.push(result);
    if (verbose) {
      console.log(result.success ? chalk.green("PASSED") : chalk.red("FAILED"));
    }
  }

  // Run linter
  if (capabilities.hasLint && capabilities.lintCommand) {
    if (verbose) {
      process.stdout.write(chalk.blue("   Running linter... "));
    }
    const result = await runCheck(cwd, "lint", capabilities.lintCommand);
    results.push(result);
    if (verbose) {
      console.log(result.success ? chalk.green("PASSED") : chalk.red("FAILED"));
    }
  }

  // Run build
  if (capabilities.hasBuild && capabilities.buildCommand) {
    if (verbose) {
      process.stdout.write(chalk.blue("   Running build... "));
    }
    const result = await runCheck(cwd, "build", capabilities.buildCommand);
    results.push(result);
    if (verbose) {
      console.log(result.success ? chalk.green("PASSED") : chalk.red("FAILED"));
    }
  }

  return results;
}

// ============================================================================
// Related Files
// ============================================================================

/**
 * Read related files for context
 * Includes files that import or are imported by changed files
 * Validates paths to prevent path traversal attacks
 */
export async function readRelatedFiles(
  cwd: string,
  changedFiles: string[]
): Promise<Map<string, string>> {
  const relatedFiles = new Map<string, string>();

  // Read the changed files themselves (most relevant)
  const sourceFiles = changedFiles.filter(
    (f) =>
      f.endsWith(".ts") ||
      f.endsWith(".tsx") ||
      f.endsWith(".js") ||
      f.endsWith(".jsx") ||
      f.endsWith(".py") ||
      f.endsWith(".go") ||
      f.endsWith(".rs")
  );

  // Read all source files without limit
  for (const file of sourceFiles) {
    // Validate path stays within project root to prevent path traversal
    if (!isPathWithinRoot(cwd, file)) {
      // Skip files that would escape project directory
      continue;
    }

    // Use safeReadFile for secure file reading
    const content = await safeReadFile(cwd, file);
    if (content !== null) {
      relatedFiles.set(file, content);
    }
    // If content is null, file doesn't exist or can't be read - skip silently
  }

  return relatedFiles;
}

// ============================================================================
// AI Analysis with Retry Logic
// ============================================================================

/** Retry configuration */
export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 10000, // 10 seconds
};

/**
 * Check if an error is transient (retryable)
 */
export function isTransientError(error: string | undefined): boolean {
  if (!error) return false;

  const transientPatterns = [
    /timeout/i,
    /timed?\s*out/i,
    /ETIMEDOUT/i,
    /ECONNRESET/i,
    /ECONNREFUSED/i,
    /ENETUNREACH/i,
    /network/i,
    /socket hang up/i,
    /connection.*reset/i,
    /connection.*refused/i,
    /connection.*closed/i,
    /temporarily unavailable/i,
    /rate limit/i,
    /too many requests/i,
    /429/,
    /503/,
    /502/,
    /504/,
    /overloaded/i,
    /capacity/i,
  ];

  return transientPatterns.some((pattern) => pattern.test(error));
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(
  attempt: number,
  baseDelayMs: number = RETRY_CONFIG.baseDelayMs
): number {
  // Exponential backoff: 1s, 2s, 4s, 8s...
  const delay = baseDelayMs * Math.pow(2, attempt - 1);
  // Add some jitter (±10%) to prevent thundering herd
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, RETRY_CONFIG.maxDelayMs);
}

/**
 * Perform AI analysis of the changes with retry logic
 */
export async function analyzeWithAI(
  cwd: string,
  feature: Feature,
  diff: string,
  changedFiles: string[],
  automatedResults: AutomatedCheckResult[],
  options: VerifyOptions = {}
): Promise<{
  criteriaResults: ReturnType<typeof parseVerificationResponse>["criteriaResults"];
  verdict: ReturnType<typeof parseVerificationResponse>["verdict"];
  overallReasoning: string;
  suggestions: string[];
  codeQualityNotes: string[];
  agentUsed: string;
}> {
  // Read related files for context
  const relatedFiles = await readRelatedFiles(cwd, changedFiles);

  // Build the prompt
  const prompt = buildVerificationPrompt(
    feature,
    diff,
    changedFiles,
    automatedResults,
    relatedFiles
  );

  // Call AI agent with retry logic
  console.log(chalk.blue("\n   AI Analysis:"));

  let lastError: string | undefined;
  let lastAgentUsed: string | undefined;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    const result = await callAnyAvailableAgent(prompt, {
      cwd,
      timeoutMs: options.timeout || 300000, // 5 minute timeout
      verbose: options.verbose,
    });

    lastAgentUsed = result.agentUsed;

    if (result.success) {
      // Parse the response
      const parsed = parseVerificationResponse(result.output, feature.acceptance);
      return {
        ...parsed,
        agentUsed: result.agentUsed || "unknown",
      };
    }

    lastError = result.error;

    // Check if error is transient (retryable)
    if (!isTransientError(lastError)) {
      // Permanent error, don't retry
      console.log(chalk.red("   AI analysis failed (permanent error): " + lastError));
      break;
    }

    // Transient error, retry with backoff
    if (attempt < RETRY_CONFIG.maxRetries) {
      const delayMs = calculateBackoff(attempt);
      console.log(
        chalk.yellow(
          `   AI analysis failed (attempt ${attempt}/${RETRY_CONFIG.maxRetries}): ${lastError}`
        )
      );
      console.log(chalk.yellow(`   Retrying in ${(delayMs / 1000).toFixed(1)}s...`));
      await sleep(delayMs);
    } else {
      console.log(
        chalk.red(
          `   AI analysis failed after ${RETRY_CONFIG.maxRetries} attempts: ${lastError}`
        )
      );
    }
  }

  // All retries exhausted or permanent error
  return {
    criteriaResults: feature.acceptance.map((criterion, index) => ({
      criterion,
      index,
      satisfied: false,
      reasoning: "AI analysis failed: " + (lastError || "Unknown error"),
      evidence: [],
      confidence: 0,
    })),
    verdict: "needs_review",
    overallReasoning: "AI analysis failed after retries",
    suggestions: [],
    codeQualityNotes: [],
    agentUsed: lastAgentUsed || "none",
  };
}

// ============================================================================
// Main Verification Function
// ============================================================================

/**
 * Verify a feature by running automated checks and AI analysis
 */
export async function verifyFeature(
  cwd: string,
  feature: Feature,
  options: VerifyOptions = {}
): Promise<VerificationResult> {
  const { verbose = false, skipChecks = false } = options;

  console.log(chalk.bold("\n   Verifying feature: " + feature.id));

  // Step 1: Get git diff
  if (verbose) {
    console.log(chalk.blue("\n   Getting git diff..."));
  }
  const { diff, files: changedFiles, commitHash } = await getGitDiffForFeature(cwd);

  if (verbose) {
    console.log(chalk.gray(`   Changed files: ${changedFiles.length}`));
    changedFiles.slice(0, 5).forEach((f) => console.log(chalk.gray(`     - ${f}`)));
    if (changedFiles.length > 5) {
      console.log(chalk.gray(`     ... and ${changedFiles.length - 5} more`));
    }
  }

  // Step 2: Detect capabilities and run automated checks
  let automatedResults: AutomatedCheckResult[] = [];

  if (!skipChecks) {
    if (verbose) {
      console.log(chalk.blue("\n   Detecting verification capabilities..."));
    }
    // Use new three-tier detection system (cache -> preset -> AI)
    const capabilities = await detectCapabilities(cwd, { verbose });

    if (verbose) {
      console.log(chalk.blue("\n   Running automated checks..."));
    }
    automatedResults = await runAutomatedChecks(cwd, capabilities, verbose);
  }

  // Step 3: AI Analysis
  const aiResult = await analyzeWithAI(
    cwd,
    feature,
    diff,
    changedFiles,
    automatedResults,
    options
  );

  // Step 4: Build verification result
  const result: VerificationResult = {
    featureId: feature.id,
    timestamp: new Date().toISOString(),
    commitHash,
    changedFiles,
    diffSummary: `${changedFiles.length} files changed`,
    automatedChecks: automatedResults,
    criteriaResults: aiResult.criteriaResults,
    verdict: aiResult.verdict,
    verifiedBy: aiResult.agentUsed,
    overallReasoning: aiResult.overallReasoning,
    suggestions: aiResult.suggestions,
    codeQualityNotes: aiResult.codeQualityNotes,
    relatedFilesAnalyzed: changedFiles,
  };

  // Step 5: Save result
  await saveVerificationResult(cwd, result);

  return result;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create a verification summary for embedding in feature
 */
export function createVerificationSummary(
  result: VerificationResult
): FeatureVerificationSummary {
  const satisfiedCount = result.criteriaResults.filter(
    (r) => r.satisfied
  ).length;
  const totalCount = result.criteriaResults.length;

  return {
    verifiedAt: result.timestamp,
    verdict: result.verdict,
    verifiedBy: result.verifiedBy,
    commitHash: result.commitHash,
    summary: `${satisfiedCount}/${totalCount} criteria satisfied`,
  };
}

/**
 * Format verification result for display
 */
export function formatVerificationResult(
  result: VerificationResult,
  verbose: boolean = false
): string {
  const lines: string[] = [];

  // Header
  lines.push(chalk.bold("\n   Verification Result"));
  lines.push("   " + "─".repeat(50));

  // Automated checks
  if (result.automatedChecks.length > 0) {
    lines.push(chalk.bold("\n   Automated Checks:"));
    for (const check of result.automatedChecks) {
      const status = check.success
        ? chalk.green("PASSED")
        : chalk.red("FAILED");
      const duration = check.duration
        ? chalk.gray(` (${(check.duration / 1000).toFixed(1)}s)`)
        : "";
      lines.push(`   ${check.type.padEnd(12)} ${status}${duration}`);
    }
  }

  // Criteria results
  lines.push(chalk.bold("\n   Criteria Analysis:"));
  for (const criterion of result.criteriaResults) {
    const status = criterion.satisfied
      ? chalk.green("✓")
      : chalk.red("✗");
    const confidence = chalk.gray(
      `(${(criterion.confidence * 100).toFixed(0)}%)`
    );
    lines.push(`   ${status} [${criterion.index + 1}] ${criterion.criterion.slice(0, 50)}... ${confidence}`);

    if (verbose) {
      lines.push(chalk.gray(`      ${criterion.reasoning}`));
      if (criterion.evidence && criterion.evidence.length > 0) {
        lines.push(
          chalk.gray(`      Evidence: ${criterion.evidence.join(", ")}`)
        );
      }
    }
  }

  // Verdict
  lines.push("\n   " + "─".repeat(50));
  const verdictColor =
    result.verdict === "pass"
      ? chalk.green
      : result.verdict === "fail"
        ? chalk.red
        : chalk.yellow;
  lines.push(
    chalk.bold("   Verdict: ") + verdictColor(result.verdict.toUpperCase())
  );

  if (verbose && result.overallReasoning) {
    lines.push(chalk.gray(`\n   ${result.overallReasoning}`));
  }

  // Suggestions
  if (result.suggestions && result.suggestions.length > 0) {
    lines.push(chalk.bold("\n   Suggestions:"));
    for (const suggestion of result.suggestions) {
      lines.push(chalk.yellow(`   • ${suggestion}`));
    }
  }

  return lines.join("\n");
}
