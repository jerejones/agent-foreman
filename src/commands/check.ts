/**
 * 'check' command implementation
 * AI-powered verification of task/feature completion
 *
 * Modes:
 * - Fast check (default, no task_id): Git diff → selective tests + task impact notification
 * - Full check (--full): All tests + build + E2E + AI analysis
 * - Task check (<task_id>): Task-scoped full verification
 */
import chalk from "chalk";

import {
  loadFeatureList,
  findFeatureById,
  updateFeatureVerificationQuick,
  selectNextFeature,
  isBreakdownTask,
} from "../features/index.js";
import {
  verifyFeature,
  verifyFeatureAutonomous,
  createVerificationSummary,
  formatVerificationResult,
} from "../verifier/index.js";
import { runLayeredCheck } from "../verifier/layered-check.js";
import { appendProgressLog, createVerifyEntry } from "../progress-log.js";
import { verifyTDDGate } from "../test-gate.js";

/**
 * Run the check command
 *
 * @param featureId - Task ID for task-based verification (optional)
 * @param verbose - Show detailed output
 * @param skipChecks - Skip automated checks, AI only
 * @param ai - Enable AI verification (autonomous exploration for tasks, affected tasks for fast mode)
 * @param testMode - Test execution mode: full, quick, or skip
 * @param testPattern - Explicit test pattern to use
 * @param skipE2E - Skip E2E tests entirely
 * @param e2eMode - E2E test mode
 * @param full - Run full verification (all tests + build + E2E)
 */
