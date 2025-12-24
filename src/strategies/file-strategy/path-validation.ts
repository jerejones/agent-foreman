/**
 * Path validation and resolution for file strategy
 */

import { relative, isAbsolute } from "node:path";
import { glob } from "glob";

import type { PathValidationResult } from "./types.js";

/**
 * Validate path is within project root and resolve glob patterns
 */
export async function validateAndResolvePath(
  cwd: string,
  pathPattern: string
): Promise<PathValidationResult> {
  // Check for path traversal attempts in the pattern itself
  if (pathPattern.includes("..") && hasUnsafeTraversal(pathPattern)) {
    return {
      valid: false,
      error: `Path pattern contains unsafe traversal: ${pathPattern}`,
    };
  }

  // Check for absolute paths
  if (isAbsolute(pathPattern) && !pathPattern.startsWith(cwd)) {
    return {
      valid: false,
      error: `Absolute path must be within project root: ${pathPattern}`,
    };
  }

  try {
    // Resolve glob pattern
    const matches = await glob(pathPattern, {
      cwd,
      absolute: true,
      nodir: true,
    });

    // Validate each matched path is within project root
    for (const matchPath of matches) {
      const relativePath = relative(cwd, matchPath);
      if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
        return {
          valid: false,
          error: `Matched path escapes project root: ${matchPath}`,
        };
      }
    }

    return { valid: true, paths: matches };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to resolve path pattern: ${(error as Error).message}`,
    };
  }
}

/**
 * Check if path pattern has unsafe traversal
 * Safe: "src/../lib" (stays within project)
 * Unsafe: "../../../etc/passwd" (escapes project)
 */
export function hasUnsafeTraversal(pathPattern: string): boolean {
  // Count ".." segments vs regular segments
  const segments = pathPattern.split(/[/\\]/);
  let depth = 0;
  let minDepth = 0;

  for (const segment of segments) {
    if (segment === "..") {
      depth--;
      minDepth = Math.min(minDepth, depth);
    } else if (segment && segment !== ".") {
      depth++;
    }
  }

  // If we ever go negative, it's escaping
  return minDepth < 0;
}
