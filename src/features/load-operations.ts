/**
 * Feature list loading operations
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Feature, FeatureList, FeatureIndex } from "../types/index.js";
import { validateFeatureList } from "../schemas/index.js";
import {
  loadFeatureIndex,
  loadSingleFeature,
  autoMigrateIfNeeded,
} from "../storage/index.js";
import { FEATURE_LIST_PATH, TASKS_DIR } from "./constants.js";
import { syncIndexFromFeatures } from "./sync-operations.js";

/**
 * Load feature list from file
 * Supports both new modular format (ai/tasks/) and legacy JSON format
 *
 * Strategy:
 * 1. Try new format (index.json) first
 * 2. Auto-migrate if old format detected
 * 3. Load all features from markdown files
 * 4. Fall back to legacy format if neither exists
 */
export async function loadFeatureList(basePath: string): Promise<FeatureList | null> {
  // 1. Check if new format exists (index.json)
  const index = await loadFeatureIndex(basePath);

  if (index) {
    // Load all features from markdown files
    const features = await loadAllFeaturesFromMarkdown(basePath, index);

    // Auto-sync: fix index.json if status differs from .md files
    await syncIndexFromFeatures(basePath, features, index);

    return {
      $schema: "./feature_list.schema.json",
      features,
      metadata: index.metadata,
    };
  }

  // 2. Check if legacy format exists and auto-migrate
  const legacyPath = path.join(basePath, FEATURE_LIST_PATH);
  try {
    await fs.access(legacyPath);
    // Legacy file exists - attempt auto-migration (silent to not corrupt JSON output)
    await autoMigrateIfNeeded(basePath, true);

    // After migration, try loading from new format
    const migratedIndex = await loadFeatureIndex(basePath);
    if (migratedIndex) {
      const features = await loadAllFeaturesFromMarkdown(basePath, migratedIndex);

      // Auto-sync: fix index.json if status differs from .md files
      await syncIndexFromFeatures(basePath, features, migratedIndex);

      return {
        $schema: "./feature_list.schema.json",
        features,
        metadata: migratedIndex.metadata,
      };
    }

    // If migration failed or index still doesn't exist, load legacy format
    return loadLegacyFeatureList(basePath);
  } catch {
    // Neither format exists
    return null;
  }
}

/**
 * Load legacy feature list from ai/feature_list.json
 */
async function loadLegacyFeatureList(basePath: string): Promise<FeatureList | null> {
  const filePath = path.join(basePath, FEATURE_LIST_PATH);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    const { valid, errors } = validateFeatureList(data);
    if (!valid) {
      console.error("Invalid feature list:", errors);
      return null;
    }
    return data as FeatureList;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Load all features from markdown files based on index
 */
async function loadAllFeaturesFromMarkdown(
  basePath: string,
  index: FeatureIndex
): Promise<Feature[]> {
  const features: Feature[] = [];
  const featureIds = Object.keys(index.features);

  // Load features in parallel for better performance
  const loadPromises = featureIds.map(async (id) => {
    const indexEntry = index.features[id];
    // Use unified resolver - it handles filePath, module, and fallback scanning
    const feature = await loadSingleFeature(basePath, id, indexEntry);
    if (feature) {
      return feature;
    }
    // If markdown file is missing, create minimal feature from index
    return {
      id,
      description: indexEntry.description,
      module: indexEntry.module,
      priority: indexEntry.priority,
      status: indexEntry.status,
      acceptance: [],
      dependsOn: [],
      supersedes: [],
      tags: [],
      version: 1,
      origin: "manual" as const,
      notes: "",
    };
  });

  const loadedFeatures = await Promise.all(loadPromises);
  features.push(...loadedFeatures);

  return features;
}

/**
 * Check if feature list exists
 * Checks for both new format (index.json) and legacy format
 */
export async function featureListExists(basePath: string): Promise<boolean> {
  // Check new format first
  const indexPath = path.join(basePath, TASKS_DIR, "index.json");
  try {
    await fs.access(indexPath);
    return true;
  } catch {
    // Fall through to check legacy format
  }

  // Check legacy format
  const legacyPath = path.join(basePath, FEATURE_LIST_PATH);
  try {
    await fs.access(legacyPath);
    return true;
  } catch {
    return false;
  }
}

/** Alias for loadFeatureList - loads a task list */
export const loadTaskList = loadFeatureList;

/** Alias for featureListExists - checks if task list exists */
export const taskListExists = featureListExists;
