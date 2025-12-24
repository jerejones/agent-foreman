/**
 * Verify command options types
 */

/**
 * Test execution mode for verification
 */
export type TestMode = "full" | "quick" | "skip";

/**
 * Verification workflow mode
 * - "tdd": TDD mode - runs tests only, skips AI analysis
 * - "ai": AI mode - runs full AI-powered verification with code analysis
 */
export type VerificationMode = "tdd" | "ai";

/**
 * E2E test execution mode
 */
export type E2ETestMode = "full" | "smoke" | "tags" | "skip";

/**
 * Options for the verify CLI command
 */
export interface VerifyOptions {
  /** Show detailed AI reasoning */
  verbose?: boolean;
  /** Skip automated checks, AI analysis only */
  skipChecks?: boolean;
  /** Timeout for verification in milliseconds */
  timeout?: number;
  /**
   * Test execution mode
   * - "full": Run all tests (default for final completion)
   * - "quick": Run only related tests based on changes
   * - "skip": Skip tests entirely
   */
  testMode?: TestMode;
  /** Explicit test pattern to use (overrides auto-detection) */
  testPattern?: string;
  /** Skip E2E tests entirely */
  skipE2E?: boolean;
  /** E2E test tags to run (from feature.e2eTags) */
  e2eTags?: string[];
  /**
   * E2E test execution mode (if not specified, derived from testMode)
   * - "full": Run all E2E tests (explicit --full flag)
   * - "smoke": Run only @smoke E2E tests (default when testMode is "full")
   * - "tags": Run E2E tests matching feature.e2eTags (quick mode with tags)
   * - "skip": Skip E2E tests entirely
   */
  e2eMode?: E2ETestMode;
}
