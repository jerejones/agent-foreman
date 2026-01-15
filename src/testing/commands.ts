/**
 * Test command building functions
 */

import type { Feature } from "../types/index.js";
import type { VerificationCapabilities, TestCapabilityInfo } from "../verifier/types/index.js";
import type { TestDiscoveryResult } from "./types.js";
import { discoverTestsForFeature } from "./discovery.js";

/**
 * Extended capabilities interface that includes TestCapabilityInfo
 */
interface ExtendedTestCapabilities extends VerificationCapabilities {
  testInfo?: TestCapabilityInfo;
}

/**
 * Check if a pattern is a glob pattern (not suitable for regex-based test filters)
 * Go's -run flag expects regex patterns, not glob patterns like "**"
 */
function isGlobPattern(pattern: string): boolean {
  return pattern.includes("**") || pattern.includes("*/") || pattern.includes("/*");
}

/**
 * Build a selective test command using AI-discovered templates or fallback patterns
 *
 * Priority:
 * 1. Use selectiveFileTemplate from AI-discovered capabilities (if test files found)
 * 2. Use selectiveNameTemplate from AI-discovered capabilities (if pattern provided)
 * 3. Fall back to hardcoded framework patterns
 */
export function buildSelectiveTestCommand(
  capabilities: VerificationCapabilities | ExtendedTestCapabilities,
  pattern: string | null,
  discovery: TestDiscoveryResult
): string | null {
  if (!capabilities.hasTests || !capabilities.testCommand) {
    return null;
  }

  // If no pattern, use full test command
  if (!pattern) {
    return capabilities.testCommand;
  }

  const baseCommand = capabilities.testCommand;
  const framework = capabilities.testFramework;

  // Check for AI-discovered selective test templates
  const testInfo = (capabilities as ExtendedTestCapabilities).testInfo;

  if (testInfo) {
    // Priority 1: Use selectiveFileTemplate if we have specific test files
    if (discovery.testFiles.length > 0 && testInfo.selectiveFileTemplate) {
      const filesStr = discovery.testFiles.join(" ");
      return testInfo.selectiveFileTemplate.replace("{files}", filesStr);
    }

    // Priority 2: Use selectiveNameTemplate for pattern-based filtering
    if (testInfo.selectiveNameTemplate) {
      // Skip pattern-based filtering for frameworks that need regex when pattern is a glob
      // Go's -run flag expects regex, not glob patterns like "**"
      const isGoFramework = testInfo.framework === "go" || framework === "go";
      if (isGlobPattern(pattern) && isGoFramework) {
        // Fall back to full test command instead of invalid regex
        return capabilities.testCommand;
      }
      return testInfo.selectiveNameTemplate.replace("{pattern}", pattern);
    }
  }

  // Priority 3: Fall back to hardcoded framework patterns
  return buildHardcodedSelectiveCommand(framework, baseCommand, pattern, discovery);
}

/**
 * Fallback: Build selective test command using hardcoded framework patterns
 * Used when AI-discovered templates are not available
 */
function buildHardcodedSelectiveCommand(
  framework: string | undefined,
  baseCommand: string,
  pattern: string,
  discovery: TestDiscoveryResult
): string {
  switch (framework) {
    case "vitest":
      if (discovery.testFiles.length > 0) {
        return `npx vitest run ${discovery.testFiles.join(" ")}`;
      }
      return `npx vitest run --testNamePattern "${pattern}"`;

    case "jest":
      if (discovery.testFiles.length > 0) {
        return `npx jest ${discovery.testFiles.join(" ")}`;
      }
      return `npx jest --testPathPattern "${pattern}"`;

    case "mocha":
      if (discovery.testFiles.length > 0) {
        return `npx mocha ${discovery.testFiles.join(" ")}`;
      }
      return `npx mocha --grep "${pattern}"`;

    case "pytest":
      if (discovery.testFiles.length > 0) {
        return `pytest ${discovery.testFiles.join(" ")}`;
      }
      return `pytest -k "${pattern}"`;

    case "go":
      // Go -run expects regex, not glob patterns
      if (isGlobPattern(pattern)) {
        return `go test ./...`; // Run all tests
      }
      return `go test -run "${pattern}" ./...`;

    case "cargo":
      return `cargo test "${pattern}"`;

    default:
      // For unknown frameworks, try appending pattern to npm-based commands
      if (baseCommand.startsWith("npm ")) {
        return `${baseCommand} -- "${pattern}"`;
      }
      if (baseCommand.startsWith("pnpm ")) {
        return `${baseCommand} -- "${pattern}"`;
      }
      if (baseCommand.startsWith("yarn ")) {
        return `${baseCommand} "${pattern}"`;
      }
      if (baseCommand.startsWith("bun ")) {
        return `${baseCommand} "${pattern}"`;
      }
      // Fall back to full test command
      return baseCommand;
  }
}

/**
 * Get a selective test command for a feature
 * Returns full test command if no selective pattern can be determined
 */
export async function getSelectiveTestCommand(
  cwd: string,
  feature: Feature,
  capabilities: VerificationCapabilities,
  changedFiles?: string[]
): Promise<{
  command: string | null;
  isSelective: boolean;
  discovery: TestDiscoveryResult;
}> {
  const discovery = await discoverTestsForFeature(cwd, feature, changedFiles);
  const command = buildSelectiveTestCommand(capabilities, discovery.pattern, discovery);

  return {
    command,
    isSelective: discovery.source !== "none" && discovery.pattern !== null,
    discovery,
  };
}
