/**
 * Git helper functions for capability cache validation
 */
import { spawnSync } from "node:child_process";
import { debugCache } from "../debug.js";

/**
 * Get the current git commit hash
 */
export function getGitCommitHash(cwd: string): string | undefined {
  try {
    const result = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (result.status !== 0) {
      debugCache("git rev-parse failed with status %d", result.status);
      return undefined;
    }
    return result.stdout.trim();
  } catch (error) {
    debugCache("Failed to get git commit hash: %s", (error as Error).message);
    return undefined;
  }
}

/**
 * Check if the commit has changed since the cached version
 */
export function hasCommitChanged(cwd: string, cachedCommitHash: string): boolean {
  const currentHash = getGitCommitHash(cwd);
  if (!currentHash) {
    return true; // Can't determine, assume stale
  }
  return currentHash !== cachedCommitHash;
}

/**
 * Check if any of the tracked build files have changed since the cached commit
 */
export function hasBuildFileChanges(cwd: string, commitHash: string, files: string[]): boolean {
  try {
    const args = ["diff", "--name-only", commitHash, "HEAD", "--", ...files];
    const result = spawnSync("git", args, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (result.status !== 0) {
      debugCache("git diff failed with status %d", result.status);
      return true;
    }

    return result.stdout.trim().length > 0;
  } catch (error) {
    debugCache("hasBuildFileChanges error: %s", (error as Error).message);
    return true;
  }
}

/**
 * Check if git is available in the project
 */
export function checkGitAvailable(cwd: string): boolean {
  try {
    const result = spawnSync("git", ["rev-parse", "--git-dir"], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result.status === 0;
  } catch {
    return false;
  }
}
