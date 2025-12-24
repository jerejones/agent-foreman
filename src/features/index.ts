/**
 * Feature List Operations
 *
 * Operations for ai/tasks/ (modular markdown format)
 * Also supports legacy ai/feature_list.json with auto-migration
 *
 * Primary format: ai/tasks/index.json + ai/tasks/{module}/{id}.md
 * Legacy format: ai/feature_list.json (auto-migrated on first load)
 */

// Constants
export {
  FEATURE_LIST_PATH,
  TASKS_DIR,
  VALID_STATUSES,
  STATUS_ORDER,
  TASK_LIST_PATH,
} from "./constants.js";

// Load Operations
export {
  loadFeatureList,
  featureListExists,
  loadTaskList,
  taskListExists,
} from "./load-operations.js";

// Save Operations
export {
  saveFeatureList,
  saveTaskList,
} from "./save-operations.js";

// Selection & Finding
export {
  selectNextFeature,
  selectNextFeatureWithBlocking,
  isBreakdownTask,
  findFeatureById,
  findDependentFeatures,
  findSameModuleFeatures,
  selectNextTask,
  selectNextTaskWithBlocking,
  isBreakdownFeature,
  findTaskById,
  findDependentTasks,
  findSameModuleTasks,
  type SelectionResult,
} from "./selection.js";

// Mutations
export {
  updateFeatureStatus,
  updateFeatureVerification,
  mergeFeatures,
  deprecateFeature,
  addFeature,
  updateTaskStatus,
  updateTaskVerification,
  mergeTasks,
  deprecateTask,
  addTask,
} from "./mutations.js";

// Factory Functions
export {
  generateTestPattern,
  generateTestRequirements,
  discoveredToFeature,
  createEmptyFeatureList,
  createFeature,
  migrateToStrictTDD,
} from "./factory.js";

// Statistics
export {
  getFeatureStats,
  getCompletionPercentage,
  groupByModule,
  getTaskStats,
} from "./stats.js";

// Quick Operations
export {
  buildAndSaveIndex,
  updateFeatureStatusQuick,
  updateFeatureVerificationQuick,
  getFeatureStatsQuick,
  selectNextFeatureQuick,
  selectNextFeatureQuickWithBlocking,
  updateTaskStatusQuick,
  updateTaskVerificationQuick,
  getTaskStatsQuick,
  selectNextTaskQuick,
  selectNextTaskQuickWithBlocking,
} from "./quick-operations.js";

// Sync Operations
export {
  syncIndexFromFeatures,
  syncIndexFromTasks,
} from "./sync-operations.js";
