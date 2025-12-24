/**
 * AI response types for verification
 */

import type { VerificationVerdict } from "./results.js";

/**
 * Expected structure of AI verification response
 * Used for parsing the JSON output from AI agents
 */
export interface AIVerificationResponse {
  /** Per-criterion results */
  criteriaResults: Array<{
    index: number;
    satisfied: boolean;
    reasoning: string;
    evidence?: string[];
    confidence: number;
  }>;
  /** Overall verdict */
  verdict: VerificationVerdict;
  /** Overall reasoning */
  overallReasoning: string;
  /** Improvement suggestions */
  suggestions?: string[];
  /** Code quality observations */
  codeQualityNotes?: string[];
}
