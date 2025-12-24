/**
 * Project Capabilities Detection
 *
 * Discovers and caches project verification commands (test, typecheck, lint, build)
 * using AI-powered autonomous exploration.
 *
 * Architecture: Cache → AI Discovery
 * - First checks ai/capabilities.json cache
 * - If cache miss or stale, uses AI to explore and discover commands
 */

// Constants
export { CACHE_VERSION, MEMORY_CACHE_TTL } from "./constants.js";

// Types
export type { MemoryCache, AICapabilityResponse, DiscoveryResult } from "./types.js";

// Memory cache
export { clearCapabilitiesCache } from "./memory-cache.js";

// Disk cache operations
export {
  loadCachedCapabilities,
  saveCapabilities,
  invalidateCache,
  isStale,
  loadFullCache,
} from "./cache.js";

// AI discovery
export {
  buildAutonomousDiscoveryPrompt,
  parseCapabilityResponse,
  discoverCapabilitiesWithAI,
} from "./ai-discovery.js";

// Main API
export { detectCapabilities, detectVerificationCapabilities } from "./main.js";

// Formatting
export { formatCapabilities, formatExtendedCapabilities } from "./formatting.js";
