/**
 * Impact command - Analyze impact of changes to a feature
 */

import chalk from "chalk";

import { loadFeatureList, findFeatureById } from "../feature-list.js";

/**
 * Run the impact command
 */
export async function runImpact(featureId: string): Promise<void> {
  const cwd = process.cwd();

  const featureList = await loadFeatureList(cwd);
  if (!featureList) {
    console.log(chalk.red("✗ No feature list found."));
    return;
  }

  const feature = findFeatureById(featureList.features, featureId);
  if (!feature) {
    console.log(chalk.red(`✗ Feature '${featureId}' not found.`));
    return;
  }

  // Find dependent features
  const dependents = featureList.features.filter((f) => f.dependsOn.includes(featureId));

  // Find same-module features
  const sameModule = featureList.features.filter(
    (f) => f.module === feature.module && f.id !== featureId && f.status !== "deprecated"
  );

  console.log("");
  console.log(chalk.bold.blue(`🔍 Impact Analysis: ${featureId}`));
  console.log("");

  if (dependents.length > 0) {
    console.log(chalk.bold.yellow("   ⚠ Directly Affected Features:"));
    for (const f of dependents) {
      console.log(chalk.yellow(`   → ${f.id} (${f.status}) - depends on this feature`));
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
    console.log(chalk.green("   ✓ No other features appear to be affected"));
    console.log("");
  }

  // Recommendations
  if (dependents.length > 0) {
    console.log(chalk.bold("   Recommendations:"));
    console.log(chalk.white("   1. Review and test dependent features"));
    console.log(chalk.white("   2. Mark uncertain features as 'needs_review'"));
    console.log(chalk.white("   3. Update feature notes with impact details"));
    console.log("");
  }
}
