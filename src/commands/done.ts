/**
 * 'done' command implementation
 * Verify and mark a task/feature as complete
 */
import chalk from "chalk";

import {
  loadFeatureList,
  selectNextFeature,
  findFeatureById,
  buildAndSaveIndex,
  updateFeatureStatusQuick,
  updateFeatureVerificationQuick,
  getFeatureStats,
  getCompletionPercentage,
  isBreakdownTask,
} from "../features/index.js";
import { loadFeatureIndex } from "../storage/index.js";
import {
  appendProgressLog,
  createStepEntry,
  createVerifyEntry,
} from "../progress-log.js";
import {
  verifyFeature,
  verifyFeatureAutonomous,
  createVerificationSummary,
  formatVerificationResult,
} from "../verifier/index.js";
import { verifyTestFilesExist, discoverFeatureTestFiles, verifyTDDGate } from "../test-gate.js";
import { isGitRepo, gitAdd, gitCommit } from "../git-utils.js";
import { promptConfirmation } from "./utils.js";
import {
  regenerateSurvey,
  displayTestFileHeader,
  displayVerificationHeader,
  displayCommitSuggestion,
} from "./done-helpers.js";
import { runFail } from "./fail.js";
import { verifyBreakdownCompletion, displayBreakdownResult } from "./done-breakdown.js";

/**
 * Run the done command
 *
 * @param featureId - Task ID to mark as complete
 * @param notes - Additional notes
 * @param autoCommit - Automatically commit changes
 * @param skipCheck - Skip verification (default: true)
 * @param verbose - Show detailed output
 * @param ai - Enable AI autonomous exploration for verification
 * @param testMode - Test execution mode
 * @param testPattern - Explicit test pattern
 * @param skipE2E - Skip E2E tests
 * @param e2eMode - E2E test mode
 * @param loopMode - Loop mode for continuous processing
 */
