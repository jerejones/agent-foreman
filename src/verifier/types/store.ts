/**
 * Verification store and index types
 */

import type { AutomatedCheckType } from "./check-results.js";
import type { VerificationResult, VerificationVerdict } from "./results.js";

/**
 * Verification store structure (ai/verification/results.json)
 * Stores all verification results indexed by task ID
 * @deprecated Use VerificationIndex with per-feature subdirectories instead
 */
export interface VerificationStore {
  /** Map of task ID to latest verification result */
  results: Record<string, VerificationResult>;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
  /** Store schema version */
  version: string;
}

/**
 * Summary of a task's verification history
 * Stored in index.json for quick lookups without loading full results
 */
export interface FeatureSummary {
  /** Task ID */
  featureId: string;
  /** Latest run number (e.g., 3 points to 003.json) */
  latestRun: number;
  /** Timestamp of the latest verification (ISO 8601) */
  latestTimestamp: string;
  /** Verdict of the latest verification */
  latestVerdict: VerificationVerdict;
  /** Total number of verification runs */
  totalRuns: number;
  /** Count of passing verifications */
  passCount: number;
  /** Count of failing verifications */
  failCount: number;
}

/**
 * Verification index structure (ai/verification/index.json)
 * Summary index for quick lookups across all tasks
 */
export interface VerificationIndex {
  /** Map of task ID to its verification summary */
  features: Record<string, FeatureSummary>;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
  /** Index schema version */
  version: string;
}

/**
 * Compact metadata for a single verification run
 * Stored in {taskId}/NNN.json - excludes verbose output and reasoning
 */
export interface VerificationMetadata {
  /** Task ID that was verified */
  featureId: string;
  /** Sequential run number (1, 2, 3, ...) */
  runNumber: number;
  /** Verification timestamp (ISO 8601) */
  timestamp: string;
  /** Git commit hash at verification time */
  commitHash?: string;
  /** List of files that were changed */
  changedFiles: string[];
  /** Summary of the git diff */
  diffSummary: string;

  /** Results of automated checks (without verbose output) */
  automatedChecks: Array<{
    type: AutomatedCheckType;
    success: boolean;
    duration?: number;
    errorCount?: number;
    // Note: output field is excluded - stored in markdown
  }>;

  /** Per-criterion results (without verbose reasoning) */
  criteriaResults: Array<{
    criterion: string;
    index: number;
    satisfied: boolean;
    confidence: number;
    // Note: reasoning and evidence excluded - stored in markdown
  }>;

  /** Overall verification verdict */
  verdict: VerificationVerdict;
  /** AI agent used for verification */
  verifiedBy: string;
}

/**
 * Summary of verification result to embed in Feature
 * Stored in feature markdown files (ai/tasks/{module}/{id}.md)
 */
export interface FeatureVerificationSummary {
  /** Last verification timestamp (ISO 8601) */
  verifiedAt: string;
  /** Verification verdict */
  verdict: VerificationVerdict;
  /** Agent that performed verification */
  verifiedBy: string;
  /** Git commit hash at verification time */
  commitHash?: string;
  /** Brief summary of the verification result */
  summary: string;
}
