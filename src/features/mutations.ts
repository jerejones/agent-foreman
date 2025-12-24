/**
 * Feature mutation operations (status updates, merging, etc.)
 */
import type { Feature, FeatureStatus, FeatureVerificationSummary } from "../types/index.js";

/**
 * Update feature status
 */
export function updateFeatureStatus(
  features: Feature[],
  id: string,
  status: FeatureStatus,
  notes?: string
): Feature[] {
  return features.map((f) => {
    if (f.id === id) {
      return {
        ...f,
        status,
        notes: notes ?? f.notes,
      };
    }
    return f;
  });
}

/**
 * Update feature verification summary
 */
export function updateFeatureVerification(
  features: Feature[],
  id: string,
  verification: FeatureVerificationSummary
): Feature[] {
  return features.map((f) => {
    if (f.id === id) {
      return {
        ...f,
        verification,
      };
    }
    return f;
  });
}

/**
 * Merge new features with existing ones (no duplicates)
 */
export function mergeFeatures(existing: Feature[], discovered: Feature[]): Feature[] {
  const existingIds = new Set(existing.map((f) => f.id));
  const newFeatures = discovered.filter((f) => !existingIds.has(f.id));
  return [...existing, ...newFeatures];
}

/**
 * Mark a feature as deprecated
 */
export function deprecateFeature(
  features: Feature[],
  id: string,
  replacedBy?: string
): Feature[] {
  return features.map((f) => {
    if (f.id === id) {
      return {
        ...f,
        status: "deprecated" as FeatureStatus,
        notes: replacedBy
          ? `${f.notes}; Replaced by ${replacedBy}`.trim().replace(/^; /, "")
          : f.notes,
      };
    }
    return f;
  });
}

/**
 * Add a new feature to the list
 */
export function addFeature(features: Feature[], feature: Feature): Feature[] {
  // Check for duplicate ID
  if (features.some((f) => f.id === feature.id)) {
    throw new Error(`Feature with ID "${feature.id}" already exists`);
  }
  return [...features, feature];
}

/** Alias for updateFeatureStatus - updates task status */
export const updateTaskStatus = updateFeatureStatus;

/** Alias for updateFeatureVerification - updates task verification */
export const updateTaskVerification = updateFeatureVerification;

/** Alias for mergeFeatures - merges tasks */
export const mergeTasks = mergeFeatures;

/** Alias for deprecateFeature - deprecates task */
export const deprecateTask = deprecateFeature;

/** Alias for addFeature - adds task */
export const addTask = addFeature;
