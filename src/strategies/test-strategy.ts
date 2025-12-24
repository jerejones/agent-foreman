/**
 * Test Verification Strategy Executor
 * Executes unit/integration tests for feature verification
 * Phase 3 of Universal Verification Strategy RFC
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

import type { Feature } from "../types/index.js";
import type { TestVerificationStrategy } from "../verifier/types/index.js";
import type { StrategyExecutor, StrategyResult } from "../strategy-executor.js";
import { defaultRegistry } from "../strategy-executor.js";
import { detectCapabilities } from "../capabilities/index.js";

const execAsync = promisify(exec);

/** Default timeout for test execution (60 seconds) */
const DEFAULT_TIMEOUT = 60000;

/**
 * Test Strategy Executor
 * Runs unit/integration tests using the project's test framework
 */
export class TestStrategyExecutor implements StrategyExecutor<TestVerificationStrategy> {
  readonly type = "test" as const;

  /**
   * Execute test verification strategy
   *
   * @param cwd - Current working directory
   * @param strategy - The test strategy configuration
   * @param feature - The feature being verified
   * @returns Strategy execution result
   */
  async execute(
    cwd: string,
    strategy: TestVerificationStrategy,
    feature: Feature
  ): Promise<StrategyResult> {
    const startTime = Date.now();
    const timeout = strategy.timeout ?? DEFAULT_TIMEOUT;

    try {
      // Detect project capabilities to get test command
      const capabilities = await detectCapabilities(cwd, { verbose: false });

      if (!capabilities.hasTests || !capabilities.testCommand) {
        return {
          success: false,
          output: "No test framework detected in project",
          duration: Date.now() - startTime,
          details: { reason: "no-test-framework" },
        };
      }

      // Build test command
      let command = capabilities.testCommand;

      // Support selective test execution via pattern
      if (strategy.pattern) {
        command = this.buildSelectiveCommand(capabilities.testCommand, strategy.pattern, strategy.framework);
      }

      // Add test case filter if cases are specified
      if (strategy.cases && strategy.cases.length > 0) {
        command = this.addCaseFilter(command, strategy.cases, strategy.framework);
      }

      // Prepare environment
      const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        CI: "true", // Ensure CI mode for consistent behavior
        ...(strategy.env ?? {}),
      };

      // Execute tests
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout,
        env,
        maxBuffer: 5 * 1024 * 1024, // 5MB buffer
      });

      const output = stdout + (stderr ? `\n${stderr}` : "");
      const duration = Date.now() - startTime;

      return {
        success: true,
        output,
        duration,
        details: {
          command,
          pattern: strategy.pattern,
          cases: strategy.cases,
        },
      };
    } catch (error) {
      const execError = error as {
        stdout?: string;
        stderr?: string;
        code?: number;
        killed?: boolean;
        signal?: string;
      };

      const output = (execError.stdout ?? "") + (execError.stderr ?? "");
      const duration = Date.now() - startTime;

      // Check if it was a timeout
      if (execError.killed || execError.signal === "SIGTERM") {
        return {
          success: false,
          output: `Test execution timed out after ${timeout}ms\n${output}`,
          duration,
          details: {
            reason: "timeout",
            timeout,
          },
        };
      }

      return {
        success: false,
        output: output || (error as Error).message,
        duration,
        details: {
          exitCode: execError.code,
          pattern: strategy.pattern,
          cases: strategy.cases,
        },
      };
    }
  }

  /**
   * Build selective test command based on pattern and framework
   */
  private buildSelectiveCommand(
    baseCommand: string,
    pattern: string,
    framework?: string
  ): string {
    // Detect framework from base command if not specified
    const detectedFramework = framework ?? this.detectFramework(baseCommand);

    switch (detectedFramework) {
      case "vitest":
        return `${baseCommand} ${pattern}`;
      case "jest":
        return `${baseCommand} --testPathPattern="${pattern}"`;
      case "mocha":
        return `${baseCommand} "${pattern}"`;
      case "pytest":
        return `${baseCommand} ${pattern}`;
      case "go":
        return `${baseCommand} -run "${pattern}"`;
      default:
        // Default: append pattern directly
        return `${baseCommand} ${pattern}`;
    }
  }

  /**
   * Add case filter to command based on framework
   */
  private addCaseFilter(
    command: string,
    cases: string[],
    framework?: string
  ): string {
    const detectedFramework = framework ?? this.detectFramework(command);
    const casePattern = cases.join("|");

    switch (detectedFramework) {
      case "vitest":
        return `${command} -t "${casePattern}"`;
      case "jest":
        return `${command} -t "${casePattern}"`;
      case "mocha":
        return `${command} --grep "${casePattern}"`;
      case "pytest":
        return `${command} -k "${casePattern}"`;
      case "go":
        return `${command} -run "${casePattern}"`;
      default:
        return command;
    }
  }

  /**
   * Detect test framework from command
   */
  private detectFramework(command: string): string {
    const lowerCommand = command.toLowerCase();

    if (lowerCommand.includes("vitest")) return "vitest";
    if (lowerCommand.includes("jest")) return "jest";
    if (lowerCommand.includes("mocha")) return "mocha";
    if (lowerCommand.includes("pytest")) return "pytest";
    if (lowerCommand.includes("go test")) return "go";
    if (lowerCommand.includes("cargo test")) return "cargo";

    return "unknown";
  }
}

// Create and export singleton instance
export const testStrategyExecutor = new TestStrategyExecutor();

// Register with default registry
defaultRegistry.register(testStrategyExecutor);
