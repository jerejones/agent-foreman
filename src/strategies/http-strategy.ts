/**
 * HTTP Verification Strategy Executor
 * Re-exports from modular http-strategy/ directory
 *
 * This file is kept for backward compatibility with existing imports.
 */

export {
  HttpStrategyExecutor,
  httpStrategyExecutor,
  DEFAULT_TIMEOUT,
  DEFAULT_ALLOWED_HOSTS,
  substituteEnvVars,
  validateUrl,
  isExplicitlyAllowed,
  isPrivateIp,
  checkStatusMatch,
  checkJsonAssertions,
  getJsonPath,
  deepEqual,
  formatOutput,
} from "./http-strategy/index.js";
