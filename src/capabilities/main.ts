/**
 * Main capability detection API
 */
import type { ExtendedCapabilities, VerificationCapabilities } from "../verifier/types/index.js";
import { getMemoryCache, setMemoryCache } from "./memory-cache.js";
import { loadCachedCapabilities, saveCapabilities, isStale } from "./cache.js";
import { discoverCapabilitiesWithAI } from "./ai-discovery.js";

/**
 * Detect project capabilities using two-tier system:
 * 1. Cache - Return cached capabilities if valid and not stale
 * 2. AI Discovery - Use AI to autonomously explore and discover capabilities
 */
export async function detectCapabilities(
  cwd: string,
  options: {
    /** Force re-detection even if cache exists */
    force?: boolean;
    /** Show verbose output */
    verbose?: boolean;
    /** Callback when an agent is selected, useful for updating parent spinners */
    onAgentSelected?: (agentName: string) => void;
  } = {}
): Promise<ExtendedCapabilities> {
  const { force = false, verbose = false, onAgentSelected } = options;

  // 0. Try memory cache first (fastest)
  if (!force) {
    const memoryCached = getMemoryCache(cwd);
    if (memoryCached) {
      if (verbose) {
        console.log("  Using memory-cached capabilities");
      }
      return memoryCached;
    }
  }

  // 1. Try disk cache
  if (!force) {
    const cached = await loadCachedCapabilities(cwd);
    if (cached) {
      const stale = await isStale(cwd);
      if (!stale) {
        if (verbose) {
          console.log("  Using cached capabilities");
        }
        // Update memory cache
        setMemoryCache(cwd, cached);
        return cached;
      }
      if (verbose) {
        console.log("  Cache is stale, re-detecting...");
      }
    }
  }

  // 2. Use AI discovery
  if (verbose) {
    console.log("  Using AI-based capability discovery...");
  }

  const { capabilities, configFiles } = await discoverCapabilitiesWithAI(cwd, { onAgentSelected });
  await saveCapabilities(cwd, capabilities, configFiles);

  // Update memory cache
  setMemoryCache(cwd, capabilities);

  return capabilities;
}

/**
 * Detect capabilities (legacy format)
 * @deprecated Use detectCapabilities() instead
 */
export async function detectVerificationCapabilities(
  cwd: string
): Promise<VerificationCapabilities> {
  const extended = await detectCapabilities(cwd);

  return {
    hasTests: extended.hasTests,
    testCommand: extended.testCommand,
    testFramework: extended.testFramework,
    hasTypeCheck: extended.hasTypeCheck,
    typeCheckCommand: extended.typeCheckCommand,
    hasLint: extended.hasLint,
    lintCommand: extended.lintCommand,
    hasBuild: extended.hasBuild,
    buildCommand: extended.buildCommand,
    hasGit: extended.hasGit,
  };
}
