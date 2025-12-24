/**
 * Project survey types
 * Types for project analysis and tech stack detection
 */

import type { FeatureStatus } from "./feature.js";

/**
 * Detected tech stack information
 */
export interface TechStackInfo {
  /** Primary programming language */
  language: string;
  /** Framework (e.g., express, vue, echo) */
  framework: string;
  /** Build tool (e.g., vite, webpack, go build) */
  buildTool: string;
  /** Test framework (e.g., vitest, jest, go test) */
  testFramework: string;
  /** Package manager (e.g., npm, pnpm, go mod) */
  packageManager: string;
}

/**
 * Directory structure analysis
 */
export interface DirectoryStructure {
  /** Entry point files */
  entryPoints: string[];
  /** Source directories */
  srcDirs: string[];
  /** Test directories */
  testDirs: string[];
  /** Configuration files */
  configFiles: string[];
}

/**
 * Module information
 */
export interface ModuleInfo {
  /** Module name */
  name: string;
  /** Relative path */
  path: string;
  /** Module description */
  description: string;
  /** Files in this module */
  files: string[];
  /** Completion status */
  status: "complete" | "partial" | "stub";
}

/**
 * Discovered feature from project scanning
 */
export interface DiscoveredFeature {
  /** Generated task ID */
  id: string;
  /** Description from source */
  description: string;
  /** Inferred module */
  module: string;
  /** Source of discovery */
  source: "route" | "test" | "controller" | "model" | "inferred" | "feature_list";
  /** Confidence score (0-1) */
  confidence: number;
  /** Actual status from feature index (optional) */
  status?: FeatureStatus;
}

/**
 * Completion assessment
 */
export interface CompletionAssessment {
  /** Overall completion percentage (0-100) */
  overall: number;
  /** Completion by module */
  byModule: Record<string, number>;
  /** Assessment notes */
  notes: string[];
}

/**
 * Project commands
 */
export interface ProjectCommands {
  /** Install dependencies command */
  install: string;
  /** Start development server command */
  dev: string;
  /** Build for production command */
  build: string;
  /** Run tests command */
  test: string;
  /** Lint command (optional) */
  lint?: string;
}

/**
 * Complete project survey result
 */
export interface ProjectSurvey {
  /** Detected tech stack */
  techStack: TechStackInfo;
  /** Directory structure */
  structure: DirectoryStructure;
  /** Discovered modules */
  modules: ModuleInfo[];
  /** Discovered features */
  features: DiscoveredFeature[];
  /** Completion assessment */
  completion: CompletionAssessment;
  /** Available commands */
  commands: ProjectCommands;
}
