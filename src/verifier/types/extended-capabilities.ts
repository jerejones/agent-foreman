/**
 * Extended capability detection types
 */

import type { VerificationCapabilities } from "./capabilities.js";

/**
 * Source of capability detection
 */
export type CapabilitySource = "preset" | "ai-discovered" | "cached";

/**
 * Type of custom rule
 */
export type CustomRuleType = "test" | "typecheck" | "lint" | "build" | "custom";

/**
 * Command configuration for a specific capability
 * Used in ExtendedCapabilities for test, typecheck, lint, build
 */
export interface CapabilityCommand {
  /** Whether this capability is available */
  available: boolean;
  /** Command to run (e.g., "npm test", "./gradlew test") */
  command?: string;
  /** Framework or tool name (e.g., "vitest", "junit", "pytest") */
  framework?: string;
  /** Detection confidence (0-1, where 1 is highest) */
  confidence: number;
}

/**
 * Test-specific capability information
 * Extends CapabilityCommand with selective test execution patterns
 */
export interface TestCapabilityInfo extends CapabilityCommand {
  /**
   * Template for running specific test files
   * Use {files} placeholder for file paths
   * Example: "pnpm test {files}" or "pytest {files}"
   */
  selectiveFileTemplate?: string;

  /**
   * Template for running tests by name/pattern
   * Use {pattern} placeholder for the pattern
   * Example: "pnpm test --testNamePattern {pattern}"
   */
  selectiveNameTemplate?: string;

  /**
   * Package manager used (npm, pnpm, yarn, bun, etc.)
   * Helps determine the correct command prefix
   */
  packageManager?: string;
}

/**
 * E2E test-specific capability information
 * Supports Playwright and other E2E testing frameworks
 */
export interface E2ECapabilityInfo extends CapabilityCommand {
  /**
   * Base E2E test command
   * Example: "npx playwright test"
   */
  command?: string;

  /**
   * Template for running E2E tests filtered by tags
   * Use {tags} placeholder for tag pattern
   * Example: "npx playwright test --grep {tags}"
   */
  grepTemplate?: string;

  /**
   * Template for running specific E2E test files
   * Use {files} placeholder for file paths
   * Example: "npx playwright test {files}"
   */
  fileTemplate?: string;

  /**
   * E2E test framework name
   * Example: "playwright", "cypress", "puppeteer"
   */
  framework?: string;

  /**
   * Config file path (e.g., "playwright.config.ts")
   */
  configFile?: string;
}

/**
 * Custom verification rule discovered by AI
 * Extends standard capabilities with project-specific commands
 */
export interface CustomRule {
  /** Unique rule identifier (e.g., "spring-boot-integration") */
  id: string;
  /** Human-readable description */
  description: string;
  /** Command to execute */
  command: string;
  /** Type of rule */
  type: CustomRuleType;
  /** Optional: language this rule applies to */
  language?: string;
}

/**
 * Extended capabilities with metadata for dynamic language detection
 * Extends base VerificationCapabilities with AI discovery support
 */
export interface ExtendedCapabilities extends VerificationCapabilities {
  /** How these capabilities were detected */
  source: CapabilitySource;
  /** Overall detection confidence (0-1) */
  confidence: number;
  /** Detected programming languages (e.g., ["java", "kotlin"]) */
  languages: string[];
  /** When capabilities were detected (ISO 8601) */
  detectedAt: string;
  /** Optional: structured test info with selective execution templates */
  testInfo?: TestCapabilityInfo;
  /** Optional: E2E test info (Playwright, Cypress, etc.) */
  e2eInfo?: E2ECapabilityInfo;
  /** Optional: type check command info */
  typeCheckInfo?: CapabilityCommand;
  /** Optional: lint command info */
  lintInfo?: CapabilityCommand;
  /** Optional: build command info */
  buildInfo?: CapabilityCommand;
  /** Optional: custom project-specific rules */
  customRules?: CustomRule[];
}

/**
 * Capability cache structure stored in ai/capabilities.json
 * Persists detected capabilities across sessions
 */
export interface CapabilityCache {
  /** Cache schema version */
  version: string;
  /** Cached capabilities */
  capabilities: ExtendedCapabilities;
  /** Git commit hash when cache was created */
  commitHash?: string;
  /** List of build files used to detect staleness */
  trackedFiles?: string[];
}
