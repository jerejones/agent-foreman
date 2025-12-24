/**
 * TDD Guidance Generator
 * Converts acceptance criteria to test case suggestions for TDD workflow
 */

// Types
export type { TDDGuidance, AcceptanceTestMapping, TestFramework } from "./types.js";

// Criterion conversion
export { criterionToTestCase, criterionToE2EScenario } from "./criterion-converter.js";

// Test path generation
export { sanitizeModuleName, getTestExtension, generateTestFilePaths } from "./test-paths.js";

// Guidance generation
export { generateTDDGuidance } from "./guidance-generator.js";

// Test skeleton generators
export { generateUnitTestSkeleton, generateE2ETestSkeleton } from "./skeletons/index.js";
