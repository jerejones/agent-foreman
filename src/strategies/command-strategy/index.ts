/**
 * Command Strategy Module
 * Exports all command verification strategy components
 */

// Types and constants
export { DEFAULT_TIMEOUT, DANGEROUS_PATTERNS } from "./constants.js";

// Validators
export { validateCwd, validateCommand, checkExitCodeMatch, buildCommand } from "./validators.js";

// Output formatting
export { formatOutput } from "./output.js";

// Executor
export { CommandStrategyExecutor } from "./executor.js";

// Create and export singleton instance
import { CommandStrategyExecutor } from "./executor.js";
export const commandStrategyExecutor = new CommandStrategyExecutor();
