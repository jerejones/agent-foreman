/**
 * Types for file strategy
 */

/**
 * Result of a single file check
 */
export interface FileCheckResult {
  path: string;
  success: boolean;
  checks: Array<{
    type: string;
    success: boolean;
    message?: string;
  }>;
}

/**
 * Result of path validation
 */
export interface PathValidationResult {
  valid: boolean;
  paths?: string[];
  error?: string;
}

/**
 * Result of individual check operation
 */
export interface CheckOperationResult {
  type: string;
  success: boolean;
  message?: string;
}
