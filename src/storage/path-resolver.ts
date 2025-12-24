/**
 * Unified Task File Path Resolver
 * Single source of truth for all task file path resolution
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import matter from "gray-matter";
import { TASKS_DIR } from "./constants.js";
import type { FeatureIndexEntry } from "../types/index.js";

/**
 * Options for resolving feature file path
 */
export interface ResolvePathOptions {
  /** Explicit file path (relative to ai/tasks/) - highest priority */
  filePath?: string;
  /** Module name for path derivation (e.g., "asset.dashboard") */
  module?: string;
}

/**
 * Resolve the file path for a task/feature
 *
 * This is the SINGLE source of truth for all path resolution.
 * All code that needs to find a task file should use this function.
 *
 * Resolution priority:
 * 1. Explicit filePath - use directly if provided
 * 2. Module-based derivation - {module}/{remaining}.md
 * 3. ID-based fallback - {firstPart}/{rest}.md (legacy)
 * 4. Directory scan - find file by frontmatter ID match
 *
 * @param cwd - Project root directory
 * @param featureId - The task ID (e.g., "asset.dashboard.BREAKDOWN")
 * @param options - Optional resolution hints (filePath, module) or FeatureIndexEntry
 * @returns Relative path to the file (e.g., "asset.dashboard/BREAKDOWN.md") or null if not found
 */
export async function resolveFeaturePath(
  cwd: string,
  featureId: string,
  options?: ResolvePathOptions | FeatureIndexEntry
): Promise<string | null> {
  const filePath = options?.filePath;
  const module = options?.module;

  // Priority 1: Explicit filePath
  if (filePath) {
    const fullPath = path.join(cwd, TASKS_DIR, filePath);
    if (await fileExists(fullPath)) {
      return filePath;
    }
    // Explicit path doesn't exist - don't try fallbacks
    return null;
  }

  // Priority 2: Module-based derivation
  if (module && featureId.startsWith(module + ".")) {
    const name = featureId.slice(module.length + 1);
    const derivedPath = `${module}/${name}.md`;
    const fullPath = path.join(cwd, TASKS_DIR, derivedPath);
    if (await fileExists(fullPath)) {
      return derivedPath;
    }
  }

  // Priority 3: ID-based derivation (legacy - first segment as module)
  const parts = featureId.split(".");
  if (parts.length >= 2) {
    const firstPart = parts[0];
    const rest = parts.slice(1).join(".");
    const legacyPath = `${firstPart}/${rest}.md`;
    const fullPath = path.join(cwd, TASKS_DIR, legacyPath);
    if (await fileExists(fullPath)) {
      return legacyPath;
    }
  }

  // Priority 4: Directory scan - find file by frontmatter ID match
  return scanForFeatureFile(cwd, featureId, module);
}

/**
 * Derive file path from feature ID and module (synchronous, no file check)
 * Use this only when you're sure the file exists or for save operations.
 *
 * @param featureId - The task ID
 * @param module - Optional module name for accurate derivation
 * @returns Relative path (e.g., "asset.dashboard/BREAKDOWN.md")
 */
export function deriveFeaturePath(featureId: string, module?: string): string {
  // If module is provided and ID starts with it, use module as directory
  if (module && featureId.startsWith(module + ".")) {
    const name = featureId.slice(module.length + 1);
    return `${module}/${name}.md`;
  }

  // Fallback: use first segment as directory (legacy)
  const parts = featureId.split(".");
  if (parts.length === 1) {
    return `${featureId}.md`;
  }
  const firstPart = parts[0];
  const rest = parts.slice(1).join(".");
  return `${firstPart}/${rest}.md`;
}

/**
 * Scan directories to find a file with matching feature ID in frontmatter
 * Handles cases where filename doesn't match ID convention
 */
async function scanForFeatureFile(
  cwd: string,
  featureId: string,
  module?: string
): Promise<string | null> {
  const parts = featureId.split(".");
  if (parts.length < 2) {
    return null;
  }

  // Build list of directories to scan
  const dirsToScan: string[] = [];

  // If module is provided, try it first
  if (module) {
    dirsToScan.push(module);
  }

  // Try progressively longer prefixes (e.g., "asset", "asset.dashboard")
  for (let i = 1; i < parts.length; i++) {
    const possibleDir = parts.slice(0, i).join(".");
    if (!dirsToScan.includes(possibleDir)) {
      dirsToScan.push(possibleDir);
    }
  }

  // Scan each directory
  for (const dir of dirsToScan) {
    const dirPath = path.join(cwd, TASKS_DIR, dir);

    try {
      const files = await fs.readdir(dirPath);
      const mdFiles = files.filter(f => f.endsWith(".md"));

      for (const file of mdFiles) {
        const filePath = path.join(dirPath, file);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          const parsed = matter(content);
          if (parsed.data.id === featureId) {
            return `${dir}/${file}`;
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch {
      // Directory doesn't exist, try next
    }
  }

  return null;
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
