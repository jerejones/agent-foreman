/**
 * Index synchronization operations
 * Ensures index.json stays in sync with markdown files (source of truth)
 */
import type { Feature, FeatureIndex } from "../types/index.js";
import { saveFeatureIndex } from "../storage/index.js";

/**
 * Sync index.json with loaded features (auto-fix drift)
 * - Updates status in index when .md file has different status
 * - Removes orphan entries (in index but .md deleted)
 *
 * @param cwd - Project root directory
 * @param features - Features loaded from markdown files
 * @param index - Current index (will be mutated if changes needed)
 * @returns true if changes were made and saved
 */
export async function syncIndexFromFeatures(
  cwd: string,
  features: Feature[],
  index: FeatureIndex
): Promise<boolean> {
  let hasChanges = false;
  const loadedIds = new Set(features.map((f) => f.id));

  // Update status for existing features (when .md differs from index)
  for (const feature of features) {
    const indexEntry = index.features[feature.id];
    if (indexEntry && indexEntry.status !== feature.status) {
      indexEntry.status = feature.status;
      hasChanges = true;
    }
  }

  // Remove orphan entries (in index but .md file deleted)
  for (const id of Object.keys(index.features)) {
    if (!loadedIds.has(id)) {
      delete index.features[id];
      hasChanges = true;
    }
  }

  // Save updated index if changes were made
  if (hasChanges) {
    await saveFeatureIndex(cwd, index);
  }

  return hasChanges;
}

/** Alias for syncIndexFromFeatures - syncs task index from loaded tasks */
export const syncIndexFromTasks = syncIndexFromFeatures;
