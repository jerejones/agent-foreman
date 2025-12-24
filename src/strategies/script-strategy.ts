/**
 * Script Verification Strategy Executor
 * Executes custom shell scripts for feature verification
 * Phase 3 of Universal Verification Strategy RFC
 *
 * This file re-exports from the script-strategy/ directory for backward compatibility.
 */

// Re-export everything from the module
export {
  DEFAULT_TIMEOUT,
  DANGEROUS_PATTERNS,
  SHELL_INJECTION_PATTERNS,
  validateScriptPath,
  validateCommand,
  validateArgs,
  buildCommand,
  ScriptStrategyExecutor,
  scriptStrategyExecutor,
} from "./script-strategy/index.js";

// Register with default registry
import { scriptStrategyExecutor } from "./script-strategy/index.js";
import { defaultRegistry } from "../strategy-executor.js";

defaultRegistry.register(scriptStrategyExecutor);
