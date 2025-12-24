/**
 * TDD guidance generation
 */

import type { Feature } from "../types/index.js";
import type { ExtendedCapabilities } from "../verifier/types/index.js";
import type { TDDGuidance, AcceptanceTestMapping } from "./types.js";
import { criterionToTestCase, criterionToE2EScenario } from "./criterion-converter.js";
import { generateTestFilePaths } from "./test-paths.js";

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
    const uiKeywords = [
      "user",
      "display",
      "show",
      "click",
      "navigate",
      "redirect",
      "form",
      "page",
      "button",
      "input",
      "message",
      "modal",
      "dialog",
      "toast",
      "notification",
      "error",
      "success",
    ];

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
