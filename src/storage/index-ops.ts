/**
 * Feature index operations
 * Load and save the feature index (ai/tasks/index.json)
 * Supports optimistic locking for concurrent modification detection
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { FeatureIndex, FeatureIndexWithLock } from "../types/index.js";
import { INDEX_PATH } from "./constants.js";
import { IndexConflictError } from "./errors.js";

/**
 * Load the feature index from ai/tasks/index.json
 * Attaches _loadedAt metadata for optimistic lock conflict detection
 *
 * @param cwd - The project root directory
 * @returns FeatureIndexWithLock object or null if file doesn't exist
 */
export async function loadFeatureIndex(cwd: string): Promise<FeatureIndexWithLock | null> {
  const indexPath = path.join(cwd, INDEX_PATH);
  try {
    const content = await fs.readFile(indexPath, "utf-8");
    const index = JSON.parse(content) as FeatureIndex;
    // Attach the loaded timestamp for conflict detection
    return {
      ...index,
      _loadedAt: index.updatedAt,
    };
  } catch (error) {
    // Return null if file doesn't exist
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Save the feature index to ai/tasks/index.json
 * Uses atomic write pattern to prevent corruption
 * Supports optimistic locking: throws IndexConflictError if concurrent modification detected
 *
 * @param cwd - The project root directory
 * @param index - The FeatureIndexWithLock object to save
 * @throws IndexConflictError if concurrent modification detected
 */
export async function saveFeatureIndex(cwd: string, index: FeatureIndexWithLock): Promise<void> {
  const indexPath = path.join(cwd, INDEX_PATH);
  const tempPath = `${indexPath}.tmp`;

  // Check for conflicts if we have lock metadata
  if (index._loadedAt) {
    try {
      const currentContent = await fs.readFile(indexPath, "utf-8");
      const currentIndex = JSON.parse(currentContent) as FeatureIndex;

      if (currentIndex.updatedAt !== index._loadedAt) {
        throw new IndexConflictError(index._loadedAt, currentIndex.updatedAt);
      }
    } catch (error) {
      // File deleted is OK (will create new), but rethrow conflicts
      if (error instanceof IndexConflictError) {
        throw error;
      }
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  // Prepare updated index (strip internal _loadedAt field)
  const { _loadedAt, ...cleanIndex } = index;
  const updatedIndex: FeatureIndex = {
    ...cleanIndex,
    updatedAt: new Date().toISOString(),
  };

  // Ensure directory exists
  await fs.mkdir(path.dirname(indexPath), { recursive: true });

  // Write to temp file first (atomic write pattern)
  await fs.writeFile(tempPath, JSON.stringify(updatedIndex, null, 2), "utf-8");

  // Rename temp file to actual file (atomic on most filesystems)
  await fs.rename(tempPath, indexPath);
}
