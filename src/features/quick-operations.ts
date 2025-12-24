/**
 * Quick Operations (Index + Single File Only)
 * Optimized operations that avoid loading all features
 * Supports optimistic locking for concurrent modification detection
 */
import type { Feature, FeatureStatus, FeatureVerificationSummary, FeatureList, FeatureIndex, FeatureIndexEntry } from "../types/index.js";
import {
  loadFeatureIndex,
  loadSingleFeature,
  saveSingleFeature,
  saveFeatureIndex,
  withOptimisticRetry,
} from "../storage/index.js";
import { VALID_STATUSES, STATUS_ORDER } from "./constants.js";
import type { SelectionResult } from "./selection.js";

/**
 * Build index.json from a FeatureList and save it
 * Used when index doesn't exist but we have features in memory
 *
 * @param cwd - Project root directory
 * @param featureList - In-memory feature list
 */
export async function buildAndSaveIndex(cwd: string, featureList: FeatureList): Promise<void> {
  const indexFeatures: Record<string, FeatureIndexEntry> = {};

  for (const feature of featureList.features) {
    indexFeatures[feature.id] = {
      status: feature.status,
      priority: feature.priority,
      module: feature.module,
      description: feature.description,
      ...(feature.filePath && { filePath: feature.filePath }),
    };
  }

  const index: FeatureIndex = {
    version: "2.0.0",
    updatedAt: new Date().toISOString(),
    metadata: featureList.metadata,
    features: indexFeatures,
  };

  // Cast to FeatureIndexWithLock (no _loadedAt means new index)
  await saveFeatureIndex(cwd, index as import("../types/index.js").FeatureIndexWithLock);
}

/**
 * Quick status update - updates only index.json and single task file
 * Much faster than full load/save cycle for status-only updates
 * Uses optimistic locking with automatic retry on conflicts
 *
 * @param cwd - Project root directory
 * @param id - Task ID to update
 * @param status - New status value
 * @param notes - Optional notes to update
 * @returns Updated Feature object
 * @throws Error if status is invalid or task not found
 * @throws OptimisticLockError if concurrent modification detected after max retries
 */
