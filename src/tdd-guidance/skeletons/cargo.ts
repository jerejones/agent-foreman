/**
 * Rust/Cargo test skeleton generator
 */

import type { Feature } from "../../types/index.js";

/**
 * Generate Rust/Cargo test skeleton
 */
export function generateCargoTestSkeleton(feature: Feature, testCases: string[]): string {
  const featureName = feature.id.split(".").pop() || feature.id;

  const testFunctions = testCases
    .map((testCase) => {
      const funcName = testCase
        .replace(/^should\s+/i, "test_")
        .replace(/\s+/g, "_")
        .toLowerCase();
      return `    #[test]
    fn ${funcName}() {
        // ${testCase}
        // Arrange
        // TODO: Set up test data

        // Act
        // TODO: Call the function under test

        // Assert
        // TODO: Verify the expected outcome
        assert!(true); // Replace with actual assertion
    }`;
    })
    .join("\n\n");

  return `#[cfg(test)]
mod ${featureName.replace(/-/g, "_")}_tests {
    use super::*;

${testFunctions}
}
`;
}
