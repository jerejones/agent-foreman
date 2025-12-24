/**
 * Feature Index types for modular storage
 * Lightweight index for quick feature lookups
 */

import type { FeatureStatus, FeatureListMetadata } from "./feature.js";

/**
 * Lightweight feature entry for quick index lookups
 * Contains only brief properties for fast status overview
 */
export interface FeatureIndexEntry {
  /** Current status */
  status: FeatureStatus;
  /** Priority (1 = highest) */
  priority: number;
  /** Parent module/subsystem */
  module: string;
  /** Human-readable description (summary) */
  description: string;
  /** Optional explicit file path (relative to ai/tasks/) when filename doesn't follow ID convention */
  filePath?: string;
}

/**
 * Feature index file structure (ai/tasks/index.json)
 * Provides quick lookup of feature status without loading full feature files
 */
export interface FeatureIndex {
  /** Index format version */
  version: string;
  /** ISO 8601 timestamp of last update */
  updatedAt: string;
  /** File metadata (same as FeatureListMetadata) */
  metadata: FeatureListMetadata;
  /** Map of task ID to index entry */
  features: Record<string, FeatureIndexEntry>;
}

/**
 * FeatureIndex with optimistic lock metadata for conflict detection
 * Used internally to track the loaded state for concurrent modification detection
 */
export interface FeatureIndexWithLock extends FeatureIndex {
  /**
   * Original updatedAt timestamp when loaded (for conflict detection)
   * This field is stripped before saving
   */
  _loadedAt?: string;
}
