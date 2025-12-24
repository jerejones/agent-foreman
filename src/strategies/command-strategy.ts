/**
 * Command Verification Strategy Executor
 * Executes custom commands for feature verification
 * Phase 3 of Universal Verification Strategy RFC
 *
 * This file re-exports from the command-strategy/ directory for backward compatibility.
 */

// Re-export everything from the module
export {
  DEFAULT_TIMEOUT,
  DANGEROUS_PATTERNS,
  validateCwd,
  validateCommand,
  checkExitCodeMatch,
  buildCommand,
  formatOutput,
  CommandStrategyExecutor,
  commandStrategyExecutor,
} from "./command-strategy/index.js";

// Register with default registry
import { commandStrategyExecutor } from "./command-strategy/index.js";
import { defaultRegistry } from "../strategy-executor.js";

defaultRegistry.register(commandStrategyExecutor);
