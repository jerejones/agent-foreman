/**
 * Composite Verification Strategy Executor
 * Combines multiple strategies with AND/OR logic
 * Phase 3 of Universal Verification Strategy RFC
 */

import type { Feature } from "../types/index.js";
import type { CompositeVerificationStrategy, VerificationStrategy } from "../verifier/types/index.js";
import type { StrategyExecutor, StrategyResult } from "../strategy-executor.js";
import { defaultRegistry, StrategyRegistry } from "../strategy-executor.js";

/**
 * Extended composite strategy that supports both 'operator' and 'logic' fields
 * The base CompositeVerificationStrategy uses 'operator', but we also support 'logic' as alias
 */
export interface ExtendedCompositeVerificationStrategy extends CompositeVerificationStrategy {
  /** Logical operator for combining strategies (alias for operator) */
  logic?: "and" | "or";
}

/**
 * Result of a single nested strategy execution
 */
export interface NestedStrategyResult {
  /** The strategy that was executed */
  strategy: VerificationStrategy;
  /** Index in the strategies array */
  index: number;
  /** The execution result */
  result: StrategyResult;
}

/**
 * Composite Strategy Executor
 * Combines multiple strategies with AND/OR logic
 */
export class CompositeStrategyExecutor implements StrategyExecutor<ExtendedCompositeVerificationStrategy> {
  readonly type = "composite" as const;

  private registry: StrategyRegistry;

  constructor(registry?: StrategyRegistry) {
    this.registry = registry ?? defaultRegistry;
  }

  /**
   * Set registry (for testing)
   */
  setRegistry(registry: StrategyRegistry): void {
    this.registry = registry;
  }

  /**
   * Execute composite verification strategy
   *
   * @param cwd - Current working directory
   * @param strategy - The composite strategy configuration
   * @param feature - The feature being verified
   * @returns Strategy execution result
   */
  async execute(
    cwd: string,
    strategy: ExtendedCompositeVerificationStrategy,
    feature: Feature
  ): Promise<StrategyResult> {
    const startTime = Date.now();

    // Support both 'operator' (canonical) and 'logic' (alias) fields
    // operator takes precedence, logic is an alias, default to "and"
    const operator = strategy.operator ?? strategy.logic ?? "and";
    const strategies = strategy.strategies ?? [];

    if (strategies.length === 0) {
      return {
        success: true,
        output: "Composite strategy has no nested strategies (vacuously true)",
        duration: Date.now() - startTime,
        details: {
          operator,
          nestedResults: [],
          executedCount: 0,
          totalCount: 0,
        },
      };
    }

    const nestedResults: NestedStrategyResult[] = [];
    const outputs: string[] = [];
    let success: boolean;

    try {
      if (operator === "and") {
        // AND: All strategies must pass, short-circuit on first failure
        success = await this.executeAnd(cwd, strategies, feature, nestedResults, outputs);
      } else {
        // OR: At least one strategy must pass, short-circuit on first success
        success = await this.executeOr(cwd, strategies, feature, nestedResults, outputs);
      }

      return {
        success,
        output: this.formatOutput(operator, nestedResults, outputs),
        duration: Date.now() - startTime,
        details: {
          operator,
          nestedResults: nestedResults.map((nr) => ({
            type: nr.strategy.type,
            index: nr.index,
            success: nr.result.success,
            duration: nr.result.duration,
            output: nr.result.output,
          })),
          executedCount: nestedResults.length,
          totalCount: strategies.length,
          shortCircuited: nestedResults.length < strategies.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        output: `Composite verification failed: ${(error as Error).message}`,
        duration: Date.now() - startTime,
        details: {
          operator,
          reason: "error",
          error: (error as Error).message,
          nestedResults: nestedResults.map((nr) => ({
            type: nr.strategy.type,
            index: nr.index,
            success: nr.result.success,
          })),
          executedCount: nestedResults.length,
          totalCount: strategies.length,
        },
      };
    }
  }

  /**
   * Execute AND logic: all strategies must pass
   * Short-circuits on first failure (fail fast)
   */
  private async executeAnd(
    cwd: string,
    strategies: VerificationStrategy[],
    feature: Feature,
    nestedResults: NestedStrategyResult[],
    outputs: string[]
  ): Promise<boolean> {
    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      const result = await this.executeNestedStrategy(cwd, strategy, feature);

      nestedResults.push({ strategy, index: i, result });
      if (result.output) {
        outputs.push(`[${i + 1}/${strategies.length}] ${strategy.type}: ${result.output}`);
      }

      // Short-circuit on first failure
      if (!result.success) {
        return false;
      }
    }
    return true;
  }

  /**
   * Execute OR logic: at least one strategy must pass
   * Short-circuits on first success
   */
  private async executeOr(
    cwd: string,
    strategies: VerificationStrategy[],
    feature: Feature,
    nestedResults: NestedStrategyResult[],
    outputs: string[]
  ): Promise<boolean> {
    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      const result = await this.executeNestedStrategy(cwd, strategy, feature);

      nestedResults.push({ strategy, index: i, result });
      if (result.output) {
        outputs.push(`[${i + 1}/${strategies.length}] ${strategy.type}: ${result.output}`);
      }

      // Short-circuit on first success
      if (result.success) {
        return true;
      }
    }
    return false;
  }

  /**
   * Execute a single nested strategy using the registry
   */
  private async executeNestedStrategy(
    cwd: string,
    strategy: VerificationStrategy,
    feature: Feature
  ): Promise<StrategyResult> {
    const executor = this.registry.get(strategy.type);

    if (!executor) {
      return {
        success: false,
        output: `No executor registered for strategy type: ${strategy.type}`,
        details: {
          reason: "no-executor",
          strategyType: strategy.type,
        },
      };
    }

    return executor.execute(cwd, strategy, feature);
  }

  /**
   * Format output message
   */
  private formatOutput(
    operator: "and" | "or",
    nestedResults: NestedStrategyResult[],
    outputs: string[]
  ): string {
    const lines: string[] = [];

    const passCount = nestedResults.filter((r) => r.result.success).length;
    const failCount = nestedResults.filter((r) => !r.result.success).length;
    const totalExecuted = nestedResults.length;

    lines.push(`Composite (${operator.toUpperCase()}): ${passCount} passed, ${failCount} failed (${totalExecuted} executed)`);

    if (outputs.length > 0) {
      lines.push("");
      lines.push("Results:");
      for (const output of outputs) {
        lines.push(`  ${output}`);
      }
    }

    return lines.join("\n");
  }
}

// Create and export singleton instance
export const compositeStrategyExecutor = new CompositeStrategyExecutor();

// Register with default registry
defaultRegistry.register(compositeStrategyExecutor);