export async function updateFeatureStatusQuick(
  cwd: string,
  id: string,
  status: FeatureStatus,
  notes?: string
): Promise<Feature> {
  // Validate status (outside retry loop - validation shouldn't need retry)
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}. Valid values: ${VALID_STATUSES.join(", ")}`);
  }

  return withOptimisticRetry(async () => {
    // Load feature index (with lock metadata)
    const index = await loadFeatureIndex(cwd);
    if (!index) {
      throw new Error("Feature index not found. Run migration first.");
    }

    // Check feature exists in index
    if (!index.features[id]) {
      throw new Error(`Feature not found: ${id}`);
    }

    // Load single feature using unified resolver
    const feature = await loadSingleFeature(cwd, id, index.features[id]);
    if (!feature) {
      throw new Error(`Feature file not found: ${id}`);
    }

    // Store original version for conflict detection
    const originalVersion = feature.version;

    // Update feature
    const updatedFeature: Feature = {
      ...feature,
      status,
      notes: notes ?? feature.notes,
    };

    // Save updated feature with conflict check (uses full save to preserve notes in body)
    await saveSingleFeature(cwd, updatedFeature, originalVersion);

    // Update index entry (persist discovered filePath if found via fallback scan)
    index.features[id] = {
      ...index.features[id],
      status,
      // Persist filePath if discovered (fixes index for non-standard filenames)
      ...(updatedFeature.filePath && !index.features[id].filePath && { filePath: updatedFeature.filePath }),
    };

    // Save updated index with conflict check
    await saveFeatureIndex(cwd, index);

    // Return with new version (incremented during save)
    return {
      ...updatedFeature,
      version: (feature.version || 1) + 1,
    };
  });
}

/**
 * Quick stats lookup - reads only index.json
 * Much faster than loading all features for status statistics
 *
 * @param cwd - Project root directory
 * @param excludeDeprecated - If true, excludes deprecated features from counts (default: true)
 * @returns Status counts keyed by status value
 * @throws Error if index not found
 */
export async function getFeatureStatsQuick(cwd: string, excludeDeprecated = true): Promise<Record<FeatureStatus, number>> {
  // Load feature index only
  const index = await loadFeatureIndex(cwd);
  if (!index) {
    throw new Error("Feature index not found. Run migration first.");
  }

  // Initialize stats
  const stats: Record<FeatureStatus, number> = {
    failing: 0,
    passing: 0,
    blocked: 0,
    needs_review: 0,
    failed: 0,
    deprecated: 0,
  };

  // Count from index entries
  for (const entry of Object.values(index.features)) {
    if (excludeDeprecated && entry.status === "deprecated") {
      continue;
    }
    if (entry.status in stats) {
      stats[entry.status]++;
    }
  }

  return stats;
}

/**
 * Quick next feature selection - reads index.json for selection, loads full feature only when found
 * Much faster than loading all features when only selecting next
 *
 * @param cwd - Project root directory
 * @returns Selected Feature or null if none available
 * @throws Error if index not found
 */
export async function selectNextFeatureQuick(cwd: string): Promise<Feature | null> {
  // Load feature index only
  const index = await loadFeatureIndex(cwd);
  if (!index) {
    throw new Error("Feature index not found. Run migration first.");
  }

  // Convert index entries to array with IDs for sorting
  const candidates = Object.entries(index.features)
    .filter(([, entry]) => entry.status === "needs_review" || entry.status === "failing")
    .map(([id, entry]) => ({ id, ...entry }));

  if (candidates.length === 0) {
    return null;
  }

  // Sort: needs_review first, then by priority number (lower = higher)
  candidates.sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    return a.priority - b.priority;
  });

  // Load full feature for the selected one using unified resolver
  const selectedId = candidates[0].id;
  const selectedEntry = index.features[selectedId];
  const feature = await loadSingleFeature(cwd, selectedId, selectedEntry);

  if (!feature) {
    // Fall back to minimal feature from index if file missing
    const entry = index.features[selectedId];
    return {
      id: selectedId,
      description: entry.description,
      module: entry.module,
      priority: entry.priority,
      status: entry.status,
      acceptance: [],
      dependsOn: [],
      supersedes: [],
      tags: [],
      version: 1,
      origin: "manual",
      notes: "",
    };
  }

  return feature;
}

/**
 * Check if an index entry ID represents a BREAKDOWN task
 * Uses ID pattern only since tags aren't in index
 */
function isBreakdownEntry(id: string): boolean {
  return id.toUpperCase().endsWith(".BREAKDOWN");
}

/**
 * Quick next feature selection with BREAKDOWN-first enforcement
 * Reads index.json for selection, loads full feature only when found
 *
 * BREAKDOWN tasks must complete before implementation tasks:
 * 1. Filter candidates (needs_review or failing)
 * 2. Partition into BREAKDOWN and implementation tasks
 * 3. If BREAKDOWN tasks exist → return BREAKDOWN task (blocks implementation)
 * 4. Else → return implementation task
 *
 * @param cwd - Project root directory
 * @returns SelectionResult with feature and optional blocking info
 * @throws Error if index not found
 */
export async function selectNextFeatureQuickWithBlocking(
  cwd: string
): Promise<SelectionResult> {
  // Load feature index only
  const index = await loadFeatureIndex(cwd);
  if (!index) {
    throw new Error("Feature index not found. Run migration first.");
  }

  // Phase 1: Filter actionable candidates
  const candidates = Object.entries(index.features)
    .filter(([, entry]) => entry.status === "needs_review" || entry.status === "failing")
    .map(([id, entry]) => ({ id, ...entry }));

  if (candidates.length === 0) {
    return { feature: null };
  }

  // Phase 2: Partition into BREAKDOWN and implementation
  const breakdownEntries = candidates.filter((c) => isBreakdownEntry(c.id));
  const implementationEntries = candidates.filter((c) => !isBreakdownEntry(c.id));

  // Phase 3: BREAKDOWN-first enforcement
  let selectedEntry: (typeof candidates)[0];
  let blockedBy: SelectionResult["blockedBy"];

  if (breakdownEntries.length > 0) {
    // Sort breakdown tasks: needs_review first, then by priority
    breakdownEntries.sort((a, b) => {
      const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.priority - b.priority;
    });
    selectedEntry = breakdownEntries[0];

    // Include blocking info if implementation tasks are waiting
    if (implementationEntries.length > 0) {
      blockedBy = {
        type: "breakdown",
        count: breakdownEntries.length,
        ids: breakdownEntries.map((e) => e.id),
      };
    }
  } else {
    // No BREAKDOWN tasks - select from implementation
    implementationEntries.sort((a, b) => {
      const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.priority - b.priority;
    });
    selectedEntry = implementationEntries[0];
  }

  // Load full feature for the selected one using unified resolver
  const selectedId = selectedEntry.id;
  const selectedIndexEntry = index.features[selectedId];
  const feature = await loadSingleFeature(cwd, selectedId, selectedIndexEntry);

  if (!feature) {
    // Fall back to minimal feature from index if file missing
    return {
      feature: {
        id: selectedId,
        description: selectedIndexEntry.description,
        module: selectedIndexEntry.module,
        priority: selectedIndexEntry.priority,
        status: selectedIndexEntry.status,
        acceptance: [],
        dependsOn: [],
        supersedes: [],
        tags: [],
        version: 1,
        origin: "manual",
        notes: "",
      },
      blockedBy,
    };
  }

  return { feature, blockedBy };
}

/**
 * Quick verification update - updates only single task file (no index change needed)
 * Much faster than full load/save cycle for verification-only updates
 * Uses optimistic locking with automatic retry on conflicts
 *
 * @param cwd - Project root directory
 * @param id - Task ID to update
 * @param verification - Verification summary to set
 * @returns Updated Feature object
 * @throws Error if task not found
 * @throws OptimisticLockError if concurrent modification detected after max retries
 */
export async function updateFeatureVerificationQuick(
  cwd: string,
  id: string,
  verification: FeatureVerificationSummary
): Promise<Feature> {
  return withOptimisticRetry(async () => {
    // Load feature index (to get filePath if available)
    const index = await loadFeatureIndex(cwd);
    if (!index) {
      throw new Error("Feature index not found. Run migration first.");
    }

    // Check feature exists in index
    if (!index.features[id]) {
      throw new Error(`Feature not found: ${id}`);
    }

    // Load single feature using unified resolver
    const feature = await loadSingleFeature(cwd, id, index.features[id]);
    if (!feature) {
      throw new Error(`Feature file not found: ${id}`);
    }

    // Store original version for conflict detection
    const originalVersion = feature.version;

    // Update feature with verification summary
    const updatedFeature: Feature = {
      ...feature,
      verification,
    };

    // Save updated feature with conflict check
    await saveSingleFeature(cwd, updatedFeature, originalVersion);

    // Return with new version (incremented during save)
    return {
      ...updatedFeature,
      version: (feature.version || 1) + 1,
    };
  });
}

/** Alias for updateFeatureStatusQuick - quick task status update */
export const updateTaskStatusQuick = updateFeatureStatusQuick;

/** Alias for updateFeatureVerificationQuick - quick task verification update */
export const updateTaskVerificationQuick = updateFeatureVerificationQuick;

/** Alias for getFeatureStatsQuick - quick task stats */
export const getTaskStatsQuick = getFeatureStatsQuick;

/** Alias for selectNextFeatureQuick - quick next task selection */
export const selectNextTaskQuick = selectNextFeatureQuick;

/** Alias for selectNextFeatureQuickWithBlocking - quick next task selection with BREAKDOWN blocking */
export const selectNextTaskQuickWithBlocking = selectNextFeatureQuickWithBlocking;
