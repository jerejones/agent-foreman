/**
 * CLI types
 * Types for command-line interface operations
 */

/**
 * Init harness modes
 * - merge: Keep existing features, add new discoveries
 * - new: Backup old list, create fresh
 * - scan: Preview only, no modifications
 */
export type InitMode = "merge" | "new" | "scan";

/**
 * Survey command options
 */
export interface SurveyOptions {
  /** Output path for survey markdown */
  output?: string;
  /** Show detailed output */
  verbose?: boolean;
}

/**
 * Init command options
 */
export interface InitOptions {
  /** Init mode */
  mode: InitMode;
  /** Show detailed output */
  verbose?: boolean;
}

/**
 * Step command options
 */
export interface StepOptions {
  /** Specific task ID to work on */
  featureId?: string;
  /** Show plan without executing */
  dryRun?: boolean;
}
