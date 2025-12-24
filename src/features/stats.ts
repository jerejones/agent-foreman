/**
 * Feature statistics and grouping operations
 */
import type { Feature, FeatureStatus } from "../types/index.js";

/**
 * Get statistics about feature list
 * @param features - List of features to compute stats for
 * @param excludeDeprecated - If true, excludes deprecated features from counts (default: true)
 */
export function getFeatureStats(features: Feature[], excludeDeprecated = true): Record<FeatureStatus, number> {
  const stats: Record<FeatureStatus, number> = {
    failing: 0,
    passing: 0,
    blocked: 0,
    needs_review: 0,
    failed: 0,
    deprecated: 0,
  };

  for (const f of features) {
    if (excludeDeprecated && f.status === "deprecated") {
      continue;
    }
    stats[f.status]++;
  }

  return stats;
}

/**
 * Calculate completion percentage (excluding deprecated)
 */
export function getCompletionPercentage(features: Feature[]): number {
  const active = features.filter((f) => f.status !== "deprecated");
  if (active.length === 0) return 0;
  const passing = active.filter((f) => f.status === "passing").length;
  return Math.round((passing / active.length) * 100);
}

/**
 * Get features grouped by module
 */
export function groupByModule(features: Feature[]): Map<string, Feature[]> {
  const groups = new Map<string, Feature[]>();
  for (const f of features) {
    const existing = groups.get(f.module) || [];
    existing.push(f);
    groups.set(f.module, existing);
  }
  return groups;
}

/** Alias for getFeatureStats - gets task stats */
export const getTaskStats = getFeatureStats;

// Note: getCompletionPercentage and groupByModule don't have "Feature" in their names,
// so they already work for both Task and Feature terminology