export async function runDone(
  featureId: string,
  notes?: string,
  autoCommit: boolean = true,
  skipCheck: boolean = false,
  verbose: boolean = false,
  ai: boolean = false,
  testMode: "full" | "quick" | "skip" = "full",
  testPattern?: string,
  skipE2E: boolean = false,
  e2eMode?: "full" | "smoke" | "tags" | "skip",
  loopMode: boolean = true
): Promise<void> {
  const cwd = process.cwd();

  const featureList = await loadFeatureList(cwd);
  if (!featureList) {
    console.log(chalk.red("✗ No task list found."));
    process.exit(1);
  }

  const feature = findFeatureById(featureList.features, featureId);
  if (!feature) {
    console.log(chalk.red(`✗ Task '${featureId}' not found.`));
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────────
  // BREAKDOWN Task Completion Mode
  // ─────────────────────────────────────────────────────────────────
  if (isBreakdownTask(featureId)) {
    const breakdownResult = await verifyBreakdownCompletion(cwd, feature, featureList);
    displayBreakdownResult(breakdownResult);

    if (!breakdownResult.passed) {
      console.log(chalk.red("\n   ✗ BREAKDOWN verification failed."));
      console.log(chalk.yellow("   Fix the issues above and run the command again."));
      process.exit(1);
    }

    // Update status to passing
    await updateFeatureStatusQuick(cwd, featureId, "passing", notes || feature.notes);
    // Sync in-memory state for accurate loop mode counting
    feature.status = "passing";
    await appendProgressLog(cwd, createStepEntry(featureId, "passing", "breakdown-complete", `Completed breakdown: ${featureId}`));
    console.log(chalk.green(`\n✓ BREAKDOWN '${featureId}' completed successfully!`));

    // Handle git commit for BREAKDOWN tasks
    await handleCommit(cwd, feature, autoCommit);

    // Suggest next action with loop mode instruction
    const pendingBreakdowns = featureList.features.filter(f =>
      isBreakdownTask(f.id) && f.status === "failing"
    );
    const pendingTasks = featureList.features.filter(f =>
      !isBreakdownTask(f.id) && (f.status === "failing" || f.status === "needs_review")
    );

    if (pendingBreakdowns.length > 0) {
      // More BREAKDOWN tasks to process
      const totalBreakdowns = featureList.features.filter(f => isBreakdownTask(f.id)).length;
      const completedBreakdowns = featureList.features.filter(f => isBreakdownTask(f.id) && f.status === "passing").length;

      console.log(chalk.bold.cyan("\n══════════════════════════════════════════════════════════════"));
      console.log(chalk.bold.cyan("                   BREAKDOWN LOOP MODE ACTIVE"));
      console.log(chalk.bold.cyan("══════════════════════════════════════════════════════════════\n"));

      console.log(chalk.white(`   Completed: ${featureId} (${completedBreakdowns}/${totalBreakdowns} breakdowns)`));
      console.log(chalk.white(`   Next up: ${pendingBreakdowns[0].id}`));
      console.log(chalk.white(`   Remaining: ${pendingBreakdowns.length} breakdown(s)`));

      console.log(chalk.bold.red("\n   ⛔ NO QUESTIONS ALLOWED"));
      console.log(chalk.white("   - NEVER ask: \"Should I...\", \"Do you want...\", \"Which approach...\""));
      console.log(chalk.white("   - ALWAYS make autonomous decisions and proceed"));
      console.log(chalk.white("   - On ANY error: mark as failed, continue to next"));

      console.log(chalk.bold.yellow("\n   LOOP INSTRUCTION:"));
      console.log(chalk.gray("   1. agent-foreman next"));
      console.log(chalk.gray("   2. Create implementation tasks"));
      console.log(chalk.gray("   3. agent-foreman check <task_id>"));
      console.log(chalk.gray("   4. agent-foreman done <task_id>"));
      console.log(chalk.gray("   5. REPEAT until all BREAKDOWNs processed"));

      console.log(chalk.bold.green("\n   ➤ Do NOT stop. Do NOT ask questions. Continue NOW."));
      console.log(chalk.bold.cyan("══════════════════════════════════════════════════════════════\n"));
    } else {
      // All breakdowns done - VALIDATION LOOP MODE
      const totalBreakdowns = featureList.features.filter(f => isBreakdownTask(f.id)).length;

      console.log(chalk.bold.cyan("\n══════════════════════════════════════════════════════════════"));
      console.log(chalk.bold.cyan("                   VALIDATION PHASE REQUIRED"));
      console.log(chalk.bold.cyan("══════════════════════════════════════════════════════════════\n"));

      console.log(chalk.white(`   All ${totalBreakdowns} BREAKDOWN tasks completed`));
      console.log(chalk.white(`   ${pendingTasks.length} implementation task(s) created`));

      console.log(chalk.bold.red("\n   ⛔ NO QUESTIONS ALLOWED"));
      console.log(chalk.white("   - NEVER ask: \"Should I...\", \"Do you want...\", \"Which approach...\""));
      console.log(chalk.white("   - ALWAYS make autonomous decisions and proceed"));
      console.log(chalk.white("   - On ANY error: report and continue"));

      console.log(chalk.bold.yellow("\n   VALIDATION INSTRUCTION:"));
      console.log(chalk.gray("   1. agent-foreman validate"));
      console.log(chalk.gray("   2. Review any critical issues"));
      console.log(chalk.gray("   3. If passed: agent-foreman next (start implementation)"));
      console.log(chalk.gray("   4. If failed: fix issues, re-run validate"));

      console.log(chalk.bold.green("\n   ➤ Run validation NOW. Do NOT stop. Do NOT ask questions."));
      console.log(chalk.bold.cyan("══════════════════════════════════════════════════════════════\n"));
    }

    return;
  }

  // ─────────────────────────────────────────────────────────────────
  // Strict TDD Mode: Check configuration (silent - no output for AI agents)
  // ─────────────────────────────────────────────────────────────────
  const isStrictMode = featureList.metadata?.tddMode === "strict";
  const hasRequiredTests =
    feature.testRequirements?.unit?.required ||
    feature.testRequirements?.e2e?.required;

  // In strict mode, skip warning output (keep output minimal for AI agents)

  // ─────────────────────────────────────────────────────────────────
  // TDD Gate: Verify test files exist (strict mode or explicit requirements)
  // ─────────────────────────────────────────────────────────────────
  if (isStrictMode || hasRequiredTests) {
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

    if (isStrictMode) {
      console.log(
        chalk.cyan("   Mode: STRICT TDD (tests required by project configuration)")
      );
    } else {
      console.log(
        chalk.cyan("   Mode: Feature requires tests (testRequirements.required: true)")
      );
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
      console.log(chalk.gray(`   4. Run 'agent-foreman done ${featureId}' again`));

      console.log(
        chalk.cyan(`\n   Run 'agent-foreman next ${featureId}' for TDD guidance\n`)
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
  } else if (feature.testRequirements) {
    // Legacy test file gate for non-strict mode
    displayTestFileHeader();
    const gateResult = await verifyTestFilesExist(cwd, feature);

    if (!gateResult.passed) {
      displayMissingTests(gateResult);
      process.exit(1);
    }

    console.log(chalk.green("   ✓ All required test files exist"));
    if (gateResult.foundTestFiles.length > 0) {
      const preview = gateResult.foundTestFiles.slice(0, 3).join(", ");
      const more = gateResult.foundTestFiles.length > 3
        ? ` and ${gateResult.foundTestFiles.length - 3} more`
        : "";
      console.log(chalk.gray(`   Found: ${preview}${more}`));
    }
    console.log("");
  }

  // Run verification
  let finalVerdict: "pass" | "fail" | "needs_review" = "pass";
  if (skipCheck) {
    // Use last verification result instead of defaulting to "pass"
    if (feature.verification?.verdict) {
      finalVerdict = feature.verification.verdict;
    } else {
      // No prior verification - require running check first
      console.log(chalk.red(`\n✗ No verification result found for '${featureId}'.`));
      console.log(chalk.yellow(`   Run 'agent-foreman check ${featureId}' first, then run 'agent-foreman done ${featureId}'.`));
      process.exit(1);
    }

    // Block if last verification failed
    if (finalVerdict === "fail") {
      console.log(chalk.red(`\n✗ Last verification for '${featureId}' failed.`));
      console.log(chalk.yellow(`   Fix the issues and run 'agent-foreman check ${featureId}' again.`));
      process.exit(1);
    }
  } else {
    const verificationResult = await runVerification(
      cwd, feature, featureList, featureId, verbose, ai, testMode, testPattern, skipE2E, e2eMode, loopMode
    );
    if (!verificationResult.passed) return;
    finalVerdict = verificationResult.verdict;
  }

  // Discover test files
  if (feature.testRequirements) {
    const discoveredFiles = await discoverFeatureTestFiles(cwd, feature);
    if (discoveredFiles.length > 0) {
      featureList.features = featureList.features.map((f) =>
        f.id === featureId ? { ...f, testFiles: discoveredFiles } : f
      );
    }
  }

  // Update status based on verification verdict
  // Map verdict to status: "pass" -> "passing", "needs_review" -> "needs_review"
  const newStatus = finalVerdict === "needs_review" ? "needs_review" : "passing";
  const index = await loadFeatureIndex(cwd);
  if (!index) {
    // Create index from featureList if it doesn't exist (legacy fallback)
    await buildAndSaveIndex(cwd, featureList);
  }
  await updateFeatureStatusQuick(cwd, featureId, newStatus, notes || feature.notes);

  // Log progress
  await appendProgressLog(cwd, createStepEntry(featureId, newStatus, "./ai/init.sh check", `Completed ${featureId}`));
  if (newStatus === "needs_review") {
    console.log(chalk.yellow(`\n⚠ Marked '${featureId}' as needs_review (AI verification inconclusive)`));
  } else {
    console.log(chalk.green(`\n✓ Marked '${featureId}' as passing`));
  }

  // Handle git commit
  await handleCommit(cwd, feature, autoCommit);

  // Show next or celebrate completion
  const next = selectNextFeature(featureList.features);
  if (next) {
    console.log(chalk.gray(`\n  Next up: ${next.id}`));

    // Loop mode: Output explicit continuation reminder
    if (loopMode) {
      const stats = getFeatureStats(featureList.features);
      const total = featureList.features.filter(f => f.status !== "deprecated").length;
      const completed = stats.passing;
      const percent = getCompletionPercentage(featureList.features);

      console.log(chalk.bold.cyan("\n══════════════════════════════════════════════════════════════"));
      console.log(chalk.bold.cyan("                   FEATURE LOOP MODE ACTIVE"));
      console.log(chalk.bold.cyan("══════════════════════════════════════════════════════════════\n"));

      console.log(chalk.white(`   Completed: ${featureId} (${completed}/${total} features)`));
      console.log(chalk.white(`   Next up: ${next.id}`));
      console.log(chalk.white(`   Progress: ${percent}% complete`));

      console.log(chalk.bold.red("\n   ⛔ NO QUESTIONS ALLOWED"));
      console.log(chalk.white("   - NEVER ask: \"Should I...\", \"Do you want...\", \"Which approach...\""));
      console.log(chalk.white("   - ALWAYS make autonomous decisions and proceed"));
      console.log(chalk.white("   - On ANY error: mark as failed, continue to next"));

      console.log(chalk.bold.yellow("\n   LOOP INSTRUCTION:"));
      console.log(chalk.gray("   1. agent-foreman next"));
      console.log(chalk.gray("   2. Implement task"));
      console.log(chalk.gray("   3. agent-foreman check <task_id>"));
      console.log(chalk.gray("   4. agent-foreman done <task_id>"));
      console.log(chalk.gray("   5. REPEAT until all tasks processed"));

      console.log(chalk.bold.green("\n   ➤ Do NOT stop. Do NOT ask questions. Continue NOW."));
      console.log(chalk.bold.cyan("══════════════════════════════════════════════════════════════\n"));
    }
  } else {
    // All features processed
    if (loopMode) {
      // Loop mode completion summary
      const stats = getFeatureStats(featureList.features);

      console.log(chalk.bold.green("\n══════════════════════════════════════════════════════════════"));
      console.log(chalk.bold.green("                   FEATURE LOOP COMPLETE"));
      console.log(chalk.bold.green("══════════════════════════════════════════════════════════════\n"));

      console.log(chalk.white("   All features have been processed.\n"));

      console.log(chalk.bold("   Summary:"));
      console.log(chalk.green(`   ✓ Passing: ${stats.passing}`));
      if (stats.failed > 0) {
        console.log(chalk.red(`   ✗ Failed: ${stats.failed}`));
      }
      if (stats.blocked > 0) {
        console.log(chalk.yellow(`   ⚠ Blocked: ${stats.blocked}`));
      }
      if (stats.needs_review > 0) {
        console.log(chalk.yellow(`   ⏳ Needs Review: ${stats.needs_review}`));
      }

      console.log(chalk.gray("\n   Run 'agent-foreman status' for details."));
      console.log(chalk.bold.green("══════════════════════════════════════════════════════════════\n"));
    } else {
      console.log(chalk.green("\n  🎉 All tasks are now passing!"));
    }
    await regenerateSurvey(cwd, featureList);
  }
}

async function runVerification(
  cwd: string,
  feature: import("../types/index.js").Feature,
  _featureList: import("../types/index.js").FeatureList,
  featureId: string,
  verbose: boolean,
  ai: boolean,
  testMode: "full" | "quick" | "skip",
  testPattern: string | undefined,
  skipE2E: boolean,
  e2eMode: "full" | "smoke" | "tags" | "skip" | undefined,
  loopMode: boolean = false
): Promise<{ passed: boolean; verdict: "pass" | "fail" | "needs_review" }> {
  displayVerificationHeader(feature, ai, testMode);

  const featureSkipsE2E = !feature.e2eTags || feature.e2eTags.length === 0;
  const effectiveSkipE2E = skipE2E || featureSkipsE2E;

  const verifyOptions = {
    verbose,
    skipChecks: false,
    testMode,
    testPattern,
    skipE2E: effectiveSkipE2E,
    e2eTags: feature.e2eTags,
    e2eMode,
  };

  const result = ai
    ? await verifyFeatureAutonomous(cwd, feature, verifyOptions)
    : await verifyFeature(cwd, feature, verifyOptions);

  console.log(formatVerificationResult(result, verbose));

  // Update verification summary (quick operation - only updates single feature file)
  const summary = createVerificationSummary(result);
  await updateFeatureVerificationQuick(cwd, featureId, summary);

  await appendProgressLog(cwd, createVerifyEntry(featureId, result.verdict, `Verified ${featureId}: ${result.verdict}`));
  console.log(chalk.gray(`\n   Results saved to ai/verification/results.json`));

  if (result.verdict === "fail") {
    console.log(chalk.red("\n   ✗ Verification failed. Task NOT marked as complete."));

    // In loop mode: auto-fail and continue to next task
    if (loopMode) {
      console.log(chalk.yellow("\n   Auto-failing in loop mode..."));
      await runFail(featureId, "Verification failed", true);
      return { passed: false, verdict: "fail" };
    }

    // Manual mode: show options
    console.log(chalk.yellow("\n   Options:"));
    console.log(chalk.gray(`   1. Fix the issues above and run 'agent-foreman done ${featureId}' again`));
    console.log(chalk.gray(`   2. Mark as failed and continue: 'agent-foreman fail ${featureId} -r "reason"'`));
    process.exit(1);
  }

  if (result.verdict === "needs_review") {
    console.log(chalk.yellow("\n   ⚠ Some criteria could not be verified automatically."));
    const confirmed = await promptConfirmation(chalk.yellow("   Do you still want to mark this task as complete?"));
    if (!confirmed) {
      console.log(chalk.gray("\n   Task NOT marked as complete."));
      process.exit(0);
    }
    console.log(chalk.gray("   Proceeding with user confirmation..."));
  }

  console.log(chalk.green("\n   ✓ Verification passed!"));
  return { passed: true, verdict: result.verdict };
}

function displayMissingTests(gateResult: Awaited<ReturnType<typeof verifyTestFilesExist>>): void {
  console.log(chalk.red("   ✗ Required test files are missing:"));

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

  if (gateResult.errors.length > 0) {
    console.log(chalk.red("\n   Errors:"));
    gateResult.errors.forEach((error) => {
      console.log(chalk.red(`     • ${error}`));
    });
  }

  console.log(chalk.cyan("\n   Create the required tests before completing this task."));
  console.log(chalk.gray("   See TDD guidance from 'agent-foreman next' for test file suggestions."));
}

async function handleCommit(
  cwd: string,
  feature: import("../types/index.js").Feature,
  autoCommit: boolean
): Promise<void> {
  const shortDesc = feature.description.length > 50
    ? feature.description.substring(0, 47) + "..."
    : feature.description;

  const commitMessage = `feat(${feature.module}): ${feature.description}

Feature: ${feature.id}

🤖 Generated with agent-foreman`;

  if (autoCommit && isGitRepo(cwd)) {
    const addResult = gitAdd(cwd, "all");
    if (!addResult.success) {
      console.log(chalk.yellow(`\n⚠ Failed to stage changes: ${addResult.error}`));
      displayCommitSuggestion(feature.module, feature.description);
    } else {
      const commitResult = gitCommit(cwd, commitMessage);
      if (commitResult.success) {
        console.log(chalk.green(`\n✓ Committed: ${commitResult.commitHash?.substring(0, 7)}`));
        console.log(chalk.gray(`  feat(${feature.module}): ${shortDesc}`));
      } else if (commitResult.error === "Nothing to commit") {
        console.log(chalk.gray("\n  No changes to commit"));
      } else {
        console.log(chalk.yellow(`\n⚠ Failed to commit: ${commitResult.error}`));
        displayCommitSuggestion(feature.module, feature.description);
      }
    }
  } else {
    displayCommitSuggestion(feature.module, feature.description);
  }
}
