/**
 * Migration operations
 * Handle migration from legacy format to modular markdown format
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Feature, FeatureIndex, FeatureStatus } from "../types/index.js";
import { INDEX_PATH, TASKS_DIR, LEGACY_FEATURE_LIST_PATH } from "./constants.js";
import type { MigrationResult } from "./types.js";
import { saveFeatureIndex } from "./index-ops.js";
import { saveSingleFeature } from "./single-ops.js";

/**
 * Check if migration from old format to new format is needed
 *
 * Returns true if:
 * - ai/feature_list.json exists
 * - ai/tasks/index.json does NOT exist
 *
 * @param cwd - The project root directory
 * @returns true if migration is needed
 */
export async function needsMigration(cwd: string): Promise<boolean> {
  const legacyPath = path.join(cwd, LEGACY_FEATURE_LIST_PATH);
  const indexPath = path.join(cwd, INDEX_PATH);

  // Check if index.json already exists
  try {
    await fs.access(indexPath);
    // index.json exists - no migration needed
    return false;
  } catch {
    // index.json doesn't exist - check for legacy file
  }

  // Check if legacy feature_list.json exists
  try {
    await fs.access(legacyPath);
    // Legacy file exists and index.json doesn't - migration needed
    return true;
  } catch {
    // Neither file exists - no migration needed
    return false;
  }
}

/**
 * Migrate from legacy feature_list.json to modular markdown format
 *
 * This function:
 * 1. Loads the existing feature_list.json
 * 2. Creates the ai/tasks/ directory structure
 * 3. Writes each feature to its own markdown file
 * 4. Builds and saves index.json
 * 5. Backs up the old file as feature_list.json.bak
 *
 * @param cwd - The project root directory
 * @returns MigrationResult with count and errors
 */
export async function migrateToMarkdown(cwd: string): Promise<MigrationResult> {
  const legacyPath = path.join(cwd, LEGACY_FEATURE_LIST_PATH);
  const backupPath = `${legacyPath}.bak`;
  const result: MigrationResult = {
    migrated: 0,
    errors: [],
    success: false,
  };

  // 1. Load existing feature_list.json
  let legacyData: { features: Feature[]; metadata: { projectGoal: string; createdAt: string; updatedAt: string; version: string } };
  try {
    const content = await fs.readFile(legacyPath, "utf-8");
    legacyData = JSON.parse(content);
  } catch (error) {
    result.errors.push(`Failed to load feature_list.json: ${(error as Error).message}`);
    return result;
  }

  // 2. Create ai/tasks/ directory structure
  try {
    await fs.mkdir(path.join(cwd, TASKS_DIR), { recursive: true });
  } catch (error) {
    result.errors.push(`Failed to create tasks directory: ${(error as Error).message}`);
    return result;
  }

  // 3. Write each feature to {module}/{name}.md
  const indexFeatures: Record<string, { status: FeatureStatus; priority: number; module: string; description: string }> = {};

  for (const feature of legacyData.features) {
    try {
      // Skip version increment during migration - preserve original version
      await saveSingleFeature(cwd, feature, { skipVersionIncrement: true });

      // Add to index
      indexFeatures[feature.id] = {
        status: feature.status,
        priority: feature.priority,
        module: feature.module,
        description: feature.description,
      };

      result.migrated++;
    } catch (error) {
      result.errors.push(`Failed to migrate feature ${feature.id}: ${(error as Error).message}`);
    }
  }

  // 4. Build and save index.json
  try {
    const index: FeatureIndex = {
      version: "2.0.0",
      updatedAt: new Date().toISOString(),
      metadata: legacyData.metadata,
      features: indexFeatures,
    };
    await saveFeatureIndex(cwd, index);
  } catch (error) {
    result.errors.push(`Failed to save index.json: ${(error as Error).message}`);
    return result;
  }

  // 5. Backup old file as feature_list.json.bak
  try {
    await fs.copyFile(legacyPath, backupPath);
  } catch (error) {
    result.errors.push(`Failed to backup feature_list.json: ${(error as Error).message}`);
    // Continue anyway - migration was successful even if backup failed
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Automatically migrate from legacy format if needed
 *
 * This function is safe to call multiple times (idempotent).
 * It will only perform migration if:
 * - ai/feature_list.json exists
 * - ai/tasks/index.json does NOT exist
 *
 * @param cwd - The project root directory
 * @param silent - If true, suppress console output (default: false)
 * @returns MigrationResult if migration was performed, null otherwise
 */
export async function autoMigrateIfNeeded(
  cwd: string,
  silent = false
): Promise<MigrationResult | null> {
  // Check if migration is needed
  const migrationNeeded = await needsMigration(cwd);

  if (!migrationNeeded) {
    return null;
  }

  // Log migration start
  if (!silent) {
    console.log("📦 Migrating feature list to modular format...");
  }

  // Perform migration
  const result = await migrateToMarkdown(cwd);

  // Log results
  if (!silent) {
    if (result.success) {
      console.log(`✓ Migrated ${result.migrated} tasks to ai/tasks/`);
      console.log("  Backup saved: ai/feature_list.json.bak");
    } else {
      console.log(`⚠ Migration completed with errors:`);
      for (const error of result.errors) {
        console.log(`  - ${error}`);
      }
    }
  }

  return result;
}
