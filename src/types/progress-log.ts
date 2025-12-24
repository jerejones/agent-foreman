/**
 * Progress log types
 * Types for session handoff audit logging
 */

import type { FeatureStatus } from "./feature.js";

/**
 * Progress log entry types
 * - INIT: Initial harness creation
 * - STEP: Feature implementation step
 * - CHANGE: Feature status change
 * - REPLAN: Major replanning event
 * - VERIFY: Feature verification result
 */
export type ProgressLogType = "INIT" | "STEP" | "CHANGE" | "REPLAN" | "VERIFY";

/**
 * Progress log entry structure
 */
export interface ProgressLogEntry {
  /** Entry type */
  type: ProgressLogType;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Task ID (for STEP/CHANGE) */
  feature?: string;
  /** New status (for STEP) */
  status?: FeatureStatus;
  /** Action taken (for CHANGE) */
  action?: string;
  /** Reason for the entry */
  reason?: string;
  /** Test command that was run */
  tests?: string;
  /** Brief summary */
  summary: string;
  /** Project goal (for INIT) */
  goal?: string;
  /** Additional notes */
  note?: string;
}
