/**
 * Criterion conversion functions for TDD guidance
 */

import {
  prefixPatterns,
  imperativePatterns,
  verbPatterns,
  verbReplacements,
} from "./patterns.js";

/**
 * Convert an acceptance criterion to a unit test case name
 * Uses "should" prefix for standard test naming convention
 *
 * @example
 * criterionToTestCase("User can submit the form")
 * // Returns: "should allow user to submit the form"
 *
 * criterionToTestCase("API returns 201 status with created resource")
 * // Returns: "should return 201 status with created resource"
 */
export function criterionToTestCase(criterion: string): string {
  // Normalize the criterion
  let normalized = criterion.trim().toLowerCase();

  // Remove common prefixes
  for (const pattern of prefixPatterns) {
    normalized = normalized.replace(pattern, "");
  }

  // Handle imperative patterns first (Verify, Check, Ensure, Test, etc.)
  // These should be matched before other patterns
  for (const { pattern, format } of imperativePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      return format.replace("$1", match[1]);
    }
  }

  // Handle "X can Y" pattern -> "should allow X to Y"
  const canMatch = normalized.match(/^(.+?)\s+can\s+(.+)$/i);
  if (canMatch) {
    return `should allow ${canMatch[1]} to ${canMatch[2]}`;
  }

  // Handle "X should Y" pattern -> "should Y" (already in test format)
  const shouldMatch = normalized.match(/^.+?\s+should\s+(.+)$/i);
  if (shouldMatch) {
    return `should ${shouldMatch[1]}`;
  }

  // Handle verb patterns (returns, displays, shows, etc.)
  for (const { pattern, format } of verbPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      return format.replace("$2", match[2]);
    }
  }

  // Default: prefix with "should" if not already present
  if (normalized.startsWith("should ")) {
    return normalized;
  }

  return `should ${normalized}`;
}

/**
 * Convert an acceptance criterion to an E2E scenario name
 * Uses more user-focused language suitable for Playwright tests
 *
 * @example
 * criterionToE2EScenario("User can submit the form and see a success message")
 * // Returns: "user submits form and sees success message"
 */
export function criterionToE2EScenario(criterion: string): string {
  // Normalize the criterion
  let normalized = criterion.trim().toLowerCase();

  // Remove common prefixes
  for (const pattern of prefixPatterns) {
    normalized = normalized.replace(pattern, "");
  }

  // Handle "X can Y" pattern -> "X does Y"
  const canMatch = normalized.match(/^(.+?)\s+can\s+(.+)$/i);
  if (canMatch) {
    // Convert "can verb" to just the verb in present tense
    const subject = canMatch[1];
    let action = canMatch[2];

    // Try to convert to present tense action
    for (const [pattern, replacement] of verbReplacements) {
      action = action.replace(pattern, replacement);
    }

    return `${subject} ${action}`;
  }

  // Handle "X should Y" pattern -> "X does Y"
  const shouldMatch = normalized.match(/^(.+?)\s+should\s+(.+)$/i);
  if (shouldMatch) {
    return `${shouldMatch[1]} ${shouldMatch[2]}`;
  }

  // Remove "should" prefix if present
  if (normalized.startsWith("should ")) {
    normalized = normalized.substring(7);
  }

  return normalized;
}
