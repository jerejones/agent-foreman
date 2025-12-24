/**
 * Script Strategy Validators
 */

import { resolve, relative, isAbsolute } from "node:path";
import { access, constants } from "node:fs/promises";

import { DANGEROUS_PATTERNS, SHELL_INJECTION_PATTERNS } from "./constants.js";

/**
 * Validate script path is safe and within project root
 */
export async function validateScriptPath(
  cwd: string,
  scriptPath: string
): Promise<{ valid: boolean; absolutePath?: string; error?: string }> {
  // Resolve the path
  const absolutePath = isAbsolute(scriptPath)
    ? scriptPath
    : resolve(cwd, scriptPath);

  // Get relative path from cwd
  const relativePath = relative(cwd, absolutePath);

  // Check if path escapes project root
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return {
      valid: false,
      error: `Script path must be within project root: ${scriptPath}`,
    };
  }

  // Check if file exists and is readable
  try {
    await access(absolutePath, constants.R_OK);
  } catch {
    return {
      valid: false,
      error: `Script file not found or not readable: ${scriptPath}`,
    };
  }

  // Check if file is executable
  try {
    await access(absolutePath, constants.X_OK);
  } catch {
    // Not executable, will need to run with interpreter
    // This is acceptable for .sh files etc.
  }

  return { valid: true, absolutePath };
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
 * Validate args for dangerous patterns
 * Checks the joined args string for dangerous command patterns
 */
export function validateArgs(args: string[]): { valid: boolean; error?: string } {
  // Join args to check for dangerous patterns across multiple args
  const argsString = args.join(" ");

  // Check for dangerous patterns in the joined args
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(argsString)) {
      return {
        valid: false,
        error: `Arguments contain dangerous pattern: ${pattern.source}`,
      };
    }
  }

  // Check for shell injection patterns in individual args
  for (const arg of args) {
    for (const pattern of SHELL_INJECTION_PATTERNS) {
      if (pattern.test(arg)) {
        return {
          valid: false,
          error: `Argument contains dangerous pattern: ${arg}`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Build command with script path and arguments
 */
export function buildCommand(scriptPath: string, args?: string[]): string {
  // Escape the script path
  const escapedPath = scriptPath.replace(/'/g, "'\\''");

  // Build command
  let command = `'${escapedPath}'`;

  // Add arguments if provided
  if (args && args.length > 0) {
    const escapedArgs = args.map((arg) => {
      // Escape single quotes in arguments
      const escaped = arg.replace(/'/g, "'\\''");
      return `'${escaped}'`;
    });
    command += " " + escapedArgs.join(" ");
  }

  return command;
}
