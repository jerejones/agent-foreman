/**
 * Type definitions for init helpers
 */

import type { aiResultToSurvey } from "../scanner/index.js";

/**
 * Result from project detection and analysis
 */
export interface AnalysisResult {
  success: boolean;
  survey?: ReturnType<typeof aiResultToSurvey>;
  error?: string;
  agentUsed?: string;
}
