/**
 * Vitest test skeleton generator
 */

import type { Feature } from "../../types/index.js";

/**
 * Generate Vitest test skeleton
 */
export function generateVitestSkeleton(feature: Feature, testCases: string[]): string {
  const featureName = feature.id.split(".").pop() || feature.id;
  const modulePath = `../src/${feature.module}/${featureName}.js`;

  const imports = `import { describe, it, expect, beforeEach, afterEach } from "vitest";
// import { ... } from "${modulePath}";
`;

  const testBlocks = testCases
    .map(
      (testCase) => `  it("${testCase}", () => {
    // Arrange
    // TODO: Set up test data and mocks

    // Act
    // TODO: Call the function/method under test

    // Assert
    // TODO: Verify the expected outcome
    expect(true).toBe(true); // Replace with actual assertion
  });`
    )
    .join("\n\n");

  return `${imports}
describe("${featureName}", () => {
  beforeEach(() => {
    // TODO: Set up before each test
  });

  afterEach(() => {
    // TODO: Clean up after each test
  });

${testBlocks}
});
`;
}
