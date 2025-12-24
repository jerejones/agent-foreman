/**
 * Base verification capabilities types
 */

/**
 * Project verification capabilities detected during init
 * Determines what automated checks can be run
 */
export interface VerificationCapabilities {
  /** Test framework available */
  hasTests: boolean;
  /** Test command to run (e.g., "npm test", "vitest run") */
  testCommand?: string;
  /** Detected test framework name (e.g., "vitest", "jest", "pytest") */
  testFramework?: string;

  /** Type checking available */
  hasTypeCheck: boolean;
  /** Type check command (e.g., "tsc --noEmit", "mypy") */
  typeCheckCommand?: string;

  /** Linting available */
  hasLint: boolean;
  /** Lint command (e.g., "eslint .", "ruff check") */
  lintCommand?: string;

  /** Build verification available */
  hasBuild: boolean;
  /** Build command (e.g., "npm run build", "go build") */
  buildCommand?: string;

  /** Git available for diff operations */
  hasGit: boolean;
}
