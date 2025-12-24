/**
 * Test discovery and selective test execution
 *
 * This module provides functionality for:
 * - Discovering related tests based on changed files and feature patterns
 * - Building selective test commands for various frameworks
 * - E2E test command building with tag-based filtering
 */

// Types
export type { TestDiscoveryResult, E2EMode } from "./types.js";

// Test patterns and source-to-test mapping
export { TEST_PATTERNS, mapSourceToTestFiles, extractModuleFromPath } from "./patterns.js";

// Test discovery
export {
  getChangedFiles,
  findExistingTestFiles,
  discoverTestsForFeature,
} from "./discovery.js";

// Test command building
export {
  buildSelectiveTestCommand,
  getSelectiveTestCommand,
} from "./commands.js";

// E2E test command building
export {
  buildE2ECommand,
  getE2ETagsForFeature,
  determineE2EMode,
} from "./e2e.js";
