/**
 * Types for test discovery and selective test execution
 */

/**
 * Result of test discovery
 */
export interface TestDiscoveryResult {
  /** Discovered test pattern to use */
  pattern: string | null;
  /** How the pattern was discovered */
  source: "explicit" | "auto-detected" | "module-based" | "none";
  /** List of specific test files found */
  testFiles: string[];
  /** Confidence in the discovery (0-1) */
  confidence: number;
}

/**
 * E2E test execution mode
 */
export type E2EMode = "full" | "smoke" | "tags" | "skip";
