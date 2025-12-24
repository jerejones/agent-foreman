/**
 * Core type definitions for agent-foreman
 * Long Task Harness for AI agents
 *
 * Re-exports all types from modular files
 */

// Feature types
export type {
  FeatureStatus,
  FeatureOrigin,
  TDDMode,
  TaskType,
  FeatureVerificationSummary,
  UnitTestRequirements,
  E2ETestRequirements,
  TestRequirements,
  CachedTDDGuidance,
  Feature,
  FeatureList,
  FeatureListMetadata,
  Task,
  TaskStatus,
  TaskOrigin,
  TaskVerificationSummary,
} from "./feature.js";
export { getTestPattern } from "./feature.js";

// Feature index types (modular storage)
export type { FeatureIndexEntry, FeatureIndex, FeatureIndexWithLock } from "./feature-index.js";

// Progress log types
export type { ProgressLogType, ProgressLogEntry } from "./progress-log.js";

// Project survey types
export type {
  TechStackInfo,
  DirectoryStructure,
  ModuleInfo,
  DiscoveredFeature,
  CompletionAssessment,
  ProjectCommands,
  ProjectSurvey,
} from "./survey.js";

// CLI types
export type { InitMode, SurveyOptions, InitOptions, StepOptions } from "./cli.js";

// Impact analysis types
export type { ImpactResult, ImpactRecommendation } from "./impact.js";
