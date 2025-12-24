/**
 * Feature selection and finding operations
 */
import type { Feature, FeatureStatus } from "../types/index.js";
import { STATUS_ORDER } from "./constants.js";

/**
 * Result of task selection with blocking information
 */
export interface SelectionResult {
  /** Selected feature (null if none available) */
  feature: Feature | null;
  /** Blocking information when implementation tasks are blocked by BREAKDOWN tasks */
  blockedBy?: {
    type: "breakdown";
    count: number;
    ids: string[];
  };
}

/**
 * Check if a task is a BREAKDOWN task
 * Detection: ID pattern (*.BREAKDOWN) or "breakdown" tag
 *
 * @param taskOrId - Feature object or task ID string
 * @returns true if the task is a BREAKDOWN task
 */
export function isBreakdownTask(taskOrId: Feature | string): boolean {
  const id = typeof taskOrId === "string" ? taskOrId : taskOrId.id;
  const byId = id.toUpperCase().endsWith(".BREAKDOWN");

  // If we have a full Feature, also check tags
  if (typeof taskOrId !== "string" && taskOrId.tags) {
    const byTag = taskOrId.tags.some((t) => t.toLowerCase() === "breakdown");
    return byId || byTag;
  }

  return byId;
}

/**
 * Select next feature to work on based on priority
 * Priority order:
 * 1. needs_review status (highest)
 * 2. failing status
 * 3. Then by priority number (lower = higher priority)
 *
 * Note: failed features are NOT selected - they need manual intervention
 */
export function selectNextFeature(features: Feature[]): Feature | null {
  const candidates = features.filter(
    (f) => f.status === "needs_review" || f.status === "failing"
  );

  if (candidates.length === 0) return null;

  // Sort: needs_review first, then by priority number (lower = higher)
  candidates.sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    return a.priority - b.priority;
  });

  return candidates[0];
}

/**
 * Select next feature with BREAKDOWN-first enforcement
 *
 * BREAKDOWN tasks must complete before implementation tasks:
 * 1. Filter candidates (needs_review or failing)
 * 2. Partition into BREAKDOWN and implementation tasks
 * 3. If BREAKDOWN tasks exist → return BREAKDOWN task (blocks implementation)
 * 4. Else → return implementation task
 *
 * @param features - All features to select from
 * @returns SelectionResult with feature and optional blocking info
 */
export function selectNextFeatureWithBlocking(features: Feature[]): SelectionResult {
  // Phase 1: Filter actionable candidates
  const candidates = features.filter(
    (f) => f.status === "needs_review" || f.status === "failing"
  );

  if (candidates.length === 0) {
    return { feature: null };
  }

  // Phase 2: Partition into BREAKDOWN and implementation
  const breakdownTasks = candidates.filter((f) => isBreakdownTask(f));
  const implementationTasks = candidates.filter((f) => !isBreakdownTask(f));

  // Phase 3: BREAKDOWN-first enforcement
  if (breakdownTasks.length > 0) {
    // Sort breakdown tasks: needs_review first, then by priority
    breakdownTasks.sort((a, b) => {
      const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.priority - b.priority;
    });

    return {
      feature: breakdownTasks[0],
      // Include blocking info if there are implementation tasks waiting
      ...(implementationTasks.length > 0 && {
        blockedBy: {
          type: "breakdown" as const,
          count: breakdownTasks.length,
          ids: breakdownTasks.map((f) => f.id),
        },
      }),
    };
  }

  // No BREAKDOWN tasks - select from implementation
  implementationTasks.sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    return a.priority - b.priority;
  });

  return { feature: implementationTasks[0] };
}

/**
 * Find feature by ID
 */
export function findFeatureById(features: Feature[], id: string): Feature | undefined {
  return features.find((f) => f.id === id);
}

/**
 * Find features that depend on a given feature
 */
export function findDependentFeatures(features: Feature[], featureId: string): Feature[] {
  return features.filter((f) => f.dependsOn.includes(featureId));
}

/**
 * Find features in the same module
 */
export function findSameModuleFeatures(
  features: Feature[],
  module: string,
  excludeId: string
): Feature[] {
  return features.filter((f) => f.module === module && f.id !== excludeId);
}

/** Alias for selectNextFeature - selects next task */
export const selectNextTask = selectNextFeature;

/** Alias for findFeatureById - finds task by ID */
export const findTaskById = findFeatureById;

/** Alias for findDependentFeatures - finds dependent tasks */
export const findDependentTasks = findDependentFeatures;

/** Alias for findSameModuleFeatures - finds same module tasks */
export const findSameModuleTasks = findSameModuleFeatures;

/** Alias for selectNextFeatureWithBlocking - selects next task with BREAKDOWN blocking */
export const selectNextTaskWithBlocking = selectNextFeatureWithBlocking;

/** Alias for isBreakdownTask - checks if task is a BREAKDOWN task */
export const isBreakdownFeature = isBreakdownTask;
