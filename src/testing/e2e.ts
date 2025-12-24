/**
 * E2E test command building functions
 */

import type { Feature } from "../types/index.js";
import type { E2ECapabilityInfo } from "../verifier/types/index.js";
import type { E2EMode } from "./types.js";

/**
 * Build an E2E test command based on tags
 *
 * @param e2eInfo - E2E capability info from detection
 * @param tags - E2E tags from feature.e2eTags (e.g., ["@feature-auth", "@smoke"])
 * @param mode - E2E execution mode:
 *   - "full": Run all E2E tests (no grep filter)
 *   - "smoke": Run only @smoke tagged tests
 *   - "tags": Run tests matching the provided tags (OR logic)
 *   - "skip": Skip E2E tests entirely
 * @returns E2E test command or null if not available/skipped
 */
export function buildE2ECommand(
  e2eInfo: E2ECapabilityInfo | undefined,
  tags: string[] = [],
  mode: E2EMode = "tags"
): string | null {
  // Skip if E2E not available or mode is skip
  if (!e2eInfo?.available || !e2eInfo.command || mode === "skip") {
    return null;
  }

  // Full mode: run all E2E tests
  if (mode === "full" || (tags.length === 1 && tags[0] === "*")) {
    return e2eInfo.command;
  }

  // Smoke mode: run only @smoke tests
  if (mode === "smoke" || tags.length === 0) {
    return buildE2EGrepCommand(e2eInfo, ["@smoke"]);
  }

  // Tags mode: run tests matching the provided tags
  return buildE2EGrepCommand(e2eInfo, tags);
}

/**
 * Build E2E command with grep filter for specific tags
 * Multiple tags are joined with | for OR matching
 *
 * @param e2eInfo - E2E capability info
 * @param tags - Tags to filter (e.g., ["@feature-auth", "@smoke"])
 * @returns E2E command with grep filter
 */
function buildE2EGrepCommand(
  e2eInfo: E2ECapabilityInfo,
  tags: string[]
): string {
  // Use AI-discovered grep template if available
  if (e2eInfo.grepTemplate) {
    const tagPattern = tags.join("|");
    return e2eInfo.grepTemplate.replace("{tags}", `"${tagPattern}"`);
  }

  // Fallback to framework-specific patterns
  const tagPattern = tags.join("|");

  switch (e2eInfo.framework) {
    case "playwright":
      return `npx playwright test --grep "${tagPattern}"`;
    case "cypress":
      return `npx cypress run --spec "**/*" --env grep="${tagPattern}"`;
    case "puppeteer":
      // Puppeteer typically uses jest/mocha for running tests
      return `npx jest --testPathPattern "e2e" --testNamePattern "${tagPattern}"`;
    default:
      // Generic fallback using grep flag (works for many frameworks)
      return `${e2eInfo.command} --grep "${tagPattern}"`;
  }
}

/**
 * Get E2E tags for a feature
 * Returns feature.e2eTags if defined, otherwise empty array
 *
 * @param feature - Feature to get tags from
 * @returns Array of E2E tags
 */
export function getE2ETagsForFeature(feature: Feature): string[] {
  return feature.e2eTags || [];
}

/**
 * Determine E2E mode based on test mode and feature
 *
 * @param testMode - Overall test mode ("full" | "quick" | "skip")
 * @param hasE2ETags - Whether the feature has e2eTags defined
 * @returns E2E execution mode
 */
export function determineE2EMode(
  testMode: "full" | "quick" | "skip",
  hasE2ETags: boolean
): E2EMode {
  switch (testMode) {
    case "skip":
      return "skip";
    case "full":
      return "full";
    case "quick":
      // In quick mode, use feature tags if available, otherwise smoke
      return hasE2ETags ? "tags" : "smoke";
    default:
      return "smoke";
  }
}
