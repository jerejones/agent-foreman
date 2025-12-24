/**
 * File Verification Strategy
 * Re-exports the public API
 */

export { FileStrategyExecutor } from "./executor.js";
export type { FileCheckResult, PathValidationResult, CheckOperationResult } from "./types.js";

// Import for registration
import { FileStrategyExecutor } from "./executor.js";
import { defaultRegistry } from "../../strategy-executor.js";

// Create and export singleton instance
export const fileStrategyExecutor = new FileStrategyExecutor();

// Register with default registry
defaultRegistry.register(fileStrategyExecutor);
