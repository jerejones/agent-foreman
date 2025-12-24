/**
 * 'fail' command implementation
 * Mark a task/feature as failed with a reason
 */
import chalk from "chalk";

import {
  loadFeatureList,
  findFeatureById,
  updateFeatureStatus,
  buildAndSaveIndex,
  updateFeatureStatusQuick,
} from "../features/index.js";
import { loadFeatureIndex } from "../storage/index.js";
import {
  appendProgressLog,
  createVerifyEntry,
} from "../progress-log.js";

/**
 * Run the fail command
 */
export async function runFail(
  featureId: string,
  reason?: string,
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

  // Check if already failed
  if (feature.status === "failed") {
    console.log(chalk.yellow(`⚠ Task '${featureId}' is already marked as failed.`));
    if (feature.notes) {
      console.log(chalk.gray(`  Previous reason: ${feature.notes}`));
    }
    process.exit(0);
  }

  // Build notes with reason
  const notes = reason
    ? `Verification failed: ${reason}`
    : feature.notes
      ? `${feature.notes} | Marked as failed`
      : "Marked as failed";

  // Update status to failed
  const index = await loadFeatureIndex(cwd);
  if (!index) {
    // Create index from featureList if it doesn't exist (legacy fallback)
    await buildAndSaveIndex(cwd, featureList);
  }
  await updateFeatureStatusQuick(cwd, featureId, "failed", notes);
  // Also update in-memory list for selectNextFeature/getFeatureStats
  featureList.features = updateFeatureStatus(featureList.features, featureId, "failed", notes);

  // Log progress
  await appendProgressLog(cwd, createVerifyEntry(featureId, "fail", `Marked ${featureId} as failed: ${reason || "No reason provided"}`));

  console.log(chalk.red(`\n✗ Marked '${featureId}' as failed`));
  if (reason) {
    console.log(chalk.gray(`  Reason: ${reason}`));
  }

  // Loop mode: show continuation instructions
  if (loopMode) {
    const { selectNextFeature, getFeatureStats, getCompletionPercentage } = await import("../features/index.js");
    const next = selectNextFeature(featureList.features);

    if (next) {
      const stats = getFeatureStats(featureList.features);
      const total = featureList.features.filter(f => f.status !== "deprecated").length;
      const percent = getCompletionPercentage(featureList.features);

      console.log(chalk.bold.cyan("\n══════════════════════════════════════════════════════════════"));
      console.log(chalk.bold.cyan("                   CONTINUE TO NEXT TASK"));
      console.log(chalk.bold.cyan("══════════════════════════════════════════════════════════════\n"));

      console.log(chalk.white(`   Failed: ${featureId}`));
      console.log(chalk.white(`   Next up: ${next.id}`));
      console.log(chalk.white(`   Progress: ${stats.passing}/${total} passing (${percent}%)`));
      if (stats.failed > 0) {
        console.log(chalk.red(`   Failed tasks: ${stats.failed}`));
      }

      console.log(chalk.bold.yellow("\n   LOOP INSTRUCTION:"));
      console.log(chalk.gray("   1. agent-foreman next"));
      console.log(chalk.gray("   2. Implement task"));
      console.log(chalk.gray("   3. agent-foreman check <task_id>"));
      console.log(chalk.gray("   4. agent-foreman done <task_id>"));
      console.log(chalk.gray("   5. REPEAT until all tasks processed"));

      console.log(chalk.bold.green("\n   ➤ Continue to the next task NOW."));
      console.log(chalk.bold.cyan("══════════════════════════════════════════════════════════════\n"));
    } else {
      console.log(chalk.gray("\n  No more tasks to process."));
      console.log(chalk.gray("  Run 'agent-foreman status' for summary."));
    }
  }
}
