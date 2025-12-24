/**
 * Disk cache functions for capabilities
 * Handles loading, saving, and validating the capability cache
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { debugCache } from "../debug.js";
import type { ExtendedCapabilities, CapabilityCache } from "../verifier/types/index.js";
import { CACHE_FILE, CACHE_VERSION } from "./constants.js";
import { getGitCommitHash, hasCommitChanged, hasBuildFileChanges } from "./git-helpers.js";

/**
 * Load cached capabilities from ai/capabilities.json
 */
export async function loadCachedCapabilities(
  cwd: string
): Promise<ExtendedCapabilities | null> {
  const cachePath = path.join(cwd, CACHE_FILE);

  try {
    const content = await fs.readFile(cachePath, "utf-8");
    const cache: CapabilityCache = JSON.parse(content);

    // Validate cache version
    if (cache.version !== CACHE_VERSION) {
      console.log(`Cache version mismatch (${cache.version} vs ${CACHE_VERSION}), invalidating...`);
      return null;
    }

    // Return capabilities with source marked as cached
    return {
      ...cache.capabilities,
      source: "cached",
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    console.warn("Failed to parse capability cache:", (error as Error).message);
    return null;
  }
}

/**
 * Save capabilities to ai/capabilities.json
 */
export async function saveCapabilities(
  cwd: string,
  capabilities: ExtendedCapabilities,
  trackedFiles: string[] = []
): Promise<void> {
  const cachePath = path.join(cwd, CACHE_FILE);
  const cacheDir = path.dirname(cachePath);

  await fs.mkdir(cacheDir, { recursive: true });

  const commitHash = getGitCommitHash(cwd);

  const cache: CapabilityCache = {
    version: CACHE_VERSION,
    capabilities: {
      ...capabilities,
      detectedAt: new Date().toISOString(),
    },
    commitHash,
    trackedFiles,
  };

  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
}

/**
 * Invalidate (remove) the capability cache
 */
export async function invalidateCache(cwd: string): Promise<void> {
  const cachePath = path.join(cwd, CACHE_FILE);

  try {
    await fs.unlink(cachePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * Check if the cache is stale based on git changes to tracked config files
 */
export async function isStale(cwd: string): Promise<boolean> {
  const cachePath = path.join(cwd, CACHE_FILE);

  try {
    const content = await fs.readFile(cachePath, "utf-8");
    const cache: CapabilityCache = JSON.parse(content);

    if (!cache.commitHash) {
      debugCache("No commit hash in cache, marking as stale");
      return true;
    }

    // If no tracked files, cache is never stale (until commit changes)
    const trackedFiles = cache.trackedFiles || [];
    if (trackedFiles.length === 0) {
      debugCache("No tracked files, checking commit hash only");
      return hasCommitChanged(cwd, cache.commitHash);
    }

    return hasBuildFileChanges(cwd, cache.commitHash, trackedFiles);
  } catch (error) {
    debugCache("isStale check failed: %s", (error as Error).message);
    return true;
  }
}

/**
 * Load cache with full metadata (for debugging/inspection)
 */
export async function loadFullCache(cwd: string): Promise<CapabilityCache | null> {
  const cachePath = path.join(cwd, CACHE_FILE);

  try {
    const content = await fs.readFile(cachePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    debugCache("loadFullCache failed: %s", (error as Error).message);
    return null;
  }
}
