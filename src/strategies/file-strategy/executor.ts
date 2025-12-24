/**
 * File Strategy Executor
 * Main executor class for file verification strategy
 */

import type { Feature } from "../../types/index.js";
import type { FileVerificationStrategy, FileCheck } from "../../verifier/types/index.js";
import type { StrategyExecutor, StrategyResult } from "../../strategy-executor.js";

import type { FileCheckResult } from "./types.js";
import { validateAndResolvePath } from "./path-validation.js";
import { checkFile } from "./checks.js";
import { formatOutput } from "./output.js";

/**
 * File Strategy Executor
 * Verifies file existence, content patterns, size constraints, etc.
 */
export class FileStrategyExecutor implements StrategyExecutor<FileVerificationStrategy> {
  readonly type = "file" as const;

  /**
   * Execute file verification strategy
   *
   * @param cwd - Current working directory
   * @param strategy - The file strategy configuration
   * @param feature - The feature being verified
   * @returns Strategy execution result
   */
  async execute(
    cwd: string,
    strategy: FileVerificationStrategy,
    feature: Feature
  ): Promise<StrategyResult> {
    const startTime = Date.now();

    try {
      // Collect all paths to check
      const paths = this.collectPaths(strategy);

      if (paths.length === 0) {
        return {
          success: false,
          output: "No paths specified for file verification",
          duration: Date.now() - startTime,
          details: { reason: "no-paths" },
        };
      }

      // Resolve glob patterns and validate paths
      const resolvedPaths: string[] = [];
      for (const pathPattern of paths) {
        const pathValidation = await validateAndResolvePath(cwd, pathPattern);
        if (!pathValidation.valid) {
          return {
            success: false,
            output: pathValidation.error ?? "Path validation failed",
            duration: Date.now() - startTime,
            details: { reason: "security-violation", path: pathPattern },
          };
        }
        resolvedPaths.push(...pathValidation.paths!);
      }

      if (resolvedPaths.length === 0) {
        // If exists check is required and no files found, that's a failure
        const checks = this.collectChecks(strategy);
        const existsCheck = checks.find((c) => c.exists !== false);
        if (existsCheck) {
          return {
            success: false,
            output: `No files matched the pattern(s): ${paths.join(", ")}`,
            duration: Date.now() - startTime,
            details: { reason: "no-files-matched", patterns: paths },
          };
        }
        // If exists: false, having no files is acceptable
        return {
          success: true,
          output: `Verified no files exist matching: ${paths.join(", ")}`,
          duration: Date.now() - startTime,
          details: { patterns: paths, filesFound: 0 },
        };
      }

      // Get checks to apply
      const checks = this.collectChecks(strategy);

      // Apply checks to each file
      const results: FileCheckResult[] = [];
      for (const filePath of resolvedPaths) {
        const result = await checkFile(filePath, checks);
        results.push(result);
      }

      // Determine overall success
      const allPassed = results.every((r) => r.success);
      const output = formatOutput(results, paths);

      return {
        success: allPassed,
        output,
        duration: Date.now() - startTime,
        details: {
          filesChecked: resolvedPaths.length,
          patterns: paths,
          results: results.map((r) => ({
            path: r.path,
            success: r.success,
            checks: r.checks,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        output: `File verification failed: ${(error as Error).message}`,
        duration: Date.now() - startTime,
        details: {
          reason: "error",
          error: (error as Error).message,
        },
      };
    }
  }

  /**
   * Collect all paths from strategy (both single path and paths array)
   */
  private collectPaths(strategy: FileVerificationStrategy): string[] {
    const paths: string[] = [];

    if (strategy.path) {
      paths.push(strategy.path);
    }

    if (strategy.paths && strategy.paths.length > 0) {
      paths.push(...strategy.paths);
    }

    return paths;
  }

  /**
   * Collect all checks from strategy (both legacy and new format)
   */
  private collectChecks(strategy: FileVerificationStrategy): FileCheck[] {
    const checks: FileCheck[] = [];

    // Legacy format: single check from top-level properties
    if (
      strategy.exists !== undefined ||
      strategy.containsPattern !== undefined ||
      strategy.matchesContent !== undefined ||
      strategy.sizeConstraint !== undefined
    ) {
      checks.push({
        exists: strategy.exists,
        containsPattern: strategy.containsPattern,
        matchesContent: strategy.matchesContent,
        sizeConstraint: strategy.sizeConstraint,
      });
    }

    // New format: checks array
    if (strategy.checks && strategy.checks.length > 0) {
      checks.push(...strategy.checks);
    }

    // Default check: exists
    if (checks.length === 0) {
      checks.push({ exists: true });
    }

    return checks;
  }
}
