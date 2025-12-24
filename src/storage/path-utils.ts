/**
 * Path utility functions for task ID to path conversion
 *
 * NOTE: For new code, prefer using path-resolver.ts which provides
 * the unified resolveFeaturePath() function with better multi-part
 * module support and fallback scanning.
 */

import { deriveFeaturePath } from "./path-resolver.js";

/**
 * Convert task ID to file path (delegates to deriveFeaturePath)
 * e.g., "cli.survey" -> "cli/survey.md"
 * e.g., "asset.dashboard.BREAKDOWN" with module "asset.dashboard" -> "asset.dashboard/BREAKDOWN.md"
 *
 * @param id - The task ID
 * @param module - Optional module name (if provided, uses this as directory instead of first ID segment)
 * @returns Relative path to the markdown file
 */
export function featureIdToPath(id: string, module?: string): string {
  return deriveFeaturePath(id, module);
}

/**
 * Convert file path to task ID
 * e.g., "cli/survey.md" -> "cli.survey"
 *
 * @param filePath - The relative path to the markdown file
 * @returns Task ID
 */
export function pathToFeatureId(filePath: string): string {
  // Remove .md extension
  const withoutExt = filePath.replace(/\.md$/, "");
  // Replace path separator with dot
  return withoutExt.replace(/\//g, ".");
}
