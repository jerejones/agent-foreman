/**
 * Feature storage module for modular Markdown-based feature storage
 * Handles parsing and serialization of feature markdown files
 *
 * This module has been split from a single 671-line file into focused submodules:
 * - constants.ts: Path constants
 * - types.ts: Storage-specific types (MigrationResult)
 * - helpers.ts: Internal helper functions
 * - path-utils.ts: Task ID to path conversion
 * - parser.ts: Markdown parsing (parseFeatureMarkdown)
 * - serializer.ts: Markdown serialization (serializeFeatureMarkdown)
 * - index-ops.ts: Feature index operations
 * - single-ops.ts: Single feature operations
 * - migration.ts: Migration functions
 * - aliases.ts: Task terminology aliases
 */

// Re-export types
export type { MigrationResult } from "./types.js";

// Optimistic locking errors
export {
  OptimisticLockError,
  IndexConflictError,
  FeatureConflictError,
} from "./errors.js";

// Retry helper for optimistic locking
export { withOptimisticRetry, DEFAULT_RETRY_CONFIG } from "./retry.js";
export type { RetryConfig } from "./retry.js";

// Parser
export { parseFeatureMarkdown } from "./parser.js";

// Serializer
export { serializeFeatureMarkdown } from "./serializer.js";

// Path utilities (legacy - prefer using path-resolver for new code)
export { featureIdToPath, pathToFeatureId } from "./path-utils.js";

// Unified path resolver (recommended for all path resolution)
export { resolveFeaturePath, deriveFeaturePath } from "./path-resolver.js";
export type { ResolvePathOptions } from "./path-resolver.js";

// Index operations
export { loadFeatureIndex, saveFeatureIndex } from "./index-ops.js";

// Single feature operations
export { loadSingleFeature, saveSingleFeature, saveSingleFeatureFrontmatterOnly } from "./single-ops.js";
export type { SaveFeatureOptions } from "./single-ops.js";

// Migration
export {
  needsMigration,
  migrateToMarkdown,
  autoMigrateIfNeeded,
} from "./migration.js";

// Task terminology aliases
export {
  parseTaskMarkdown,
  serializeTaskMarkdown,
  taskIdToPath,
  pathToTaskId,
  loadTaskIndex,
  saveTaskIndex,
  loadSingleTask,
  saveSingleTask,
} from "./aliases.js";
