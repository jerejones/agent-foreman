/**
 * Manual Verification Strategy Executor
 * Handles human review and approval for feature verification
 * Phase 3 of Universal Verification Strategy RFC
 */

import * as readline from "node:readline";

import type { Feature } from "../types/index.js";
import type { ManualVerificationStrategy } from "../verifier/types/index.js";
import type { StrategyExecutor, StrategyResult } from "../strategy-executor.js";
import { defaultRegistry } from "../strategy-executor.js";

/**
 * Interface for user input (allows mocking in tests)
 */
export interface UserInputInterface {
  askYesNo(question: string): Promise<boolean>;
  askChecklist(items: string[]): Promise<boolean[]>;
}

/**
 * Default implementation of user input via CLI
 */
export class CLIUserInput implements UserInputInterface {
  private rl: readline.Interface | null = null;

  private getReadline(): readline.Interface {
    if (!this.rl) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
    }
    return this.rl;
  }

  private closeReadline(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  async askYesNo(question: string): Promise<boolean> {
    return new Promise((resolve) => {
      const rl = this.getReadline();
      rl.question(`${question} (y/n): `, (answer) => {
        this.closeReadline();
        const normalized = answer.toLowerCase().trim();
        resolve(normalized === "y" || normalized === "yes");
      });
    });
  }

  async askChecklist(items: string[]): Promise<boolean[]> {
    const results: boolean[] = [];
    for (const item of items) {
      const result = await this.askYesNo(`  [ ] ${item} - Complete?`);
      results.push(result);
    }
    return results;
  }
}

/**
 * Manual Strategy Executor
 * Requires human review and approval
 */
export class ManualStrategyExecutor implements StrategyExecutor<ManualVerificationStrategy> {
  readonly type = "manual" as const;

  private userInput: UserInputInterface;

  constructor(userInput?: UserInputInterface) {
    this.userInput = userInput ?? new CLIUserInput();
  }

  /**
   * Set user input interface (for testing)
   */
  setUserInput(userInput: UserInputInterface): void {
    this.userInput = userInput;
  }

  /**
   * Execute manual verification strategy
   *
   * @param cwd - Current working directory
   * @param strategy - The manual strategy configuration
   * @param feature - The feature being verified
   * @returns Strategy execution result
   */
  async execute(
    cwd: string,
    strategy: ManualVerificationStrategy,
    feature: Feature
  ): Promise<StrategyResult> {
    const startTime = Date.now();

    // Check if running in CI environment
    if (process.env.CI === "true") {
      return {
        success: false,
        output: "Manual verification required - cannot complete in CI environment",
        duration: Date.now() - startTime,
        details: {
          reason: "ci-environment",
          instructions: strategy.instructions,
          checklist: strategy.checklist,
          assignee: strategy.assignee ?? strategy.reviewer,
        },
      };
    }

    try {
      // Display header
      console.log("\n" + "=".repeat(60));
      console.log("          MANUAL VERIFICATION REQUIRED");
      console.log("=".repeat(60) + "\n");

      // Display assignee/reviewer if provided
      const assignee = strategy.assignee ?? strategy.reviewer;
      if (assignee) {
        console.log(`Assigned to: ${assignee}`);
        console.log("");
      }

      // Display instructions if provided
      if (strategy.instructions) {
        console.log("Instructions:");
        console.log("-------------");
        console.log(strategy.instructions);
        console.log("");
      }

      // Display feature context
      console.log(`Task: ${feature.id}`);
      console.log(`Description: ${feature.description}`);
      console.log("");

      let success: boolean;

      // Handle checklist if provided
      if (strategy.checklist && strategy.checklist.length > 0) {
        console.log("Checklist:");
        console.log("-----------");

        const results = await this.userInput.askChecklist(strategy.checklist);
        success = results.every((r) => r);

        // Display completion status
        console.log("");
        console.log("Checklist Results:");
        strategy.checklist.forEach((item, i) => {
          console.log(`  ${results[i] ? "[x]" : "[ ]"} ${item}`);
        });

        if (!success) {
          const incomplete = strategy.checklist.filter((_, i) => !results[i]);
          return {
            success: false,
            output: `Manual verification incomplete. ${incomplete.length} items not completed.`,
            duration: Date.now() - startTime,
            details: {
              reason: "checklist-incomplete",
              checklist: strategy.checklist,
              results,
              incompleteItems: incomplete,
            },
          };
        }
      } else {
        // Simple yes/no confirmation
        success = await this.userInput.askYesNo("Verification complete?");
      }

      console.log("\n" + "=".repeat(60) + "\n");

      return {
        success,
        output: success
          ? "Manual verification passed"
          : "Manual verification rejected by reviewer",
        duration: Date.now() - startTime,
        details: {
          assignee,
          instructions: strategy.instructions,
          checklist: strategy.checklist,
          approved: success,
        },
      };
    } catch (error) {
      return {
        success: false,
        output: `Manual verification failed: ${(error as Error).message}`,
        duration: Date.now() - startTime,
        details: {
          reason: "error",
          error: (error as Error).message,
        },
      };
    }
  }
}

// Create and export singleton instance
export const manualStrategyExecutor = new ManualStrategyExecutor();

// Register with default registry
defaultRegistry.register(manualStrategyExecutor);
