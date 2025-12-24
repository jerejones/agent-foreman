/**
 * TDD command - View or change TDD mode configuration
 */

import chalk from "chalk";

import { loadFeatureList } from "../features/index.js";
import { loadFeatureIndex, saveFeatureIndex } from "../storage/index.js";
import {
  appendProgressLog,
  createChangeEntry,
} from "../progress-log.js";

export type TDDMode = "strict" | "recommended" | "disabled";

/**
 * Run the tdd command
 * @param mode - TDD mode to set (or undefined to just show current mode)
 */
export async function runTDD(mode?: string): Promise<void> {
  const cwd = process.cwd();

  const featureList = await loadFeatureList(cwd);
  if (!featureList) {
    console.log(chalk.red("✗ No task list found. Run 'agent-foreman init' first."));
    process.exit(1);
  }

  const currentMode = featureList.metadata.tddMode || "recommended";

  // If no mode specified, show current mode
  if (!mode) {
    console.log(chalk.bold("\n📋 TDD Configuration\n"));
    console.log(chalk.white(`   Current mode: ${formatMode(currentMode)}`));
    console.log("");
    console.log(chalk.gray("   Available modes:"));
    console.log(chalk.gray("   • strict      - Tests REQUIRED, TDD workflow mandatory"));
    console.log(chalk.gray("   • recommended - Tests suggested, TDD workflow optional (default)"));
    console.log(chalk.gray("   • disabled    - No TDD guidance"));
    console.log("");
    console.log(chalk.gray("   Usage: agent-foreman tdd <mode>"));
    console.log(chalk.gray("   Example: agent-foreman tdd strict"));
    return;
  }

  // Validate mode
  const validModes: TDDMode[] = ["strict", "recommended", "disabled"];
  if (!validModes.includes(mode as TDDMode)) {
    console.log(chalk.red(`✗ Invalid TDD mode: '${mode}'`));
    console.log(chalk.gray("   Valid modes: strict, recommended, disabled"));
    process.exit(1);
  }

  const newMode = mode as TDDMode;

  // Check if already set
  if (currentMode === newMode) {
    console.log(chalk.yellow(`⚠ TDD mode is already '${newMode}'`));
    return;
  }

  // Update only index.json metadata (don't touch task MD files)
  const index = await loadFeatureIndex(cwd);
  if (index) {
    index.metadata.tddMode = newMode;
    index.metadata.updatedAt = new Date().toISOString();
    await saveFeatureIndex(cwd, index);
  }

  // Log change
  await appendProgressLog(
    cwd,
    createChangeEntry(
      "tdd-mode",
      "config",
      `Changed TDD mode from '${currentMode}' to '${newMode}'`
    )
  );

  console.log(chalk.green(`\n✓ TDD mode changed: ${formatMode(currentMode)} → ${formatMode(newMode)}\n`));

  // Show implications
  if (newMode === "strict") {
    console.log(chalk.bold.red("   ⚠ STRICT MODE ACTIVE"));
    console.log(chalk.white("   • Tests are REQUIRED for all tasks"));
    console.log(chalk.white("   • check/done will FAIL without test files"));
    console.log(chalk.white("   • MUST follow TDD: RED → GREEN → REFACTOR"));
  } else if (newMode === "recommended") {
    console.log(chalk.bold.yellow("   📋 RECOMMENDED MODE"));
    console.log(chalk.white("   • Tests are suggested but not required"));
    console.log(chalk.white("   • TDD guidance shown in 'next' output"));
    console.log(chalk.white("   • Tasks can complete without tests"));
  } else {
    console.log(chalk.bold.gray("   ○ TDD DISABLED"));
    console.log(chalk.white("   • No TDD guidance shown"));
    console.log(chalk.white("   • No test requirements enforced"));
  }
  console.log("");
}

function formatMode(mode: string): string {
  switch (mode) {
    case "strict":
      return chalk.red("strict");
    case "recommended":
      return chalk.yellow("recommended");
    case "disabled":
      return chalk.gray("disabled");
    default:
      return mode;
  }
}
