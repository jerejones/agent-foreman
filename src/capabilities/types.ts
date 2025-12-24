/**
 * Types specific to capability detection
 */
import type { ExtendedCapabilities } from "../verifier/types/index.js";

/** Memory cache structure */
export interface MemoryCache {
  cwd: string;
  capabilities: ExtendedCapabilities;
  timestamp: number;
}

/** AI response structure for capability discovery */
export interface AICapabilityResponse {
  languages: string[];
  configFiles: string[];
  packageManager?: string;
  test?: {
    available: boolean;
    command?: string;
    framework?: string;
    confidence?: number;
    /** Template for running specific test files, e.g., "pnpm test {files}" */
    selectiveFileTemplate?: string;
    /** Template for running tests by name pattern, e.g., "pnpm test --testNamePattern {pattern}" */
    selectiveNameTemplate?: string;
  };
  e2e?: {
    available: boolean;
    command?: string;
    framework?: string;
    confidence?: number;
    /** Config file path, e.g., "playwright.config.ts" */
    configFile?: string;
    /** Template for grep filtering by tags, e.g., "npx playwright test --grep {tags}" */
    grepTemplate?: string;
    /** Template for running specific files, e.g., "npx playwright test {files}" */
    fileTemplate?: string;
  };
  typecheck?: {
    available: boolean;
    command?: string;
    confidence?: number;
  };
  lint?: {
    available: boolean;
    command?: string;
    confidence?: number;
  };
  build?: {
    available: boolean;
    command?: string;
    confidence?: number;
  };
  customRules?: Array<{
    id: string;
    description: string;
    command: string;
    type: string;
  }>;
}

/** Result from AI discovery including config files for cache tracking */
export interface DiscoveryResult {
  capabilities: ExtendedCapabilities;
  configFiles: string[];
}
