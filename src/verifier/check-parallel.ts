/**
 * Parallel check execution
 * Runs automated checks concurrently for faster verification
 */

import chalk from "chalk";

import type { AutomatedCheckResult } from "./types/index.js";
import type { CheckDefinition } from "./types.js";
import { runCheckWithEnv } from "./check-runner.js";
import { createProgressBar } from "../progress.js";

/**
 * Run checks in parallel using Promise.allSettled for fault tolerance
 * E2E tests are handled separately and run sequentially after unit tests pass
 */
export async function runChecksInParallel(
  cwd: string,
  checks: CheckDefinition[],
  verbose: boolean
): Promise<AutomatedCheckResult[]> {
  // Separate E2E checks from other checks
  const nonE2EChecks = checks.filter((c) => !c.isE2E);
  const e2eChecks = checks.filter((c) => c.isE2E);

  // Create progress bar for all checks
  const progressBar = createProgressBar("Running automated checks (parallel)", checks.length);
  progressBar.start();

  // CI environment variable for test frameworks
  const ciEnv: Record<string, string> = { CI: "true" };

  // Run non-E2E checks in parallel
  if (verbose) {
    console.log(chalk.blue(`   Running ${nonE2EChecks.length} checks in parallel...`));
  }

  progressBar.update(0, `Running ${nonE2EChecks.length} checks in parallel`);

  const parallelPromises = nonE2EChecks.map(async (check) => {
    const env = (check.type === "test" || check.type === "e2e") ? ciEnv : {};
    return {
      check,
      result: await runCheckWithEnv(cwd, check.type, check.command, env),
    };
  });

  const settledResults = await Promise.allSettled(parallelPromises);
  const results: AutomatedCheckResult[] = [];

  // Process results
  let completedCount = 0;
  for (const settled of settledResults) {
    completedCount++;
    if (settled.status === "fulfilled") {
      const { check, result } = settled.value;
      results.push(result);
      if (verbose) {
        const status = result.success ? chalk.green("passed") : chalk.red("failed");
        console.log(chalk.gray(`   ${check.name}: ${status}`));
      }
    } else {
      // Promise.allSettled captures rejections - create failed result
      const errorMessage = settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
      results.push({
        type: "test",
        success: false,
        output: `Check failed with error: ${errorMessage}`,
        duration: 0,
      });
    }
  }

  progressBar.update(completedCount, `Completed ${completedCount} checks`);

  // Check if unit tests passed before running E2E
  const unitTestsPassed = results
    .filter((r) => r.type === "test")
    .every((r) => r.success);

  // Run E2E checks sequentially after unit tests (if unit tests passed)
  if (e2eChecks.length > 0) {
    if (unitTestsPassed) {
      if (verbose) {
        console.log(chalk.blue(`   Running ${e2eChecks.length} E2E checks sequentially...`));
      }

      for (const check of e2eChecks) {
        progressBar.update(completedCount, `Running ${check.name}`);
        const result = await runCheckWithEnv(cwd, check.type, check.command, ciEnv);
        results.push(result);
        completedCount++;

        if (verbose) {
          const status = result.success ? chalk.green("passed") : chalk.red("failed");
          console.log(chalk.gray(`   ${check.name}: ${status}`));
        }
      }
    } else {
      // Skip E2E tests if unit tests failed
      if (verbose) {
        console.log(chalk.yellow(`   Skipping E2E tests (unit tests failed)`));
      }
      for (const check of e2eChecks) {
        results.push({
          type: "e2e",
          success: false,
          output: "Skipped: unit tests failed",
          duration: 0,
        });
        completedCount++;
      }
    }
  }

  progressBar.complete("Automated checks complete (parallel)");
  return results;
}
