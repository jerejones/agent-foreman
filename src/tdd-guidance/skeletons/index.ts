/**
 * Test skeleton generators
 */

import type { Feature } from "../../types/index.js";
import type { TestFramework } from "../types.js";
import { generateVitestSkeleton } from "./vitest.js";
import { generateJestSkeleton } from "./jest.js";
import { generateMochaSkeleton } from "./mocha.js";
import { generatePytestSkeleton } from "./pytest.js";
import { generateGoTestSkeleton } from "./go.js";
import { generateCargoTestSkeleton } from "./cargo.js";

// Re-export E2E skeleton
export { generateE2ETestSkeleton } from "./playwright.js";

/**
 * Generate a unit test file skeleton for a feature
 *
 * @param feature - The feature to generate tests for
 * @param testCases - Array of test case names
 * @param framework - Test framework to use
 * @returns String containing the test file skeleton
 */
export function generateUnitTestSkeleton(
  feature: Feature,
  testCases: string[],
  framework: TestFramework
): string {
  switch (framework) {
    case "vitest":
      return generateVitestSkeleton(feature, testCases);
    case "jest":
      return generateJestSkeleton(feature, testCases);
    case "mocha":
      return generateMochaSkeleton(feature, testCases);
    case "pytest":
      return generatePytestSkeleton(feature, testCases);
    case "go":
      return generateGoTestSkeleton(feature, testCases);
    case "cargo":
      return generateCargoTestSkeleton(feature, testCases);
    default:
      return generateVitestSkeleton(feature, testCases);
  }
}
