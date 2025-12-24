/**
 * Universal Verification Strategy conversion utilities
 * Converts legacy testRequirements to the new strategy format
 */

import type { Feature, TestRequirements, TaskType } from "../types/index.js";
import type {
  VerificationStrategy,
  TestVerificationStrategy,
  E2EVerificationStrategy,
  AiVerificationStrategy,
  ScriptVerificationStrategy,
  FileVerificationStrategy,
  CommandVerificationStrategy,
  ManualVerificationStrategy,
} from "./types/index.js";

/**
 * Convert legacy testRequirements to verification strategies
 *
 * This function enables backward compatibility by converting the existing
 * testRequirements structure to the new Universal Verification Strategy format.
 *
 * @param testRequirements - Legacy test requirements from feature
 * @returns Array of verification strategies
 */
export function convertTestRequirementsToStrategies(
  testRequirements: TestRequirements | undefined
): VerificationStrategy[] {
  if (!testRequirements) {
    return [];
  }

  const strategies: VerificationStrategy[] = [];

  // Convert unit test requirements to TestVerificationStrategy
  if (testRequirements.unit) {
    const unitStrategy: TestVerificationStrategy = {
      type: "test",
      required: testRequirements.unit.required,
      pattern: testRequirements.unit.pattern,
      cases: testRequirements.unit.cases,
    };
    strategies.push(unitStrategy);
  }

  // Convert e2e test requirements to E2EVerificationStrategy
  if (testRequirements.e2e) {
    const e2eStrategy: E2EVerificationStrategy = {
      type: "e2e",
      required: testRequirements.e2e.required,
      pattern: testRequirements.e2e.pattern,
      tags: testRequirements.e2e.tags,
      scenarios: testRequirements.e2e.scenarios,
    };
    strategies.push(e2eStrategy);
  }

  return strategies;
}

/**
 * Get default verification strategies for a task type
 *
 * Each task type has sensible defaults:
 * - code: Test + AI verification
 * - ops: Script + AI verification
 * - data: File checks + AI verification
 * - infra: Command (terraform validate) + AI verification
 * - manual: Manual review only
 *
 * @param taskType - The task type to get defaults for
 * @returns Array of default verification strategies
 */
export function getDefaultStrategiesForTaskType(taskType: TaskType): VerificationStrategy[] {
  switch (taskType) {
    case "code":
      return [
        { type: "test", required: false } as TestVerificationStrategy,
        { type: "ai", required: true } as AiVerificationStrategy,
      ];
    case "ops":
      return [
        { type: "script", required: false, path: "./verify.sh" } as ScriptVerificationStrategy,
        { type: "ai", required: true } as AiVerificationStrategy,
      ];
    case "data":
      return [
        { type: "file", required: false, path: "" } as FileVerificationStrategy,
        { type: "ai", required: true } as AiVerificationStrategy,
      ];
    case "infra":
      return [
        { type: "command", required: false, command: "terraform validate" } as CommandVerificationStrategy,
        { type: "ai", required: true } as AiVerificationStrategy,
      ];
    case "manual":
      return [
        { type: "manual", required: true } as ManualVerificationStrategy,
      ];
    default:
      // Default to AI verification for unknown task types
      return [{ type: "ai", required: true } as AiVerificationStrategy];
  }
}

/**
 * Get verification strategies for a feature/task
 *
 * Resolution priority order:
 * 1. Explicit verificationStrategies - takes precedence
 * 2. Convert legacy testRequirements - backward compatibility
 * 3. TaskType defaults - sensible defaults per task type
 * 4. Default to AI autonomous - current behavior for existing features
 *
 * @param feature - The feature to get verification strategies for
 * @returns Array of verification strategies to execute
 */
export function getVerificationStrategies(feature: Feature): VerificationStrategy[] {
  // 1. Explicit strategies take precedence
  if (feature.verificationStrategies && feature.verificationStrategies.length > 0) {
    return feature.verificationStrategies;
  }

  // 2. Convert legacy testRequirements
  if (feature.testRequirements) {
    const converted = convertTestRequirementsToStrategies(feature.testRequirements);
    if (converted.length > 0) {
      return converted;
    }
  }

  // 3. TaskType defaults
  if (feature.taskType) {
    return getDefaultStrategiesForTaskType(feature.taskType);
  }

  // 4. Default to AI autonomous (current behavior for backward compatibility)
  return [{ type: "ai", required: true } as AiVerificationStrategy];
}

/**
 * Check if a feature should use strategy-based verification
 * Returns true if the feature has explicit strategies or legacy testRequirements
 * that can be converted to strategies
 */
export function shouldUseStrategyVerification(feature: Feature): boolean {
  // Has explicit verification strategies
  if (feature.verificationStrategies && feature.verificationStrategies.length > 0) {
    return true;
  }

  // Has testRequirements that can be converted
  if (feature.testRequirements) {
    const converted = convertTestRequirementsToStrategies(feature.testRequirements);
    // Only use strategy verification if we got non-AI strategies
    // This preserves backward compatibility for features without explicit test patterns
    return converted.some((s) => s.type !== "ai");
  }

  // Has taskType that maps to specific strategies
  if (feature.taskType) {
    const defaults = getDefaultStrategiesForTaskType(feature.taskType);
    return defaults.some((s) => s.type !== "ai");
  }

  return false;
}
