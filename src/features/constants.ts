/**
 * Constants for feature list operations
 */
import type { FeatureStatus } from "../types/index.js";

/** Default path for legacy feature list file (for migration) */
export const FEATURE_LIST_PATH = "ai/feature_list.json";

/** Path to tasks directory for modular format */
export const TASKS_DIR = "ai/tasks";

/** Valid status values for validation */
export const VALID_STATUSES: FeatureStatus[] = [
  "failing",
  "passing",
  "blocked",
  "needs_review",
  "failed",
  "deprecated",
];

/** Status order for priority sorting (lower = higher priority) */
export const STATUS_ORDER: Record<FeatureStatus, number> = {
  needs_review: 0,
  failing: 1,
  blocked: 2,
  failed: 3,
  passing: 4,
  deprecated: 5,
};

/** Path constant alias for task list */
export const TASK_LIST_PATH = FEATURE_LIST_PATH;
