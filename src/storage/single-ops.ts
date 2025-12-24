/**
 * Single feature operations
 * Load and save individual feature markdown files
 * Supports optimistic locking via version field for concurrent modification detection
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Feature, FeatureIndexEntry } from "../types/index.js";
import { TASKS_DIR } from "./constants.js";
import { resolveFeaturePath, deriveFeaturePath } from "./path-resolver.js";
import { parseFeatureMarkdown } from "./parser.js";
import matter from "gray-matter";
import { serializeFeatureMarkdown, buildFrontmatter } from "./serializer.js";
import { FeatureConflictError } from "./errors.js";

/**
 * Load a single task from its markdown file in ai/tasks/
 *
 * @param cwd - The project root directory
 * @param featureId - The task ID (e.g., "cli.survey", "asset.dashboard.BREAKDOWN")
 * @param indexEntry - Optional index entry containing filePath and module for accurate resolution
 * @returns Feature object or null if file doesn't exist
 *
 * @example
 * // Simple usage with index entry
 * const feature = await loadSingleFeature(cwd, id, index.features[id]);
 *
 * // Minimal usage (relies on ID-based path derivation)
 * const feature = await loadSingleFeature(cwd, id);
 */
export async function loadSingleFeature(
  cwd: string,
  featureId: string,
  indexEntry?: FeatureIndexEntry
): Promise<Feature | null> {
  // Use unified resolver to find the file
  const relativePath = await resolveFeaturePath(cwd, featureId, indexEntry);

  if (!relativePath) {
    return null;
  }

  const fullPath = path.join(cwd, TASKS_DIR, relativePath);

  try {
    const content = await fs.readFile(fullPath, "utf-8");
    const feature = parseFeatureMarkdown(content);

    // Preserve the resolved path on feature for later saves
    if (feature) {
      feature.filePath = relativePath;
    }

    return feature;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export interface SaveFeatureOptions {
  /** Expected version for conflict detection (optional) */
  expectedVersion?: number;
  /** Skip version increment (for migration or other special cases) */
  skipVersionIncrement?: boolean;
}

/**
 * Save a single feature to its markdown file in ai/tasks/
 * Skips write if content is unchanged to preserve file timestamps.
 * Supports optimistic locking: increments version on save, detects conflicts.
 *
 * @param cwd - The project root directory
 * @param feature - The Feature object to save
 * @param expectedVersionOrOptions - Expected version number or options object
 * @returns true if file was written, false if skipped (unchanged)
 * @throws FeatureConflictError if concurrent modification detected
 */
export async function saveSingleFeature(
  cwd: string,
  feature: Feature,
  expectedVersionOrOptions?: number | SaveFeatureOptions
): Promise<boolean> {
  // Parse options
  const options: SaveFeatureOptions =
    typeof expectedVersionOrOptions === "number"
      ? { expectedVersion: expectedVersionOrOptions }
      : expectedVersionOrOptions ?? {};
  const { expectedVersion, skipVersionIncrement } = options;

  // Use filePath if already set, otherwise derive from ID and module
  const relativePath = feature.filePath || deriveFeaturePath(feature.id, feature.module);
  const fullPath = path.join(cwd, TASKS_DIR, relativePath);

  // Check for conflicts if expectedVersion is provided
  if (expectedVersion !== undefined) {
    try {
      const existingContent = await fs.readFile(fullPath, "utf-8");
      const existingFeature = parseFeatureMarkdown(existingContent);

      if (existingFeature.version !== expectedVersion) {
        throw new FeatureConflictError(
          feature.id,
          expectedVersion,
          existingFeature.version
        );
      }
    } catch (error) {
      if (error instanceof FeatureConflictError) {
        throw error;
      }
      // File doesn't exist - OK to create
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  // Increment version for the save (unless skipped for migration)
  // Also keep tddGuidance.forVersion in sync to preserve cache validity
  const newVersion = skipVersionIncrement ? feature.version : (feature.version || 1) + 1;
  const featureToSave: Feature = skipVersionIncrement
    ? feature
    : {
        ...feature,
        version: newVersion,
        // Keep tddGuidance cache valid across version increments
        tddGuidance: feature.tddGuidance
          ? { ...feature.tddGuidance, forVersion: newVersion }
          : undefined,
      };

  // Serialize new content
  const newContent = serializeFeatureMarkdown(featureToSave);

  // Check if file exists and content is unchanged
  try {
    const existingContent = await fs.readFile(fullPath, "utf-8");
    if (existingContent === newContent) {
      // Content unchanged, skip write
      return false;
    }
  } catch (error) {
    // File doesn't exist, will create it
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  // Ensure module directory exists
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  // Write new content
  await fs.writeFile(fullPath, newContent, "utf-8");
  return true;
}

/**
 * Save only frontmatter changes, preserve body content exactly as-is.
 * This is the SAFE default for most operations (status, priority changes).
 * Supports optimistic locking: increments version on save, detects conflicts.
 *
 * IMPORTANT: This function NEVER modifies body content, preventing data loss
 * from lossy parse/serialize cycles.
 *
 * @param cwd - The project root directory
 * @param feature - The Feature object to save (only frontmatter fields used)
 * @param expectedVersion - Optional expected version for conflict detection
 * @returns true if file was written, false if skipped (unchanged or new file)
 * @throws FeatureConflictError if concurrent modification detected
 */
export async function saveSingleFeatureFrontmatterOnly(
  cwd: string,
  feature: Feature,
  expectedVersion?: number
): Promise<boolean> {
  // Use filePath if already set, otherwise derive from ID and module
  const relativePath = feature.filePath || deriveFeaturePath(feature.id, feature.module);
  const fullPath = path.join(cwd, TASKS_DIR, relativePath);

  // Read existing file content
  let existingContent: string;
  try {
    existingContent = await fs.readFile(fullPath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // File doesn't exist - use full save for new files
      return saveSingleFeature(cwd, feature, expectedVersion);
    }
    throw error;
  }

  // Check for conflicts if expectedVersion is provided
  if (expectedVersion !== undefined) {
    const existingFeature = parseFeatureMarkdown(existingContent);
    if (existingFeature.version !== expectedVersion) {
      throw new FeatureConflictError(
        feature.id,
        expectedVersion,
        existingFeature.version
      );
    }
  }

  // Parse existing file to extract body (which we'll preserve exactly)
  const { content: existingBody } = matter(existingContent);

  // Increment version for the save
  // Also keep tddGuidance.forVersion in sync to preserve cache validity
  const newVersion = (feature.version || 1) + 1;
  const featureWithNewVersion: Feature = {
    ...feature,
    version: newVersion,
    // Keep tddGuidance cache valid across version increments
    tddGuidance: feature.tddGuidance
      ? { ...feature.tddGuidance, forVersion: newVersion }
      : undefined,
  };

  // Build new frontmatter from feature object (with incremented version)
  const newFrontmatter = buildFrontmatter(featureWithNewVersion);

  // Combine new frontmatter with EXISTING body (unchanged!)
  const newContent = matter.stringify(existingBody, newFrontmatter);

  // Skip if content is identical
  if (existingContent === newContent) {
    return false;
  }

  // Write updated content (frontmatter changed, body preserved)
  await fs.writeFile(fullPath, newContent, "utf-8");
  return true;
}
