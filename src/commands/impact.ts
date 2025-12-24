/**
 * 'impact' command implementation
 * Analyze impact of changes to a task/feature
 */
import chalk from "chalk";

import { loadFeatureList, findFeatureById } from "../features/index.js";

/**
 * Run the impact command
 */
export async function runImpact(featureId: string): Promise<void> {
  const cwd = process.cwd();

  const featureList = await loadFeatureList(cwd);
  if (!featureList) {
    console.log(chalk.red("✗ No task list found."));
    return;
  }

  const feature = findFeatureById(featureList.features, featureId);
  if (!feature) {
    console.log(chalk.red(`✗ Task '${featureId}' not found.`));
    return;
  }

  // Find dependent tasks
  const dependents = featureList.features.filter((f) => f.dependsOn.includes(featureId));

  // Find same-module tasks
  const sameModule = featureList.features.filter(
    (f) => f.module === feature.module && f.id !== featureId && f.status !== "deprecated"
  );

  console.log("");
  console.log(chalk.bold.blue(`🔍 Impact Analysis: ${featureId}`));
  console.log("");

  if (dependents.length > 0) {
    console.log(chalk.bold.yellow("   ⚠ Directly Affected Tasks:"));
    for (const f of dependents) {
      console.log(chalk.yellow(`   → ${f.id} (${f.status}) - depends on this task`));
    }
    console.log("");
  }

  if (sameModule.length > 0) {
    console.log(chalk.bold.gray("   📁 Same Module (review recommended):"));
    for (const f of sameModule.slice(0, 10)) {
      console.log(chalk.gray(`   → ${f.id} (${f.status})`));
    }
    if (sameModule.length > 10) {
      console.log(chalk.gray(`   ... and ${sameModule.length - 10} more`));
    }
    console.log("");
  }

  if (dependents.length === 0 && sameModule.length === 0) {
    console.log(chalk.green("   ✓ No other tasks appear to be affected"));
    console.log("");
  }

  // Recommendations - always show when there are affected tasks
  if (dependents.length > 0 || sameModule.length > 0) {
    console.log(chalk.bold("   💡 Recommendations:"));
    let recNum = 1;
    if (dependents.length > 0) {
      console.log(chalk.white(`   ${recNum++}. Review and test dependent tasks (highest priority)`));
      console.log(chalk.white(`   ${recNum++}. Mark uncertain dependent tasks as 'needs_review'`));
    }
    if (sameModule.length > 0) {
      console.log(chalk.white(`   ${recNum++}. Consider reviewing same-module tasks for side effects`));
    }
    console.log(chalk.white(`   ${recNum++}. Update task notes with impact details`));
    console.log(chalk.white(`   ${recNum++}. Run 'agent-foreman check <task_id>' to verify affected tasks`));
    console.log("");
  }
}
