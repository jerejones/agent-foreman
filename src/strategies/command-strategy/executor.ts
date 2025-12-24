/**
 * Command Strategy Executor Implementation
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

import type { Feature } from "../../types/index.js";
import type { CommandVerificationStrategy } from "../../verifier/types/index.js";
import type { StrategyExecutor, StrategyResult } from "../../strategy-executor.js";

import { DEFAULT_TIMEOUT } from "./constants.js";
import { validateCwd, validateCommand, checkExitCodeMatch, buildCommand } from "./validators.js";
import { formatOutput } from "./output.js";

const execAsync = promisify(exec);

/**
 * Command Strategy Executor
 * Runs custom commands for verification
 */
export class CommandStrategyExecutor implements StrategyExecutor<CommandVerificationStrategy> {
  readonly type = "command" as const;

  /**
   * Execute command verification strategy
   *
   * @param cwd - Current working directory
   * @param strategy - The command strategy configuration
   * @param feature - The feature being verified
   * @returns Strategy execution result
   */
  async execute(
    cwd: string,
    strategy: CommandVerificationStrategy,
    _feature: Feature
  ): Promise<StrategyResult> {
    const startTime = Date.now();
    const timeout = strategy.timeout ?? DEFAULT_TIMEOUT;
    const expectedExitCode = strategy.expectedExitCode ?? 0;

    try {
      // Validate working directory
      const workingDir = strategy.cwd ? resolve(cwd, strategy.cwd) : cwd;
      const cwdValidation = validateCwd(cwd, workingDir);
      if (!cwdValidation.valid) {
        return {
          success: false,
          output: cwdValidation.error ?? "Invalid working directory",
          duration: Date.now() - startTime,
          details: { reason: "security-violation", cwd: strategy.cwd },
        };
      }

      // Build the command
      const command = buildCommand(strategy.command, strategy.args);

      // Validate command for dangerous patterns
      const commandValidation = validateCommand(command);
      if (!commandValidation.valid) {
        return {
          success: false,
          output: commandValidation.error ?? "Command contains dangerous patterns",
          duration: Date.now() - startTime,
          details: { reason: "security-violation", command },
        };
      }

      // Prepare environment
      const env: Record<string, string> = {
        ...(process.env as Record<string, string>),
        CI: "true",
        ...(strategy.env ?? {}),
      };

      // Execute command
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout,
        env,
        maxBuffer: 5 * 1024 * 1024, // 5MB buffer
      });

      const duration = Date.now() - startTime;

      // Check patterns and exit code
      return this.processResult(
        stdout,
        stderr,
        0,
        expectedExitCode,
        strategy,
        command,
        workingDir,
        duration
      );
    } catch (error) {
      return this.handleError(error, cwd, strategy, expectedExitCode, startTime);
    }
  }

  /**
   * Process successful command result
   */
  private processResult(
    stdout: string,
    stderr: string,
    exitCode: number,
    expectedExitCode: number | number[],
    strategy: CommandVerificationStrategy,
    command: string,
    workingDir: string,
    duration: number
  ): StrategyResult {
    const exitCodeMatch = checkExitCodeMatch(exitCode, expectedExitCode);

    // Check stdout pattern
    const stdoutPattern = strategy.stdoutPattern ?? strategy.expectedOutputPattern;
    let stdoutPatternMatch = true;
    if (stdoutPattern) {
      const regex = new RegExp(stdoutPattern);
      stdoutPatternMatch = regex.test(stdout);
    }

    // Check stderr pattern
    let stderrPatternMatch = true;
    if (strategy.stderrPattern) {
      const regex = new RegExp(strategy.stderrPattern);
      stderrPatternMatch = regex.test(stderr);
    }

    // Check negative patterns (notPatterns)
    const { failed: notPatternsFailed, pattern: failedNotPattern } =
      this.checkNotPatterns(strategy.notPatterns, stdout, stderr);

    const success = exitCodeMatch && stdoutPatternMatch && stderrPatternMatch && !notPatternsFailed;

    return {
      success,
      output: formatOutput(
        stdout,
        stderr,
        exitCode,
        !exitCodeMatch,
        !stdoutPatternMatch,
        !stderrPatternMatch,
        notPatternsFailed,
        failedNotPattern
      ),
      duration,
      details: {
        command,
        cwd: workingDir,
        exitCode,
        expectedExitCode,
        exitCodeMatch,
        stdoutPatternMatch: stdoutPattern ? stdoutPatternMatch : undefined,
        stderrPatternMatch: strategy.stderrPattern ? stderrPatternMatch : undefined,
        notPatternsFailed: strategy.notPatterns ? notPatternsFailed : undefined,
        failedNotPattern,
      },
    };
  }

  /**
   * Check negative patterns (notPatterns)
   */
  private checkNotPatterns(
    notPatterns: string[] | undefined,
    stdout: string,
    stderr: string
  ): { failed: boolean; pattern?: string } {
    if (!notPatterns || notPatterns.length === 0) {
      return { failed: false };
    }

    const combined = stdout + stderr;
    for (const pattern of notPatterns) {
      const regex = new RegExp(pattern);
      if (regex.test(combined)) {
        return { failed: true, pattern };
      }
    }
    return { failed: false };
  }

  /**
   * Handle command execution error
   */
  private handleError(
    error: unknown,
    cwd: string,
    strategy: CommandVerificationStrategy,
    expectedExitCode: number | number[],
    startTime: number
  ): StrategyResult {
    const timeout = strategy.timeout ?? DEFAULT_TIMEOUT;
    const execError = error as {
      stdout?: string;
      stderr?: string;
      code?: number;
      killed?: boolean;
      signal?: string;
    };

    const stdout = execError.stdout ?? "";
    const stderr = execError.stderr ?? "";
    const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : "");
    const duration = Date.now() - startTime;

    // Check if it was a timeout
    if (execError.killed || execError.signal === "SIGTERM") {
      return {
        success: false,
        output: `Command execution timed out after ${timeout}ms\n${output}`,
        duration,
        details: {
          reason: "timeout",
          timeout,
          command: strategy.command,
        },
      };
    }

    // Check if exit code matches expected
    const exitCode = execError.code ?? 1;
    const workingDir = strategy.cwd ? resolve(cwd, strategy.cwd) : cwd;
    const command = buildCommand(strategy.command, strategy.args);

    return this.processResult(
      stdout,
      stderr,
      exitCode,
      expectedExitCode,
      strategy,
      command,
      workingDir,
      duration
    );
  }
}
