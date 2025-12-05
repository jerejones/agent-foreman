/**
 * TDD Guidance Generator
 * Converts acceptance criteria to test case suggestions for TDD workflow
 *
 * This module is split into focused submodules:
 * - types: Type definitions (TDDGuidance, AcceptanceTestMapping, TestFramework)
 * - patterns: Pattern matching rules for criterion conversion
 * - criterion-mapper: Criterion to test case conversion functions
 * - guidance-generator: Main guidance generation logic
 * - skeleton-generator: Unit test skeleton generators for various frameworks
 * - e2e-scenarios: Playwright E2E test skeleton generator
 */

// Re-export types
export type {
  TDDGuidance,
  AcceptanceTestMapping,
  TestFramework,
} from "./types.js";

// Re-export patterns
export {
  prefixPatterns,
  imperativePatterns,
  verbPatterns,
  uiKeywords,
  verbReplacements,
} from "./patterns.js";

// Re-export criterion mappers
export {
  criterionToTestCase,
  criterionToE2EScenario,
} from "./criterion-mapper.js";

// Re-export guidance generator
export { generateTDDGuidance } from "./guidance-generator.js";

// Re-export unit test skeleton generators
export { generateUnitTestSkeleton } from "./skeleton-generator.js";

// Re-export E2E test skeleton generator
export { generateE2ETestSkeleton } from "./e2e-scenarios.js";
