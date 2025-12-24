/**
 * File check operations for file strategy
 */

import { stat, readFile, access, constants } from "node:fs/promises";

import type { FileCheck } from "../../verifier/types/index.js";
import type { FileCheckResult, CheckOperationResult } from "./types.js";

/**
 * Apply all checks to a single file
 */
export async function checkFile(
  filePath: string,
  checks: FileCheck[]
): Promise<FileCheckResult> {
  const checkResults: CheckOperationResult[] = [];
  let overallSuccess = true;

  for (const check of checks) {
    // Exists check
    if (check.exists !== undefined) {
      const result = await checkExists(filePath, check.exists);
      checkResults.push(result);
      if (!result.success) overallSuccess = false;

      // If file doesn't exist and we expected it to, skip other checks
      if (check.exists && !result.success) {
        break;
      }

      // If file exists but we expected it not to, skip other checks
      if (!check.exists && !result.success) {
        break;
      }
    }

    // Content pattern check
    if (check.containsPattern !== undefined) {
      const result = await checkContainsPattern(filePath, check.containsPattern);
      checkResults.push(result);
      if (!result.success) overallSuccess = false;
    }

    // Exact content check
    if (check.matchesContent !== undefined) {
      const result = await checkMatchesContent(filePath, check.matchesContent);
      checkResults.push(result);
      if (!result.success) overallSuccess = false;
    }

    // Size constraint check
    if (check.sizeConstraint !== undefined) {
      const result = await checkSizeConstraint(filePath, check.sizeConstraint);
      checkResults.push(result);
      if (!result.success) overallSuccess = false;
    }

    // Not empty check
    if (check.notEmpty) {
      const result = await checkNotEmpty(filePath);
      checkResults.push(result);
      if (!result.success) overallSuccess = false;
    }

    // Permissions check
    if (check.permissions !== undefined) {
      const result = await checkPermissions(filePath, check.permissions);
      checkResults.push(result);
      if (!result.success) overallSuccess = false;
    }
  }

  return {
    path: filePath,
    success: overallSuccess,
    checks: checkResults,
  };
}

/**
 * Check if file exists
 */
export async function checkExists(
  filePath: string,
  shouldExist: boolean
): Promise<CheckOperationResult> {
  try {
    await access(filePath, constants.F_OK);
    const exists = true;
    const success = exists === shouldExist;
    return {
      type: "exists",
      success,
      message: success
        ? shouldExist
          ? "File exists"
          : undefined
        : shouldExist
          ? "File does not exist"
          : "File exists but should not",
    };
  } catch {
    const exists = false;
    const success = exists === shouldExist;
    return {
      type: "exists",
      success,
      message: success
        ? !shouldExist
          ? "File correctly does not exist"
          : undefined
        : "File does not exist",
    };
  }
}

/**
 * Check if file contains pattern
 */
export async function checkContainsPattern(
  filePath: string,
  pattern: string
): Promise<CheckOperationResult> {
  try {
    const content = await readFile(filePath, "utf-8");
    const regex = new RegExp(pattern);
    const matches = regex.test(content);
    return {
      type: "containsPattern",
      success: matches,
      message: matches ? undefined : `Pattern not found: ${pattern}`,
    };
  } catch (error) {
    return {
      type: "containsPattern",
      success: false,
      message: `Failed to read file: ${(error as Error).message}`,
    };
  }
}

/**
 * Check if file matches content exactly
 */
export async function checkMatchesContent(
  filePath: string,
  expectedContent: string
): Promise<CheckOperationResult> {
  try {
    const content = await readFile(filePath, "utf-8");
    const matches = content === expectedContent;
    return {
      type: "matchesContent",
      success: matches,
      message: matches ? undefined : "File content does not match expected",
    };
  } catch (error) {
    return {
      type: "matchesContent",
      success: false,
      message: `Failed to read file: ${(error as Error).message}`,
    };
  }
}

/**
 * Check file size constraints
 */
export async function checkSizeConstraint(
  filePath: string,
  constraint: { min?: number; max?: number }
): Promise<CheckOperationResult> {
  try {
    const stats = await stat(filePath);
    const size = stats.size;

    if (constraint.min !== undefined && size < constraint.min) {
      return {
        type: "sizeConstraint",
        success: false,
        message: `File size ${size} is less than minimum ${constraint.min}`,
      };
    }

    if (constraint.max !== undefined && size > constraint.max) {
      return {
        type: "sizeConstraint",
        success: false,
        message: `File size ${size} exceeds maximum ${constraint.max}`,
      };
    }

    return {
      type: "sizeConstraint",
      success: true,
    };
  } catch (error) {
    return {
      type: "sizeConstraint",
      success: false,
      message: `Failed to get file stats: ${(error as Error).message}`,
    };
  }
}

/**
 * Check file is not empty
 */
export async function checkNotEmpty(filePath: string): Promise<CheckOperationResult> {
  try {
    const stats = await stat(filePath);
    const notEmpty = stats.size > 0;
    return {
      type: "notEmpty",
      success: notEmpty,
      message: notEmpty ? undefined : "File is empty",
    };
  } catch (error) {
    return {
      type: "notEmpty",
      success: false,
      message: `Failed to get file stats: ${(error as Error).message}`,
    };
  }
}

/**
 * Check file permissions (Unix only)
 */
export async function checkPermissions(
  filePath: string,
  expectedPermissions: string
): Promise<CheckOperationResult> {
  try {
    const stats = await stat(filePath);
    // Get last 3 octal digits of mode
    const mode = (stats.mode & 0o777).toString(8).padStart(3, "0");
    const matches = mode === expectedPermissions;
    return {
      type: "permissions",
      success: matches,
      message: matches ? undefined : `Permissions ${mode} do not match expected ${expectedPermissions}`,
    };
  } catch (error) {
    return {
      type: "permissions",
      success: false,
      message: `Failed to get file stats: ${(error as Error).message}`,
    };
  }
}
