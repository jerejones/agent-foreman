/**
 * Init command - Initialize or upgrade the long-task harness
 */

import chalk from "chalk";

import type { InitMode } from "../types.js";
import { isGitRepo, gitInit } from "../git-utils.js";
import {
  detectAndAnalyzeProject,
  mergeOrCreateFeatures,
  generateHarnessFiles,
} from "../init-helpers.js";

/**
 * Initialize the agent-foreman harness
 * Refactored to use helper functions for better maintainability
 */
export async function runInit(goal: string, mode: InitMode, verbose: boolean): Promise<void> {
  const cwd = process.cwd();
  console.log(chalk.blue(`🚀 Initializing harness (mode: ${mode})...`));

  // Step 0: Ensure git repository exists (required for agent-foreman)
  if (!isGitRepo(cwd)) {
    console.log(chalk.yellow("  Not a git repository, initializing..."));
    const initResult = gitInit(cwd);
    if (!initResult.success) {
      console.log(chalk.red(`✗ Failed to initialize git: ${initResult.error}`));
      process.exit(1);
    }
    console.log(chalk.green("✓ Git repository initialized"));
  }

  // Step 1: Detect project type and analyze with AI
  // Note: Don't use spinner here as detectAndAnalyzeProject has its own progress indicators
  console.log(chalk.gray("  Analyzing project..."));
  const analysisResult = await detectAndAnalyzeProject(cwd, goal, verbose);

  if (!analysisResult.success || !analysisResult.survey) {
    console.log(chalk.red(`✗ AI analysis failed: ${analysisResult.error}`));
    console.log(chalk.yellow("  Make sure gemini, codex, or claude CLI is installed"));
    process.exit(1);
  }

  console.log(chalk.green(`✓ AI analysis successful (agent: ${analysisResult.agentUsed})`));

  if (verbose) {
    console.log(chalk.gray(`  Found ${analysisResult.survey.features.length} features`));
  }

  // Step 2-4: Merge or create features based on mode
  const featureList = await mergeOrCreateFeatures(
    cwd,
    analysisResult.survey,
    goal,
    mode,
    verbose
  );

  // Step 5-8: Generate harness files (init.sh, CLAUDE.md, progress.log)
  await generateHarnessFiles(cwd, analysisResult.survey, featureList, goal, mode);

  console.log(chalk.bold.green("\n🎉 Harness initialized successfully!"));
  console.log(chalk.gray("Next: Run 'agent-foreman next' to start working on features"));
}
