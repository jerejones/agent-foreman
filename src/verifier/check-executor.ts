/**
 * Automated check execution
 * Orchestrates running tests, type checks, lint, and build commands
 */

import chalk from "chalk";

import type { VerificationCapabilities, AutomatedCheckResult } from "./types/index.js";
import type { AutomatedCheckOptions, CheckDefinition } from "./types.js";
import {
  buildE2ECommand,
  determineE2EMode,
  type E2EMode,
} from "../testing/index.js";
import { createProgressBar, createSpinner } from "../progress.js";
import { runCheck, runCheckWithEnv } from "./check-runner.js";
import { runChecksInParallel } from "./check-parallel.js";

// Re-export core check functions
export { runCheck, runCheckWithEnv } from "./check-runner.js";
export { runChecksInParallel } from "./check-parallel.js";

/**
 * Run all available automated checks
 */
export async function runAutomatedChecks(
  cwd: string,
  capabilities: VerificationCapabilities,
  optionsOrVerbose: boolean | AutomatedCheckOptions = false
): Promise<AutomatedCheckResult[]> {
  // Handle backward compatibility with boolean verbose parameter
  const options: AutomatedCheckOptions =
    typeof optionsOrVerbose === "boolean"
      ? { verbose: optionsOrVerbose }
      : optionsOrVerbose;

  const {
    verbose = false,
    testMode = "full",
    selectiveTestCommand,
    testDiscovery,
    skipE2E = false,
    e2eInfo,
    e2eTags = [],
    e2eMode: explicitE2EMode,
    parallel = false,
    skipBuild = false,
  } = options;
  const results: AutomatedCheckResult[] = [];

  // Collect checks to run
  const checks: CheckDefinition[] = [];

  // Handle test execution based on mode
  if (testMode !== "skip" && capabilities.hasTests && capabilities.testCommand) {
    if (testMode === "quick" && selectiveTestCommand) {
      // Use selective test command for quick mode
      const testName = testDiscovery?.testFiles.length
        ? `selective tests (${testDiscovery.testFiles.length} files)`
        : "selective tests";
      checks.push({ type: "test", command: selectiveTestCommand, name: testName });

      if (verbose && testDiscovery) {
        console.log(chalk.gray(`   Test discovery: ${testDiscovery.source}`));
        if (testDiscovery.testFiles.length > 0) {
          console.log(chalk.gray(`   Test files: ${testDiscovery.testFiles.join(", ")}`));
        }
      }
    } else {
      // Full test mode - run all tests
      checks.push({ type: "test", command: capabilities.testCommand, name: "tests" });
    }
  }

  if (capabilities.hasTypeCheck && capabilities.typeCheckCommand) {
    checks.push({ type: "typecheck", command: capabilities.typeCheckCommand, name: "type check" });
  }
  if (capabilities.hasLint && capabilities.lintCommand) {
    checks.push({ type: "lint", command: capabilities.lintCommand, name: "linter" });
  }
  if (capabilities.hasBuild && capabilities.buildCommand && !skipBuild) {
    checks.push({ type: "build", command: capabilities.buildCommand, name: "build" });
  }

  // Handle E2E test execution (runs after unit tests)
  if (!skipE2E && e2eInfo?.available && e2eInfo.command) {
    // Use explicit E2E mode if provided, otherwise derive from testMode and tags
    const e2eMode: E2EMode = explicitE2EMode ?? determineE2EMode(testMode, e2eTags.length > 0);
    const e2eCommand = buildE2ECommand(e2eInfo, e2eTags, e2eMode);

    if (e2eCommand) {
      const e2eName = e2eMode === "full"
        ? "E2E tests (full)"
        : e2eMode === "smoke"
          ? "E2E tests (@smoke)"
          : `E2E tests (${e2eTags.join(", ")})`;
      checks.push({ type: "e2e", command: e2eCommand, name: e2eName, isE2E: true });

      if (verbose) {
        console.log(chalk.gray(`   E2E mode: ${e2eMode}`));
        if (e2eTags.length > 0) {
          console.log(chalk.gray(`   E2E tags: ${e2eTags.join(", ")}`));
        }
      }
    }
  } else if (skipE2E && verbose) {
    console.log(chalk.gray(`   E2E tests: skipped (--skip-e2e)`));
  }

  if (checks.length === 0) {
    return results;
  }

  // ========================================================================
  // Parallel Mode: Run checks concurrently (except E2E which is sequential)
  // ========================================================================
  if (parallel) {
    if (verbose) {
      console.log(chalk.blue(`   Parallel mode enabled`));
    }
    return runChecksInParallel(cwd, checks, verbose);
  }

  // ========================================================================
  // Sequential Mode: Run checks one by one (default for backward compatibility)
  // ========================================================================

  // Create progress bar for checks
  const progressBar = createProgressBar("Running automated checks", checks.length);
  progressBar.start();

  for (let i = 0; i < checks.length; i++) {
    const check = checks[i];
    progressBar.update(i, `Running ${check.name}`);

    const spinner = verbose ? createSpinner(`Running ${check.name}`) : null;
    // CI=true disables watch mode in Vitest/Jest and ensures proper CI behavior in Playwright
    const ciEnv: Record<string, string> = (check.type === "test" || check.type === "e2e") ? { CI: "true" } : {};
    const result = await runCheckWithEnv(cwd, check.type, check.command, ciEnv);
    results.push(result);

    if (spinner) {
      if (result.success) {
        spinner.succeed(`${check.name} passed`);
      } else {
        spinner.fail(`${check.name} failed`);
      }
    }
  }

  progressBar.complete("Automated checks complete");
  return results;
}
