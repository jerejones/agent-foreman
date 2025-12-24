/**
 * Verifier-specific types
 * Local types used within the verifier module
 */

import type { AutomatedCheckResult, E2ECapabilityInfo } from "./types/index.js";
import type { TestDiscoveryResult } from "../testing/index.js";

/**
 * Options for running automated checks
 */
export interface AutomatedCheckOptions {
  /** Verbose output */
  verbose?: boolean;
  /** Test execution mode: "full" | "quick" | "skip" */
  testMode?: "full" | "quick" | "skip";
  /** Selective test command (for quick mode) */
  selectiveTestCommand?: string | null;
  /** Test discovery result for logging */
  testDiscovery?: TestDiscoveryResult;
  /** Skip E2E tests entirely */
  skipE2E?: boolean;
  /** E2E capability info for running E2E tests */
  e2eInfo?: E2ECapabilityInfo;
  /** E2E tags for feature-based filtering */
  e2eTags?: string[];
  /**
   * E2E test execution mode (if not specified, derived from testMode and e2eTags)
   * - "full": Run all E2E tests
   * - "smoke": Run only @smoke E2E tests (default)
   * - "tags": Run E2E tests matching e2eTags
   * - "skip": Skip E2E tests entirely
   */
  e2eMode?: "full" | "smoke" | "tags" | "skip";
  /**
   * Run checks in parallel for faster execution
   * When true, independent checks (test, typecheck, lint, build) run concurrently
   * E2E tests always run sequentially after unit tests pass
   * Default: false for backward compatibility
   */
  parallel?: boolean;
  /**
   * Skip build step (for fast check mode)
   * When true, build command is not executed
   * Default: false
   */
  skipBuild?: boolean;
}

/**
 * Internal type for check definition
 */
export interface CheckDefinition {
  type: AutomatedCheckResult["type"];
  command: string;
  name: string;
  isE2E?: boolean;
}

/**
 * Options for TDD verification
 */
export interface TDDVerifyOptions {
  /** Verbose output */
  verbose?: boolean;
  /** Skip E2E tests */
  skipE2E?: boolean;
  /** E2E test tags */
  e2eTags?: string[];
}

/**
 * Result of executing all verification strategies for a feature
 */
export interface StrategyExecutionResult {
  /** All strategy results */
  results: Array<{
    strategy: import("./types/index.js").VerificationStrategy;
    result: import("../strategies/index.js").StrategyResult;
  }>;
  /** Overall verdict based on all strategies */
  verdict: import("./types/index.js").VerificationVerdict;
  /** Combined output from all strategies */
  overallReasoning: string;
  /** Criteria results mapped from strategy outputs */
  criteriaResults: import("./types/index.js").CriterionResult[];
  /** Agent used (for AI strategies) */
  agentUsed?: string;
  /** Suggestions from strategies */
  suggestions?: string[];
  /** Code quality notes from strategies */
  codeQualityNotes?: string[];
}