export async function runCheck(
  featureId?: string,
  verbose: boolean = false,
  skipChecks: boolean = false,
  ai: boolean = false,
  testMode: "full" | "quick" | "skip" = "full",
  testPattern?: string,
  skipE2E: boolean = false,
  e2eMode?: "full" | "smoke" | "tags" | "skip",
  full: boolean = false
): Promise<void> {
  const cwd = process.cwd();

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYERED CHECK MODE: When no task_id and not --full
  // Fast git-diff-based verification with task impact notification
  // ═══════════════════════════════════════════════════════════════════════════
  if (!featureId && !full) {
    const featureList = await loadFeatureList(cwd);
    const tddMode = featureList?.metadata?.tddMode;

    await runLayeredCheck(cwd, {
      verbose,
      ai,
      tddMode,
    });
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TASK-BASED VERIFICATION: Standard behavior for task_id or --full
  // ═══════════════════════════════════════════════════════════════════════════

  // Load task list
  const featureList = await loadFeatureList(cwd);
  if (!featureList) {
    console.log(chalk.red("✗ No task list found. Run 'agent-foreman init' first."));
    process.exit(1);
  }

  // Auto-select task if not provided (for --full mode)
  let targetFeatureId = featureId;
  if (!targetFeatureId) {
    const next = selectNextFeature(featureList.features);
    if (!next) {
      console.log(chalk.yellow("No pending tasks to check."));
      console.log(chalk.gray("All tasks are either passing, failed, blocked, or deprecated."));
      return;
    }
    targetFeatureId = next.id;
    console.log(chalk.cyan(`Auto-selected task: ${targetFeatureId}`));
  }

  // Find task
  const feature = findFeatureById(featureList.features, targetFeatureId);
  if (!feature) {
    console.log(chalk.red(`✗ Task '${targetFeatureId}' not found.`));
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────────
  // Skip BREAKDOWN tasks - they don't need code verification
  // ─────────────────────────────────────────────────────────────────
  if (isBreakdownTask(feature.id)) {
    console.log(chalk.yellow(`\n⚠ BREAKDOWN tasks don't need 'check' verification.`));
    console.log(chalk.gray(`   BREAKDOWN tasks verify task decomposition, not code.`));
    console.log(chalk.cyan(`\n   Use 'agent-foreman done ${targetFeatureId}' to complete the BREAKDOWN task.`));
    return;
  }

  // ─────────────────────────────────────────────────────────────────
  // TDD Gate: Verify test files exist before verification
  // ─────────────────────────────────────────────────────────────────
  const strictMode = featureList.metadata?.tddMode === "strict";
  const hasRequiredTests =
    feature.testRequirements?.unit?.required ||
    feature.testRequirements?.e2e?.required;

  if (strictMode || hasRequiredTests) {
    console.log(
      chalk.bold.magenta(
        "\n═══════════════════════════════════════════════════════════════"
      )
    );
    console.log(
      chalk.bold.magenta(
        "                    TDD VERIFICATION GATE"
      )
    );
    console.log(
      chalk.bold.magenta(
        "═══════════════════════════════════════════════════════════════\n"
      )
    );

    if (strictMode) {
      console.log(
        chalk.cyan("   Mode: STRICT TDD (tests required by project configuration)")
      );
    } else {
      console.log(chalk.cyan("   Mode: Feature requires tests (testRequirements.required: true)"));
    }

    const gateResult = await verifyTDDGate(cwd, feature, featureList.metadata);

    if (!gateResult.passed) {
      console.log(
        chalk.red("\n   ✗ TDD GATE FAILED: Required test files are missing")
      );

      if (gateResult.missingUnitTests.length > 0) {
        console.log(chalk.yellow("\n   Missing Unit Tests:"));
        gateResult.missingUnitTests.forEach((pattern) => {
          console.log(chalk.white(`     • ${pattern}`));
        });
      }

      if (gateResult.missingE2ETests.length > 0) {
        console.log(chalk.yellow("\n   Missing E2E Tests:"));
        gateResult.missingE2ETests.forEach((pattern) => {
          console.log(chalk.white(`     • ${pattern}`));
        });
      }

      console.log(chalk.bold.yellow("\n   TDD Workflow Required:"));
      console.log(chalk.gray("   1. Create test file(s) matching the pattern(s) above"));
      console.log(chalk.gray("   2. Write failing tests for acceptance criteria"));
      console.log(chalk.gray("   3. Implement the feature to make tests pass"));
      console.log(chalk.gray(`   4. Run 'agent-foreman check ${targetFeatureId}' again`));

      console.log(
        chalk.cyan(`\n   Run 'agent-foreman next ${targetFeatureId}' for TDD guidance\n`)
      );
      process.exit(1);
    }

    console.log(chalk.green("   ✓ Test files exist"));
    if (gateResult.foundTestFiles.length > 0) {
      const displayFiles = gateResult.foundTestFiles.slice(0, 3);
      const moreCount = gateResult.foundTestFiles.length - 3;
      console.log(
        chalk.gray(
          `     Found: ${displayFiles.join(", ")}${moreCount > 0 ? ` +${moreCount} more` : ""}`
        )
      );
    }
    console.log("");
  }

  console.log(chalk.bold.blue("\n═══════════════════════════════════════════════════════════════"));
  console.log(chalk.bold.blue("                      TASK VERIFICATION"));
  console.log(chalk.bold.blue("═══════════════════════════════════════════════════════════════\n"));

  console.log(chalk.bold(`📋 Task: ${chalk.cyan(feature.id)}`));
  console.log(chalk.gray(`   Module: ${feature.module} | Priority: ${feature.priority}`));
  if (ai) {
    console.log(chalk.cyan(`   Mode: AI autonomous exploration`));
  }
  if (testMode === "quick") {
    console.log(chalk.cyan(`   Test mode: Quick (selective tests)`));
  }
  console.log("");
  console.log(chalk.bold("📝 Acceptance Criteria:"));
  feature.acceptance.forEach((a, i) => {
    console.log(chalk.white(`   ${i + 1}. ${a}`));
  });

  // Derive skipE2E from feature.e2eTags: undefined or empty array means skip
  const featureSkipsE2E = !feature.e2eTags || feature.e2eTags.length === 0;
  const effectiveSkipE2E = skipE2E || featureSkipsE2E;

  // Run verification (choose mode based on --ai flag)
  const verifyOptions = {
    verbose,
    skipChecks,
    testMode,
    testPattern,
    skipE2E: effectiveSkipE2E,
    e2eTags: feature.e2eTags,
    e2eMode,
  };
  const result = ai
    ? await verifyFeatureAutonomous(cwd, feature, verifyOptions)
    : await verifyFeature(cwd, feature, verifyOptions);

  // Display result
  console.log(formatVerificationResult(result, verbose));

  // Update feature with verification summary (quick operation - only updates single feature file)
  const summary = createVerificationSummary(result);
  await updateFeatureVerificationQuick(cwd, targetFeatureId, summary);

  // Log to progress
  await appendProgressLog(
    cwd,
    createVerifyEntry(
      targetFeatureId,
      result.verdict,
      `Verified ${targetFeatureId}: ${result.verdict}`
    )
  );

  console.log(chalk.gray(`\n   Results saved to ai/verification/results.json`));
  console.log(chalk.gray(`   Feature list updated with verification summary`));

  // Suggest next action
  if (result.verdict === "pass") {
    console.log(chalk.green("\n   ✓ Task verified successfully!"));
    console.log(chalk.cyan(`   Run 'agent-foreman done ${targetFeatureId}' to mark as passing`));
  } else if (result.verdict === "fail") {
    console.log(chalk.red("\n   ✗ Verification failed. Review the criteria above and fix issues."));
    console.log(chalk.yellow("\n   Options:"));
    console.log(chalk.gray(`   1. Fix issues and run 'agent-foreman check ${targetFeatureId}' again`));
    console.log(chalk.gray(`   2. Mark as failed: 'agent-foreman fail ${targetFeatureId} -r "reason"'`));
  } else {
    console.log(chalk.yellow("\n   ⚠ Needs review. Some criteria could not be verified automatically."));
  }
}
