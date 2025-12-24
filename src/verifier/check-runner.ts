/**
 * Check runner - Core check execution functions
 * Handles running individual automated checks
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

import type { AutomatedCheckResult } from "./types/index.js";

const execAsync = promisify(exec);

/**
 * Run a single automated check
 */
export async function runCheck(
  cwd: string,
  type: AutomatedCheckResult["type"],
  command: string
): Promise<AutomatedCheckResult> {
  return runCheckWithEnv(cwd, type, command, {});
}

/**
 * Run a single automated check with custom environment variables
 */
export async function runCheckWithEnv(
  cwd: string,
  type: AutomatedCheckResult["type"],
  command: string,
  env: Record<string, string>
): Promise<AutomatedCheckResult> {
  const startTime = Date.now();

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      maxBuffer: 5 * 1024 * 1024,
      timeout: 300000, // 5 minute timeout
      env: { ...process.env, ...env },
    });

    return {
      type,
      success: true,
      output: stdout + stderr,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; code?: number };
    return {
      type,
      success: false,
      output: (execError.stdout || "") + (execError.stderr || ""),
      duration: Date.now() - startTime,
    };
  }
}
