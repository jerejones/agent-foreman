/**
 * TDD Guidance Types
 */

/**
 * TDD guidance for a feature
 */
export interface TDDGuidance {
  /** Feature ID this guidance is for */
  featureId: string;
  /** Suggested test file paths */
  suggestedTestFiles: {
    unit: string[];
    e2e: string[];
  };
  /** Test case stubs for each type */
  testCaseStubs: {
    unit: string[];
    e2e: string[];
  };
  /** Mapping from acceptance criteria to test cases */
  acceptanceMapping: AcceptanceTestMapping[];
}

/**
 * Maps an acceptance criterion to corresponding test cases
 */
export interface AcceptanceTestMapping {
  /** Original acceptance criterion */
  criterion: string;
  /** Suggested unit test case name */
  unitTestCase: string;
  /** Suggested E2E scenario name (if applicable) */
  e2eScenario?: string;
}

/**
 * Supported test frameworks for unit test skeleton generation
 */
export type TestFramework = "vitest" | "jest" | "mocha" | "pytest" | "go" | "cargo";
