/**
 * Types and interfaces for AI-powered project scanning
 */
import type {
  TechStackInfo,
  ModuleInfo,
  DiscoveredFeature,
  CompletionAssessment,
  ProjectCommands,
} from "../types/index.js";

/**
 * AI analysis result
 */
export interface AIAnalysisResult {
  success: boolean;
  techStack?: TechStackInfo;
  modules?: ModuleInfo[];
  features?: DiscoveredFeature[];
  completion?: CompletionAssessment;
  commands?: ProjectCommands;
  summary?: string;
  recommendations?: string[];
  error?: string;
  agentUsed?: string;
}

/**
 * Options for AI scanning
 */
export interface AIScanOptions {
  verbose?: boolean;
}
