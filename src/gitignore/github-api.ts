/**
 * GitHub API client for gitignore templates with caching
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { homedir } from "node:os";
import { getBundledTemplate, isBundledTemplate } from "./bundled-templates.js";

/** Cache directory for gitignore templates */
const CACHE_DIR = path.join(homedir(), ".agent-foreman", "gitignore-cache");

/** Cache TTL: 7 days in milliseconds */
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

/** GitHub API base URL for gitignore templates */
const GITHUB_API_BASE = "https://api.github.com/gitignore/templates";

/**
 * Get the cache directory path
 */
export function getCacheDir(): string {
  return CACHE_DIR;
}

/**
 * Get the cache TTL in milliseconds
 */
export function getCacheTTL(): number {
  return CACHE_TTL;
}

/**
 * Cache entry structure
 */
interface CacheEntry {
  source: string;
  cachedAt: number;
  etag?: string;
}

/**
 * Result of fetching a gitignore template
 */
export interface FetchResult {
  /** Template content */
  source: string;
  /** Whether the content came from cache */
  fromCache: boolean;
  /** Whether the content came from bundled fallback */
  fallback: boolean;
}

/**
 * Ensure cache directory exists
 */
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Get cache file path for a template
 */
function getCachePath(name: string): string {
  return path.join(CACHE_DIR, `${name}.json`);
}

/**
 * Read cache entry if valid
 */
function readCache(name: string): CacheEntry | null {
  const cachePath = getCachePath(name);
  if (!fs.existsSync(cachePath)) {
    return null;
  }

  try {
    const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8")) as CacheEntry;
    return cached;
  } catch {
    return null;
  }
}

/**
 * Write cache entry
 */
function writeCache(name: string, entry: CacheEntry): void {
  ensureCacheDir();
  const cachePath = getCachePath(name);
  fs.writeFileSync(cachePath, JSON.stringify(entry, null, 2));
}

/**
 * Fetch gitignore template from GitHub API with caching
 * @param name - Template name (e.g., "Node", "Python")
 * @returns Fetch result with source content and metadata
 */
export async function fetchGitignoreTemplate(name: string): Promise<FetchResult> {
  // Check cache first
  const cached = readCache(name);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return { source: cached.source, fromCache: true, fallback: false };
  }

  // Try API with ETag for conditional request
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "agent-foreman",
    };

    // Add ETag for conditional request if we have a cached version
    if (cached?.etag) {
      headers["If-None-Match"] = cached.etag;
    }

    const response = await fetch(`${GITHUB_API_BASE}/${name}`, { headers });

    // 304 Not Modified - use cached version
    if (response.status === 304 && cached) {
      // Update cache timestamp
      writeCache(name, { ...cached, cachedAt: Date.now() });
      return { source: cached.source, fromCache: true, fallback: false };
    }

    // Check for errors
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    // Parse response
    const data = (await response.json()) as { source: string };
    const etag = response.headers.get("etag") || undefined;

    // Cache the result
    writeCache(name, {
      source: data.source,
      cachedAt: Date.now(),
      etag,
    });

    return { source: data.source, fromCache: false, fallback: false };
  } catch {
    // Fallback to bundled template
    if (isBundledTemplate(name)) {
      const bundled = getBundledTemplate(name);
      if (bundled) {
        return { source: bundled, fromCache: false, fallback: true };
      }
    }

    // If we have a stale cache, use it as last resort
    if (cached) {
      return { source: cached.source, fromCache: true, fallback: false };
    }

    throw new Error(`Template ${name} not found and no fallback available`);
  }
}

/**
 * List available gitignore templates from GitHub API
 * @returns Array of template names
 */
export async function listGitignoreTemplates(): Promise<string[]> {
  try {
    const response = await fetch(GITHUB_API_BASE, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "agent-foreman",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const templates = (await response.json()) as string[];
    return templates;
  } catch {
    // Return empty array on error
    return [];
  }
}

/**
 * Clear all cached gitignore templates
 */
export function clearCache(): void {
  if (!fs.existsSync(CACHE_DIR)) return;

  const files = fs.readdirSync(CACHE_DIR);
  for (const file of files) {
    if (file.endsWith(".json")) {
      fs.unlinkSync(path.join(CACHE_DIR, file));
    }
  }
}

/**
 * Get cache statistics
 * @returns Object with cache stats
 */
export function getCacheStats(): { count: number; totalSize: number; oldestFile?: string } {
  if (!fs.existsSync(CACHE_DIR)) {
    return { count: 0, totalSize: 0 };
  }

  const files = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));
  let totalSize = 0;
  let oldestTime = Date.now();
  let oldestFile: string | undefined;

  for (const file of files) {
    const filePath = path.join(CACHE_DIR, file);
    const stats = fs.statSync(filePath);
    totalSize += stats.size;

    if (stats.mtimeMs < oldestTime) {
      oldestTime = stats.mtimeMs;
      oldestFile = file.replace(".json", "");
    }
  }

  return {
    count: files.length,
    totalSize,
    oldestFile,
  };
}
