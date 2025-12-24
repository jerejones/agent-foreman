/**
 * Shared types for command implementations
 */
import type { InitMode, TaskType } from "../types/index.js";

/**
 * Common options for verification commands
 */
export interface VerificationOptions {
  verbose: boolean;
  skipChecks?: boolean;
  autonomous?: boolean;
  testMode: "full" | "quick" | "skip";
  testPattern?: string;
  skipE2E: boolean;
  e2eMode?: "full" | "smoke" | "tags" | "skip";
}

/**
 * Options for the 'next' command
 */
export interface NextCommandOptions {
  featureId?: string;
  dryRun: boolean;
  runCheck: boolean;
  allowDirty: boolean;
  outputJson: boolean;
  quiet: boolean;
  refreshGuidance: boolean;
}

/**
 * Options for the 'done' command
 */
export interface DoneCommandOptions extends VerificationOptions {
  featureId: string;
  notes?: string;
  autoCommit: boolean;
  skipVerify: boolean;
}

/**
 * Options for the 'check' command
 */
export interface CheckCommandOptions extends VerificationOptions {
  featureId: string;
}

/**
 * Options for the 'init' command
 */
export interface InitCommandOptions {
  goal: string;
  mode: InitMode;
  verbose: boolean;
  taskType?: TaskType;
}

/**
 * Options for the 'status' command
 */
export interface StatusCommandOptions {
  outputJson: boolean;
  quiet: boolean;
}

/**
 * Options for the 'migrate' command
 */
export interface MigrateCommandOptions {
  dryRun: boolean;
  force: boolean;
}

/**
 * Options for the 'detect-capabilities' command
 */
export interface DetectCapabilitiesOptions {
  force: boolean;
  verbose: boolean;
}
