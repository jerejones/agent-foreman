/**
 * Test file path generation utilities
 */

import type { Feature } from "../types/index.js";
import type { ExtendedCapabilities } from "../verifier/types/index.js";

/**
 * Sanitize a module name to be filesystem-safe
 */
export function sanitizeModuleName(module: string): string {
  return module
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Get test file extension based on test framework
 */
export function getTestExtension(testFramework: string | undefined): string {
  switch (testFramework?.toLowerCase()) {
    case "vitest":
    case "jest":
      return ".ts";
    case "mocha":
      return ".ts";
    case "pytest":
      return ".py";
    case "go":
      return "_test.go";
    case "cargo":
      return ".rs";
    default:
      return ".ts"; // Default to TypeScript
  }
}

/**
 * Generate suggested test file paths based on feature and project structure
 */
export function generateTestFilePaths(
  feature: Feature,
  capabilities: ExtendedCapabilities | null,
  _projectRoot: string
): { unit: string[]; e2e: string[] } {
  const sanitizedModule = sanitizeModuleName(feature.module);
  const featureSlug = feature.id.split(".").pop() || feature.id;

  // Determine test file extension based on framework
  const testExt = getTestExtension(capabilities?.testFramework);
  const e2eExt = ".spec.ts"; // Playwright convention

  // Generate unit test paths
  const unitPaths: string[] = [];

  // Primary path based on module
  unitPaths.push(`tests/${sanitizedModule}/${featureSlug}.test${testExt}`);

  // Alternative flat structure
  unitPaths.push(`tests/${sanitizedModule}.${featureSlug}.test${testExt}`);

  // Generate E2E test paths
  const e2ePaths: string[] = [];

  // Primary Playwright structure
  e2ePaths.push(`e2e/${sanitizedModule}/${featureSlug}${e2eExt}`);

  // Alternative flat structure
  e2ePaths.push(`e2e/${featureSlug}${e2eExt}`);

  return { unit: unitPaths, e2e: e2ePaths };
}
