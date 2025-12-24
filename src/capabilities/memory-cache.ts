/**
 * Memory cache for capabilities
 * Fast in-memory caching with TTL
 */
import type { ExtendedCapabilities } from "../verifier/types/index.js";
import type { MemoryCache } from "./types.js";
import { MEMORY_CACHE_TTL } from "./constants.js";

/** Module-level memory cache */
let memoryCache: MemoryCache | null = null;

/**
 * Clear the memory cache (for testing purposes)
 */
export function clearCapabilitiesCache(): void {
  memoryCache = null;
}

/**
 * Get cached capabilities from memory if valid
 */
export function getMemoryCache(cwd: string): ExtendedCapabilities | null {
  if (!memoryCache) {
    return null;
  }

  // Check if cache is for the same project
  if (memoryCache.cwd !== cwd) {
    return null;
  }

  // Check if cache has expired
  const age = Date.now() - memoryCache.timestamp;
  if (age > MEMORY_CACHE_TTL) {
    return null;
  }

  return memoryCache.capabilities;
}

/**
 * Update the memory cache
 */
export function setMemoryCache(cwd: string, capabilities: ExtendedCapabilities): void {
  memoryCache = {
    cwd,
    capabilities,
    timestamp: Date.now(),
  };
}
