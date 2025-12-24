/**
 * Script Strategy Module
 * Exports all script verification strategy components
 */

// Constants
export {
  DEFAULT_TIMEOUT,
  DANGEROUS_PATTERNS,
  SHELL_INJECTION_PATTERNS,
} from "./constants.js";

// Validators
export {
  validateScriptPath,
  validateCommand,
  validateArgs,
  buildCommand,
} from "./validators.js";

// Executor
export { ScriptStrategyExecutor } from "./executor.js";

// Create and export singleton instance
import { ScriptStrategyExecutor } from "./executor.js";
export const scriptStrategyExecutor = new ScriptStrategyExecutor();
