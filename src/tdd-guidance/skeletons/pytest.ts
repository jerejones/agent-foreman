/**
 * Pytest test skeleton generator
 */

import type { Feature } from "../../types/index.js";

/**
 * Generate pytest test skeleton
 */
export function generatePytestSkeleton(feature: Feature, testCases: string[]): string {
  const featureName = feature.id.split(".").pop() || feature.id;
  const className = featureName
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

  const imports = `import pytest
# from ${feature.module}.${featureName} import ...
`;

  const testFunctions = testCases
    .map((testCase) => {
      const funcName = testCase
        .replace(/^should\s+/i, "test_")
        .replace(/\s+/g, "_")
        .toLowerCase();
      return `    def ${funcName}(self):
        """${testCase}"""
        # Arrange
        # TODO: Set up test data

        # Act
        # TODO: Call the function under test

        # Assert
        # TODO: Verify the expected outcome
        assert True  # Replace with actual assertion`;
    })
    .join("\n\n");

  return `${imports}

class Test${className}:
    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test fixtures"""
        # TODO: Set up before each test
        yield
        # TODO: Clean up after each test

${testFunctions}
`;
}
