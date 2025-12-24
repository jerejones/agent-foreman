/**
 * 'status' command implementation
 * Show current task/feature harness status
 */
import chalk from "chalk";

import {
  loadFeatureList,
  selectNextFeature,
  selectNextFeatureQuick,
  getFeatureStats,
  getCompletionPercentage,
} from "../features/index.js";
import { loadFeatureIndex } from "../storage/index.js";
import { getRecentEntries } from "../progress-log.js";

/**
 * Run the status command
 */
export async function runStatus(
  outputJson: boolean = false,
  quiet: boolean = false
): Promise<void> {
  const cwd = process.cwd();

  // Try to use quick operations if index exists
  const index = await loadFeatureIndex(cwd);

  const featureList = await loadFeatureList(cwd);
  if (!featureList) {
    if (outputJson) {
      console.log(JSON.stringify({ error: "No task list found" }));
    } else {
      console.log(chalk.red("✗ No task list found. Run 'agent-foreman init <goal>' first."));
    }
    return;
  }

  // Always use loaded features for stats to ensure consistency
  // (index.json may be out of sync with actual task files)
  const stats = getFeatureStats(featureList.features);

  // Use quick operations for next selection when index is available
  let next;
  if (index) {
    next = await selectNextFeatureQuick(cwd);
  } else {
    next = selectNextFeature(featureList.features);
  }
  const completion = getCompletionPercentage(featureList.features);
  const recentEntries = await getRecentEntries(cwd, 5);

  // JSON output mode
  if (outputJson) {
    const output = {
      goal: featureList.metadata?.projectGoal ?? "(no goal set)",
      updatedAt: featureList.metadata?.updatedAt ?? null,
      stats: {
        passing: stats.passing,
        failing: stats.failing,
        failed: stats.failed,
        needsReview: stats.needs_review,
        blocked: stats.blocked,
        deprecated: stats.deprecated,
        total: featureList.features.length,
      },
      completion,
      recentActivity: recentEntries.map((e) => ({
        type: e.type,
        timestamp: e.timestamp,
        summary: e.summary,
      })),
      nextFeature: next
        ? { id: next.id, description: next.description, status: next.status }
        : null,
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Quiet mode - minimal output
  if (quiet) {
    console.log(`${completion}% complete | ${stats.passing}/${featureList.features.length} passing`);
    if (next) {
      console.log(`Next: ${next.id}`);
    }
    return;
  }

  // Normal output
  const projectGoal = featureList.metadata?.projectGoal ?? "(no goal set)";
  const lastUpdated = featureList.metadata?.updatedAt ?? "unknown";

  console.log("");
  console.log(chalk.bold.blue("📊 Project Status"));
  console.log(chalk.gray(`   Goal: ${projectGoal}`));
  console.log(chalk.gray(`   Last updated: ${lastUpdated}`));
  console.log("");

  console.log(chalk.bold("   Task Status:"));
  console.log(chalk.green(`   ✓ Passing: ${stats.passing}`));
  console.log(chalk.yellow(`   ⚠ Needs Review: ${stats.needs_review}`));
  console.log(chalk.red(`   ✗ Failing: ${stats.failing}`));
  console.log(chalk.red(`   ⚡ Failed: ${stats.failed}`));
  console.log(chalk.gray(`   ⏸ Blocked: ${stats.blocked}`));
  console.log(chalk.gray(`   ⊘ Deprecated: ${stats.deprecated}`));
  console.log("");

  // Progress bar
  const barWidth = 30;
  const filledWidth = Math.round((completion / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;
  const progressBar = chalk.green("█".repeat(filledWidth)) + chalk.gray("░".repeat(emptyWidth));
  console.log(chalk.bold(`   Completion: [${progressBar}] ${completion}%`));
  console.log("");

  // Recent activity
  if (recentEntries.length > 0) {
    console.log(chalk.bold("   Recent Activity:"));
    for (const entry of recentEntries) {
      const typeColor =
        entry.type === "INIT"
          ? chalk.blue
          : entry.type === "STEP"
            ? chalk.green
            : entry.type === "CHANGE"
              ? chalk.yellow
              : chalk.magenta;
      console.log(
        chalk.gray(`   ${entry.timestamp.substring(0, 10)} `) +
          typeColor(`[${entry.type}]`) +
          chalk.white(` ${entry.summary}`)
      );
    }
    console.log("");
  }

  // Next feature
  if (next) {
    console.log(chalk.bold("   Next Up:"));
    console.log(chalk.white(`   → ${next.id}: ${next.description}`));
    console.log("");
  }
}
