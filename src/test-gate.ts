/**
 * Test Gate Module
 * Verifies required test files exist before allowing feature completion
 */

import { glob } from "glob";
import type { Feature, FeatureListMetadata } from "./types/index.js";

/**
 * Result of test file gate verification
 */
export interface TestGateResult {
  /** Whether the gate passed (all required tests exist) */
  passed: boolean;
  /** Missing unit test patterns that had no matching files */
  missingUnitTests: string[];
  /** Missing E2E test patterns that had no matching files */
  missingE2ETests: string[];
  /** Test files that were found */
  foundTestFiles: string[];
  /** Any errors encountered during verification */
  errors: string[];
}

/**
 * Result of TDD gate verification
 * Extends TestGateResult with TDD-specific fields
 */
export interface TDDGateResult extends TestGateResult {
  /** Whether strict TDD mode is enabled */
  strictMode: boolean;
  /** Patterns that were checked for existence */
  checkedPatterns: string[];
}

/**
 * Verify that required test files exist for a feature
 *
 * @param cwd - Current working directory
 * @param feature - The feature to verify test files for
 * @returns Test gate result indicating pass/fail and details
 *
 * @example
 * const result = await verifyTestFilesExist(cwd, feature);
 * if (!result.passed) {
 *   console.log("Missing tests:", result.missingUnitTests);
 * }
 */
export async function verifyTestFilesExist(
  cwd: string,
  feature: Feature
): Promise<TestGateResult> {
  const result: TestGateResult = {
    passed: true,
    missingUnitTests: [],
    missingE2ETests: [],
    foundTestFiles: [],
    errors: [],
  };

  // If no testRequirements defined, gate passes automatically
  if (!feature.testRequirements) {
    return result;
  }

  // Check unit test requirements
  if (feature.testRequirements.unit?.required) {
    const pattern =
      feature.testRequirements.unit.pattern ||
      `tests/${sanitizeModuleName(feature.module)}/**/*.test.*`;

    try {
      const files = await glob(pattern, { cwd, nodir: true });

      if (files.length === 0) {
        result.passed = false;
        result.missingUnitTests.push(pattern);
      } else {
        result.foundTestFiles.push(...files);
      }
    } catch (error) {
      result.errors.push(
        `Error checking unit test pattern "${pattern}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Check E2E test requirements
  if (feature.testRequirements.e2e?.required) {
    const pattern =
      feature.testRequirements.e2e.pattern ||
      `e2e/**/*${sanitizeModuleName(feature.module)}*.spec.*`;

    try {
      const files = await glob(pattern, { cwd, nodir: true });

      if (files.length === 0) {
        result.passed = false;
        result.missingE2ETests.push(pattern);
      } else {
        result.foundTestFiles.push(...files);
      }
    } catch (error) {
      result.errors.push(
        `Error checking E2E test pattern "${pattern}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return result;
}

/**
 * Discover all test files for a feature based on its configuration
 *
 * @param cwd - Current working directory
 * @param feature - The feature to discover test files for
 * @returns Array of discovered test file paths (deduplicated)
 */
export async function discoverFeatureTestFiles(
  cwd: string,
  feature: Feature
): Promise<string[]> {
  const patterns: string[] = [];

  // Collect all patterns from testRequirements
  if (feature.testRequirements?.unit?.pattern) {
    patterns.push(feature.testRequirements.unit.pattern);
  }
  if (feature.testRequirements?.e2e?.pattern) {
    patterns.push(feature.testRequirements.e2e.pattern);
  }


  // Fallback to module-based pattern if no patterns found
  if (patterns.length === 0) {
    const sanitizedModule = sanitizeModuleName(feature.module);
    patterns.push(`tests/${sanitizedModule}/**/*.test.*`);
  }

  // Discover files matching all patterns
  const allFiles = new Set<string>();

  for (const pattern of patterns) {
    try {
      const files = await glob(pattern, { cwd, nodir: true });
      files.forEach((f) => allFiles.add(f));
    } catch {
      // Ignore glob errors for discovery
    }
  }

  return Array.from(allFiles);
}

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
 * Verify TDD gate for a feature based on project-wide TDD mode settings
 *
 * In strict mode:
 * - All features require tests regardless of testRequirements.*.required
 * - Gate fails if no test files match the default pattern
 *
 * In recommended/disabled mode:
 * - Only checks explicit testRequirements.*.required = true
 *
 * @param cwd - Current working directory
 * @param feature - The feature to verify
 * @param metadata - Feature list metadata containing tddMode
 * @returns TDD gate result
 */
export async function verifyTDDGate(
  cwd: string,
  feature: Feature,
  metadata?: FeatureListMetadata
): Promise<TDDGateResult> {
  const strictMode = metadata?.tddMode === "strict";

  const result: TDDGateResult = {
    passed: true,
    missingUnitTests: [],
    missingE2ETests: [],
    foundTestFiles: [],
    errors: [],
    strictMode,
    checkedPatterns: [],
  };

  // Determine if we should check for tests
  const shouldCheckUnitTests =
    strictMode || feature.testRequirements?.unit?.required === true;
  const shouldCheckE2ETests = feature.testRequirements?.e2e?.required === true;

  // If nothing to check, return passing result
  if (!shouldCheckUnitTests && !shouldCheckE2ETests) {
    return result;
  }

  // Check unit tests
  if (shouldCheckUnitTests) {
    const unitPattern =
      feature.testRequirements?.unit?.pattern ||
      `tests/${sanitizeModuleName(feature.module)}/**/*.test.*`;

    result.checkedPatterns.push(unitPattern);

    try {
      const files = await glob(unitPattern, { cwd, nodir: true });

      if (files.length === 0) {
        result.passed = false;
        result.missingUnitTests.push(unitPattern);
      } else {
        result.foundTestFiles.push(...files);
      }
    } catch (error) {
      result.errors.push(
        `Error checking unit test pattern "${unitPattern}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Check E2E tests (only if explicitly required, not affected by strict mode)
  if (shouldCheckE2ETests) {
    const e2ePattern =
      feature.testRequirements?.e2e?.pattern ||
      `e2e/**/*${sanitizeModuleName(feature.module)}*.spec.*`;

    result.checkedPatterns.push(e2ePattern);

    try {
      const files = await glob(e2ePattern, { cwd, nodir: true });

      if (files.length === 0) {
        result.passed = false;
        result.missingE2ETests.push(e2ePattern);
      } else {
        result.foundTestFiles.push(...files);
      }
    } catch (error) {
      result.errors.push(
        `Error checking E2E test pattern "${e2ePattern}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return result;
}
