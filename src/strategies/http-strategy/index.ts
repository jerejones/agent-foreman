/**
 * HTTP Verification Strategy
 * Re-exports the public API
 */

export { HttpStrategyExecutor } from "./executor.js";
export { DEFAULT_TIMEOUT, DEFAULT_ALLOWED_HOSTS } from "./constants.js";
export { substituteEnvVars, validateUrl, isExplicitlyAllowed, isPrivateIp } from "./url-validator.js";
export { checkStatusMatch, checkJsonAssertions, getJsonPath, deepEqual } from "./assertions.js";
export { formatOutput } from "./output.js";

// Import for registration
import { HttpStrategyExecutor } from "./executor.js";
import { defaultRegistry } from "../../strategy-executor.js";

// Create and export singleton instance
export const httpStrategyExecutor = new HttpStrategyExecutor();

// Register with default registry
defaultRegistry.register(httpStrategyExecutor);
