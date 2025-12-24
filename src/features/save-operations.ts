/**
 * Feature list saving operations
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Feature, FeatureList, FeatureIndex, FeatureIndexEntry } from "../types/index.js";
import { saveSingleFeatureFrontmatterOnly, saveFeatureIndex } from "../storage/index.js";
import { TASKS_DIR } from "./constants.js";

/**
 * Save feature list to file
 * Writes to new modular format (ai/tasks/)
 *
 * Strategy:
 * 1. Ensure directory structure exists
 * 2. Write each feature to its markdown file
 * 3. Update index.json with brief properties
 */
export async function saveFeatureList(basePath: string, list: FeatureList): Promise<void> {
  const tasksDir = path.join(basePath, TASKS_DIR);
  await fs.mkdir(tasksDir, { recursive: true });

  // Update metadata timestamp
  const updatedMetadata = {
    ...list.metadata,
    updatedAt: new Date().toISOString(),
  };

  // Build index entries while saving features
  const indexFeatures: Record<string, FeatureIndexEntry> = {};

  // Save each feature - frontmatter only (preserves body content exactly)
  const savePromises = list.features.map(async (feature) => {
    await saveSingleFeatureFrontmatterOnly(basePath, feature);

    // Add to index (preserve filePath to prevent data loss)
    indexFeatures[feature.id] = {
      status: feature.status,
      priority: feature.priority,
      module: feature.module,
      description: feature.description,
      ...(feature.filePath && { filePath: feature.filePath }),
    };
  });

  await Promise.all(savePromises);

  // Build and save index.json
  const index: FeatureIndex = {
    version: "2.0.0",
    updatedAt: updatedMetadata.updatedAt,
    metadata: updatedMetadata,
    features: indexFeatures,
  };

  await saveFeatureIndex(basePath, index);
}

/** Alias for saveFeatureList - saves a task list */
export const saveTaskList = saveFeatureList;
