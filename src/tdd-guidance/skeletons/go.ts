/**
 * Go test skeleton generator
 */

import type { Feature } from "../../types/index.js";

/**
 * Generate Go test skeleton
 */
export function generateGoTestSkeleton(feature: Feature, testCases: string[]): string {
  const packageName = feature.module.toLowerCase().replace(/[^a-z0-9]/g, "");

  const testFunctions = testCases
    .map((testCase) => {
      const funcName =
        "Test" +
        testCase
          .replace(/^should\s+/i, "")
          .split(/\s+/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join("");
      return `func ${funcName}(t *testing.T) {
\t// ${testCase}
\t// Arrange
\t// TODO: Set up test data

\t// Act
\t// TODO: Call the function under test

\t// Assert
\t// TODO: Verify the expected outcome
\tif false {
\t\tt.Error("Test not implemented")
\t}
}`;
    })
    .join("\n\n");

  return `package ${packageName}

import (
\t"testing"
)

${testFunctions}
`;
}
