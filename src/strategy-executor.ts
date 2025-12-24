/**
 * Strategy Executor Framework
 * Base classes and registry for Universal Verification Strategy (UVS)
 * Phase 3 of the UVS RFC implementation
 */

import type { Feature } from "./types/index.js";
import type {
  VerificationStrategy,
  VerificationStrategyType,
} from "./verifier/types/index.js";

// ============================================================================
// Result Interface
// ============================================================================

/**
 * Result of executing a verification strategy
 */
export interface StrategyResult {
  /** Whether the strategy execution succeeded */
  success: boolean;
  /** Output from the strategy execution (stdout, logs, etc.) */
  output?: string;
  /** Duration in milliseconds */
  duration?: number;
  /** Additional strategy-specific details */
  details?: Record<string, unknown>;
}

// ============================================================================
// Executor Interface
// ============================================================================

/**
 * Interface for strategy executors
 * Each strategy type implements this interface to handle its specific verification
 *
 * @template T - The specific verification strategy type this executor handles
 */
export interface StrategyExecutor<T extends VerificationStrategy = VerificationStrategy> {
  /** The strategy type this executor handles */
  readonly type: VerificationStrategyType;

  /**
   * Execute the verification strategy
   *
   * @param cwd - Current working directory
   * @param strategy - The strategy configuration to execute
   * @param feature - The feature being verified (provides context)
   * @returns Promise resolving to the strategy execution result
   */
  execute(cwd: string, strategy: T, feature: Feature): Promise<StrategyResult>;
}

// ============================================================================
// Registry Class
// ============================================================================

/**
 * Registry for strategy executors
 * Provides a central place to register and lookup executors by strategy type
 */
export class StrategyRegistry {
  private executors: Map<VerificationStrategyType, StrategyExecutor> = new Map();

  /**
   * Register an executor for a strategy type
   *
   * @param executor - The executor to register
   */
  register<T extends VerificationStrategy>(executor: StrategyExecutor<T>): void {
    this.executors.set(executor.type, executor as StrategyExecutor);
  }

  /**
   * Get an executor for a strategy type
   *
   * @param type - The strategy type to get executor for
   * @returns The executor or undefined if not registered
   */
  get(type: VerificationStrategyType): StrategyExecutor | undefined {
    return this.executors.get(type);
  }

  /**
   * Check if an executor is registered for a strategy type
   *
   * @param type - The strategy type to check
   * @returns True if an executor is registered
   */
  has(type: VerificationStrategyType): boolean {
    return this.executors.has(type);
  }

  /**
   * Execute a strategy using the appropriate registered executor
   *
   * @param cwd - Current working directory
   * @param strategy - The strategy to execute
   * @param feature - The feature being verified
   * @returns Promise resolving to the strategy result
   * @throws Error if no executor is registered for the strategy type
   */
  async execute(
    cwd: string,
    strategy: VerificationStrategy,
    feature: Feature
  ): Promise<StrategyResult> {
    const executor = this.executors.get(strategy.type);
    if (!executor) {
      throw new Error(`No executor registered for strategy type: ${strategy.type}`);
    }
    return executor.execute(cwd, strategy, feature);
  }

  /**
   * Get all registered strategy types
   *
   * @returns Array of registered strategy types
   */
  getRegisteredTypes(): VerificationStrategyType[] {
    return Array.from(this.executors.keys());
  }

  /**
   * Clear all registered executors (mainly for testing)
   */
  clear(): void {
    this.executors.clear();
  }
}

// ============================================================================
// Default Registry Singleton
// ============================================================================

/**
 * Default strategy registry instance
 * Use this for production code, executors are registered here automatically
 */
export const defaultRegistry = new StrategyRegistry();
