/**
 * 'next' command implementation
 * Show next task/feature to work on or specific task details
 */
import chalk from "chalk";

import {
  loadFeatureList,
  selectNextFeatureWithBlocking,
  selectNextFeatureQuickWithBlocking,
  findFeatureById,
  getFeatureStats,
  getCompletionPercentage,
  isBreakdownTask,
  type SelectionResult,
} from "../features/index.js";
import { loadFeatureIndex } from "../storage/index.js";
import { detectCapabilities } from "../capabilities/index.js";
import { isGitRepo, hasUncommittedChanges } from "../git-utils.js";
import { generateTDDGuidance, type TDDGuidance } from "../tdd-guidance/index.js";
import type { Feature } from "../types/index.js";
import {
  displayExternalMemorySync,
  displayFeatureInfo,
  displayTDDGuidance,
  displayBreakdownContext,
  displayValidationPhaseReminder,
} from "./next-display.js";

/**
 * Run the next command
 */
export async function runNext(
  featureId: string | undefined,
  dryRun: boolean,
  runCheck: boolean = false,
  allowDirty: boolean = false,
  outputJson: boolean = false,
  quiet: boolean = false,
  refreshGuidance: boolean = false
): Promise<void> {
  const cwd = process.cwd();

  // Clean Working Directory Check (PRD requirement)
  if (!allowDirty && isGitRepo(cwd) && hasUncommittedChanges(cwd)) {
    if (outputJson) {
      console.log(JSON.stringify({ error: "Working directory not clean" }));
    } else {
      console.log(chalk.red("\n✗ Working directory is not clean."));
      console.log(chalk.yellow("  You have uncommitted changes. Before starting a new task:"));
      console.log(chalk.white("  • Commit your changes: git add -A && git commit -m \"...\""));
      console.log(chalk.white("  • Or stash them: git stash"));
      console.log(chalk.gray("\n  Use --allow-dirty to bypass this check."));
    }
    process.exit(1);
  }

  // Load feature list
  const featureList = await loadFeatureList(cwd);
  if (!featureList) {
    if (outputJson) {
      console.log(JSON.stringify({ error: "No task list found" }));
    } else {
      console.log(chalk.red("✗ No task list found. Run 'agent-foreman init' first."));
    }
    process.exit(1);
  }

  // Select feature (with BREAKDOWN-first enforcement)
  let feature: Feature | undefined;
  let selectionResult: SelectionResult | undefined;
  const index = await loadFeatureIndex(cwd);

  if (featureId) {
    // Specific task requested - bypass BREAKDOWN blocking
    feature = findFeatureById(featureList.features, featureId);
    if (!feature) {
      if (outputJson) {
        console.log(JSON.stringify({ error: `Task '${featureId}' not found` }));
      } else {
        console.log(chalk.red(`✗ Task '${featureId}' not found.`));
      }
      process.exit(1);
    }
  } else {
    // Auto-selection with BREAKDOWN-first enforcement
    if (index) {
      selectionResult = await selectNextFeatureQuickWithBlocking(cwd);
    } else {
      selectionResult = selectNextFeatureWithBlocking(featureList.features);
    }
    feature = selectionResult.feature ?? undefined;

    if (!feature) {
      if (outputJson) {
        console.log(JSON.stringify({ complete: true, message: "All tasks passing" }));
      } else {
        console.log(chalk.green("🎉 All tasks are passing or blocked. Nothing to do!"));
      }
      return;
    }
  }

  // JSON output mode
  if (outputJson) {
    await outputJsonMode(cwd, feature, featureList.features, selectionResult);
    return;
  }

  // Quiet mode
  if (quiet) {
    outputQuietMode(feature);
    return;
  }

  // Full display mode
  const stats = getFeatureStats(featureList.features);
  const completion = getCompletionPercentage(featureList.features);

  await displayExternalMemorySync(cwd, stats, completion, runCheck);

  await displayFeatureInfo(cwd, feature, dryRun);

  // Check if this is a BREAKDOWN task
  if (isBreakdownTask(feature.id)) {
    // Display enhanced spec context for BREAKDOWN tasks
    await displayBreakdownContext(cwd, feature, featureList.features);
  } else {
    // Check if transitioning from BREAKDOWN phase to implementation phase
    // Show validation reminder if all BREAKDOWNs are complete
    displayValidationPhaseReminder(feature, featureList.features);

    // Normal TDD guidance for implementation tasks
    await displayTDDGuidance(cwd, feature, refreshGuidance, featureList.metadata);
  }
}

/**
 * Output feature data as JSON
 */
async function outputJsonMode(
  cwd: string,
  feature: Feature,
  features: Feature[],
  selectionResult?: SelectionResult
): Promise<void> {
  const stats = getFeatureStats(features);
  const completion = getCompletionPercentage(features);

  // Generate TDD guidance (suppress console output)
  let tddGuidance: TDDGuidance | null = null;
  try {
    const originalLog = console.log;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    console.log = () => {};
    try {
      const capabilities = await detectCapabilities(cwd, { verbose: false });
      tddGuidance = generateTDDGuidance(feature, capabilities, cwd);
    } finally {
      console.log = originalLog;
    }
  } catch {
    // Ignore errors
  }

  const output = {
    feature: {
      id: feature.id,
      description: feature.description,
      module: feature.module,
      priority: feature.priority,
      status: feature.status,
      acceptance: feature.acceptance,
      dependsOn: feature.dependsOn,
      notes: feature.notes || null,
    },
    stats: {
      passing: stats.passing,
      failing: stats.failing,
      needsReview: stats.needs_review,
      total: features.length,
    },
    completion,
    cwd,
    tddGuidance,
    // Include BREAKDOWN blocking info if present
    ...(selectionResult?.blockedBy && {
      blockedBy: {
        type: selectionResult.blockedBy.type,
        count: selectionResult.blockedBy.count,
        ids: selectionResult.blockedBy.ids,
      },
    }),
  };
  console.log(JSON.stringify(output, null, 2));
}

/**
 * Output feature in quiet mode
 */
function outputQuietMode(feature: Feature): void {
  console.log(`Task: ${feature.id}`);
  console.log(`Description: ${feature.description}`);
  console.log(`Status: ${feature.status}`);
  console.log(`Acceptance:`);
  feature.acceptance.forEach((a, i) => console.log(`  ${i + 1}. ${a}`));
}
