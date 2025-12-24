/**
 * Automated check result types
 */

/**
 * Types of automated checks that can be run
 */
export type AutomatedCheckType = "test" | "typecheck" | "lint" | "build" | "e2e" | "init-script";

/**
 * Result of an automated check (test, lint, type check, or build)
 */
export interface AutomatedCheckResult {
  /** Type of check performed */
  type: AutomatedCheckType;
  /** Whether the check passed */
  success: boolean;
  /** Command output (stdout/stderr) */
  output?: string;
  /** Execution duration in milliseconds */
  duration?: number;
  /** Number of errors found (for lint/type checks) */
  errorCount?: number;
}
