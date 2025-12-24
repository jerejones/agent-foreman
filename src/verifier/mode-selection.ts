/**
 * Verification mode selection
 * Determines whether to use TDD or AI verification
 */

import type { Feature, FeatureListMetadata } from "../types/index.js";
import type { VerificationMode } from "./types/index.js";

/**
 * Determine the verification mode for a feature based on its configuration
 * and project-wide TDD settings.
 *
 * TDD mode is activated when:
 * 1. Project metadata has tddMode: "strict", OR
 * 2. Feature has explicit test requirements (required: true)
 *
 * In TDD mode, verification requires tests to exist and pass.
 *
 * @param feature - The feature to check
 * @param metadata - Optional feature list metadata for project-wide settings
 * @returns 'tdd' if strict mode or tests required, otherwise 'ai'
 */
export function determineVerificationMode(
  feature: Feature,
  metadata?: FeatureListMetadata
): VerificationMode {
  // Check project-wide strict TDD mode
  if (metadata?.tddMode === "strict") {
    return "tdd";
  }

  // Check if feature has TDD test requirements
  const hasUnitTestRequirement = feature.testRequirements?.unit?.required === true;
  const hasE2ETestRequirement = feature.testRequirements?.e2e?.required === true;

  // Return 'tdd' if any test requirement is explicitly required
  if (hasUnitTestRequirement || hasE2ETestRequirement) {
    return "tdd";
  }

  // Default to AI-powered verification
  return "ai";
}
