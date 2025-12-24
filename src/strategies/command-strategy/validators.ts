/**
 * Command Strategy Validators
 */

import { relative, isAbsolute } from "node:path";
import { DANGEROUS_PATTERNS } from "./constants.js";

/**
 * Validate working directory is within project root
 */
export function validateCwd(
  projectRoot: string,
  workingDir: string
): { valid: boolean; error?: string } {
  const relativePath = relative(projectRoot, workingDir);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return {
      valid: false,
      error: `Working directory must be within project root: ${workingDir}`,
    };
  }

  return { valid: true };
}

/**
 * Validate command for dangerous patterns
 */
export function validateCommand(command: string): { valid: boolean; error?: string } {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return {
        valid: false,
        error: `Command contains dangerous pattern: ${pattern.source}`,
      };
    }
  }
  return { valid: true };
}

/**
 * Check if exit code matches expected
 */
export function checkExitCodeMatch(actual: number, expected: number | number[]): boolean {
  if (Array.isArray(expected)) {
    return expected.includes(actual);
  }
  return actual === expected;
}

/**
 * Build command with arguments
 */
export function buildCommand(command: string, args?: string[]): string {
  if (!args || args.length === 0) {
    return command;
  }

  // Escape arguments
  const escapedArgs = args.map((arg) => {
    // If argument contains special characters, quote it
    if (/["\s$`\\]/.test(arg)) {
      const escaped = arg.replace(/"/g, '\\"');
      return `"${escaped}"`;
    }
    return arg;
  });

  return `${command} ${escapedArgs.join(" ")}`;
}
