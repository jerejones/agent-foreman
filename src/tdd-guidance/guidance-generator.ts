/**
 * TDD Guidance Generator - main guidance generation logic
 */

import type { Feature } from "../types.js";
import type { ExtendedCapabilities } from "../verification-types.js";
import type { TDDGuidance, AcceptanceTestMapping } from "./types.js";
import { criterionToTestCase, criterionToE2EScenario } from "./criterion-mapper.js";
import { uiKeywords } from "./patterns.js";

/**
 * Sanitize a module name to be filesystem-safe
 */
function sanitizeModuleName(module: string): string {
  return module
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Get test file extension based on test framework
 */
function getTestExtension(testFramework: string | undefined): string {
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
function generateTestFilePaths(
  feature: Feature,
  capabilities: ExtendedCapabilities | null,
  projectRoot: string
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

/**
 * Generate TDD guidance for a feature
 *
 * @param feature - The feature to generate guidance for
 * @param capabilities - Detected project capabilities (or null if unknown)
 * @param projectRoot - Root directory of the project
 * @returns TDD guidance with suggested test files and case names
 */
export function generateTDDGuidance(
  feature: Feature,
  capabilities: ExtendedCapabilities | null,
  projectRoot: string
): TDDGuidance {
  // Generate suggested test file paths
  const suggestedTestFiles = generateTestFilePaths(feature, capabilities, projectRoot);

  // Map acceptance criteria to test cases
  const acceptanceMapping: AcceptanceTestMapping[] = feature.acceptance.map((criterion) => {
    const unitTestCase = criterionToTestCase(criterion);

    // Determine if this criterion needs an E2E test
    // UI-related keywords suggest E2E testing
    const needsE2E = uiKeywords.some((keyword) =>
      criterion.toLowerCase().includes(keyword)
    );

    return {
      criterion,
      unitTestCase,
      e2eScenario: needsE2E ? criterionToE2EScenario(criterion) : undefined,
    };
  });

  // Generate test case stubs
  const testCaseStubs = {
    unit: acceptanceMapping.map((m) => m.unitTestCase),
    e2e: acceptanceMapping
      .filter((m) => m.e2eScenario)
      .map((m) => m.e2eScenario as string),
  };

  return {
    featureId: feature.id,
    suggestedTestFiles,
    testCaseStubs,
    acceptanceMapping,
  };
}
