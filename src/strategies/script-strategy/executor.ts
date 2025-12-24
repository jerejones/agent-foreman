/**
 * Script Strategy Executor Implementation
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

import type { Feature } from "../../types/index.js";
import type { ScriptVerificationStrategy } from "../../verifier/types/index.js";
import type { StrategyExecutor, StrategyResult } from "../../strategy-executor.js";

import { DEFAULT_TIMEOUT } from "./constants.js";
import { validateScriptPath, validateCommand, validateArgs, buildCommand } from "./validators.js";

const execAsync = promisify(exec);

/**
 * Script Strategy Executor
 * Runs custom shell scripts for verification
 */
export class ScriptStrategyExecutor implements StrategyExecutor<ScriptVerificationStrategy> {
  readonly type = "script" as const;

  /**
   * Execute script verification strategy
   *
   * @param cwd - Current working directory
   * @param strategy - The script strategy configuration
   * @param feature - The feature being verified
   * @returns Strategy execution result
   */
  async execute(
    cwd: string,
    strategy: ScriptVerificationStrategy,
    _feature: Feature
  ): Promise<StrategyResult> {
    const startTime = Date.now();
    const timeout = strategy.timeout ?? DEFAULT_TIMEOUT;
    const expectedExitCode = strategy.expectedExitCode ?? 0;

    try {
      // Validate script path security
      const pathValidation = await validateScriptPath(cwd, strategy.path);
      if (!pathValidation.valid) {
        return {
          success: false,
          output: pathValidation.error ?? "Invalid script path",
          duration: Date.now() - startTime,
          details: { reason: "security-violation", path: strategy.path },
        };
      }

      // Validate args for dangerous patterns (before building command)
      if (strategy.args && strategy.args.length > 0) {
        const argsValidation = validateArgs(strategy.args);
        if (!argsValidation.valid) {
          return {
            success: false,
            output: argsValidation.error ?? "Arguments contain dangerous patterns",
            duration: Date.now() - startTime,
            details: { reason: "security-violation", args: strategy.args },
          };
        }
      }

      // Build the command
      const command = buildCommand(pathValidation.absolutePath!, strategy.args);

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

      // Determine working directory
      const workingDir = strategy.cwd ? resolve(cwd, strategy.cwd) : cwd;

      // Execute script
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout,
        env,
        maxBuffer: 5 * 1024 * 1024, // 5MB buffer
      });

      const output = stdout + (stderr ? `\n${stderr}` : "");
      const duration = Date.now() - startTime;

      // Exit code is 0 when execAsync succeeds
      const exitCodeMatch = expectedExitCode === 0;

      // Check output pattern if specified
      let patternMatch = true;
      if (strategy.outputPattern) {
        const regex = new RegExp(strategy.outputPattern);
        patternMatch = regex.test(stdout);
      }

      const success = exitCodeMatch && patternMatch;

      return {
        success,
        output,
        duration,
        details: {
          command,
          path: strategy.path,
          exitCode: 0,
          expectedExitCode,
          patternMatch: strategy.outputPattern ? patternMatch : undefined,
        },
      };
    } catch (error) {
      return this.handleError(error, cwd, strategy, expectedExitCode, startTime);
    }
  }

  /**
   * Handle script execution error
   */
  private handleError(
    error: unknown,
    cwd: string,
    strategy: ScriptVerificationStrategy,
    expectedExitCode: number,
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

    const output = (execError.stdout ?? "") + (execError.stderr ?? "");
    const duration = Date.now() - startTime;

    // Check if it was a timeout
    if (execError.killed || execError.signal === "SIGTERM") {
      return {
        success: false,
        output: `Script execution timed out after ${timeout}ms\n${output}`,
        duration,
        details: {
          reason: "timeout",
          timeout,
          path: strategy.path,
        },
      };
    }

    // Check if exit code matches expected
    const exitCode = execError.code ?? 1;
    const exitCodeMatch = exitCode === expectedExitCode;

    // Check output pattern if specified
    let patternMatch = true;
    if (strategy.outputPattern && execError.stdout) {
      const regex = new RegExp(strategy.outputPattern);
      patternMatch = regex.test(execError.stdout);
    }

    const success = exitCodeMatch && patternMatch;

    return {
      success,
      output: output || (error as Error).message,
      duration,
      details: {
        command: buildCommand(resolve(cwd, strategy.path), strategy.args),
        path: strategy.path,
        exitCode,
        expectedExitCode,
        patternMatch: strategy.outputPattern ? patternMatch : undefined,
      },
    };
  }
}
