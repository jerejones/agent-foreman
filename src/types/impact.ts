/**
 * Impact analysis types
 * Types for analyzing feature dependencies and change impact
 */

import type { Feature } from "./feature.js";

/**
 * Impact analysis result
 */
export interface ImpactResult {
  /** Features directly dependent on the changed feature */
  directlyAffected: Feature[];
  /** Features in the same module that might be affected */
  potentiallyAffected: Feature[];
  /** Recommended actions */
  recommendations: ImpactRecommendation[];
}

/**
 * Impact recommendation
 */
export interface ImpactRecommendation {
  /** Task ID to act on */
  featureId: string;
  /** Recommended action */
  action: "mark_needs_review" | "mark_deprecated" | "update_notes";
  /** Reason for recommendation */
  reason: string;
}
