/**
 * E2E Verification Strategy Executor
 * Executes end-to-end tests for feature verification
 * Phase 3 of Universal Verification Strategy RFC
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

import type { Feature } from "../types/index.js";
import type { E2EVerificationStrategy } from "../verifier/types/index.js";
import type { StrategyExecutor, StrategyResult } from "../strategy-executor.js";
import { defaultRegistry } from "../strategy-executor.js";
import { detectCapabilities } from "../capabilities/index.js";

const execAsync = promisify(exec);

/** Default timeout for E2E test execution (120 seconds) */
const DEFAULT_TIMEOUT = 120000;

/**
 * E2E Strategy Executor
 * Runs end-to-end tests using the project's E2E framework
 */
export class E2EStrategyExecutor implements StrategyExecutor<E2EVerificationStrategy> {
  readonly type = "e2e" as const;

  /**
   * Execute E2E verification strategy
   *
   * @param cwd - Current working directory
   * @param strategy - The E2E strategy configuration
   * @param feature - The feature being verified
   * @returns Strategy execution result
   */
  async execute(
    cwd: string,
    strategy: E2EVerificationStrategy,
    feature: Feature
  ): Promise<StrategyResult> {
    const startTime = Date.now();
    const timeout = strategy.timeout ?? DEFAULT_TIMEOUT;

    try {
      // Detect project capabilities to get E2E info
      const capabilities = await detectCapabilities(cwd, { verbose: false });

      if (!capabilities.e2eInfo?.available || !capabilities.e2eInfo.command) {
        return {
          success: false,
          output: "No E2E framework detected in project",
          duration: Date.now() - startTime,
          details: { reason: "no-e2e-framework" },
        };
      }

      const e2eInfo = capabilities.e2eInfo;

      // Build E2E command (command is guaranteed to exist from check above)
      let command: string = e2eInfo.command!;

      // Support tag-based filtering via tags field using grep template
      if (strategy.tags && strategy.tags.length > 0) {
        command = this.buildTagFilterCommand(e2eInfo, strategy.tags, strategy.framework);
      }

      // Support selective file execution via pattern field
      if (strategy.pattern) {
        command = this.buildPatternCommand(e2eInfo, strategy.pattern, strategy.framework);
      }

      // Prepare environment
      const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        CI: "true", // Ensure CI mode for consistent behavior
        ...(strategy.env ?? {}),
      };

      // Execute E2E tests
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout,
        env,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for E2E output
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
          tags: strategy.tags,
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
          output: `E2E test execution timed out after ${timeout}ms\n${output}`,
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
          tags: strategy.tags,
        },
      };
    }
  }

  /**
   * Build E2E command with tag-based filtering
   */
  private buildTagFilterCommand(
    e2eInfo: { command?: string; grepTemplate?: string; framework?: string },
    tags: string[],
    framework?: string
  ): string {
    const tagPattern = tags.join("|");
    const detectedFramework = framework ?? e2eInfo.framework ?? this.detectFramework(e2eInfo.command ?? "");

    // Use grep template if available
    if (e2eInfo.grepTemplate) {
      return e2eInfo.grepTemplate.replace("{tags}", `"${tagPattern}"`);
    }

    // Framework-specific grep commands
    switch (detectedFramework) {
      case "playwright":
        return `${e2eInfo.command} --grep "${tagPattern}"`;
      case "cypress":
        return `${e2eInfo.command} --spec "${tagPattern}"`;
      case "puppeteer":
        return `${e2eInfo.command} --grep "${tagPattern}"`;
      default:
        // Default: use --grep flag
        return `${e2eInfo.command} --grep "${tagPattern}"`;
    }
  }

  /**
   * Build E2E command with pattern-based file filtering
   */
  private buildPatternCommand(
    e2eInfo: { command?: string; fileTemplate?: string; framework?: string },
    pattern: string,
    framework?: string
  ): string {
    const detectedFramework = framework ?? e2eInfo.framework ?? this.detectFramework(e2eInfo.command ?? "");

    // Use file template if available
    if (e2eInfo.fileTemplate) {
      return e2eInfo.fileTemplate.replace("{files}", pattern);
    }

    // Framework-specific file patterns
    switch (detectedFramework) {
      case "playwright":
        return `${e2eInfo.command} ${pattern}`;
      case "cypress":
        return `${e2eInfo.command} --spec "${pattern}"`;
      case "puppeteer":
        return `${e2eInfo.command} ${pattern}`;
      default:
        // Default: append pattern directly
        return `${e2eInfo.command} ${pattern}`;
    }
  }

  /**
   * Detect E2E framework from command
   */
  private detectFramework(command: string): string {
    const lowerCommand = command.toLowerCase();

    if (lowerCommand.includes("playwright")) return "playwright";
    if (lowerCommand.includes("cypress")) return "cypress";
    if (lowerCommand.includes("puppeteer")) return "puppeteer";
    if (lowerCommand.includes("webdriver")) return "webdriver";
    if (lowerCommand.includes("selenium")) return "selenium";
    if (lowerCommand.includes("testcafe")) return "testcafe";

    return "unknown";
  }
}

// Create and export singleton instance
export const e2eStrategyExecutor = new E2EStrategyExecutor();

// Register with default registry
defaultRegistry.register(e2eStrategyExecutor);
