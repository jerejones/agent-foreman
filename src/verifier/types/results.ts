/**
 * Verification result types
 */

import type { AutomatedCheckResult } from "./check-results.js";
import type { CriterionResult } from "./criterion.js";

/**
 * Possible verification verdicts
 */
export type VerificationVerdict = "pass" | "fail" | "needs_review";

/**
 * Complete verification result stored in ai/verification/results.json
 */
export interface VerificationResult {
  /** Task ID that was verified */
  featureId: string;
  /** Verification timestamp (ISO 8601) */
  timestamp: string;
  /** Git commit hash at verification time */
  commitHash?: string;
  /** List of files that were changed */
  changedFiles: string[];
  /** Summary of the git diff */
  diffSummary: string;

  /** Results of automated checks */
  automatedChecks: AutomatedCheckResult[];

  /** Per-criterion evaluation results */
  criteriaResults: CriterionResult[];

  /** Overall verification verdict */
  verdict: VerificationVerdict;

  /** AI agent used for verification (e.g., "claude", "codex", "gemini") */
  verifiedBy: string;

  /** Overall reasoning for the verdict */
  overallReasoning: string;

  /** Suggestions for improvement */
  suggestions?: string[];

  /** Code quality notes */
  codeQualityNotes?: string[];

  /** List of related files analyzed for context */
  relatedFilesAnalyzed?: string[];

  /** Results from strategy-based verification (UVS Phase 4) */
  strategyResults?: Array<{
    type: string;
    required: boolean;
    success: boolean;
    output?: string;
    duration?: number;
  }>;
}
