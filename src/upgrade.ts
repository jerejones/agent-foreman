/**
 * Auto-upgrade utility for agent-foreman
 * Checks npm registry for newer versions and silently upgrades in background
 */

import { spawn, spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_NAME = "agent-foreman";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_FILE = ".agent-foreman-upgrade-check";

export interface UpgradeCheckResult {
  needsUpgrade: boolean;
  currentVersion: string;
  latestVersion: string | null;
  error?: string;
}

export interface UpgradeResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  error?: string;
}

/**
 * Get the cache file path in user's home directory
 */
function getCacheFilePath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "/tmp";
  return path.join(homeDir, CACHE_FILE);
}

/**
 * Get the current package version from package.json
 */
export function getCurrentVersion(): string {
  try {
    // Get the directory of this module
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.join(__dirname, "..", "package.json");
    const pkgContent = require("fs").readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(pkgContent);
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Check if we should perform an upgrade check based on throttle interval
 */
async function shouldCheckForUpgrade(): Promise<boolean> {
  try {
    const cacheFile = getCacheFilePath();
    const stat = await fs.stat(cacheFile);
    const lastCheck = stat.mtime.getTime();
    const now = Date.now();
    return now - lastCheck >= CHECK_INTERVAL_MS;
  } catch {
    // Cache file doesn't exist, should check
    return true;
  }
}

/**
 * Update the last check timestamp
 */
async function updateLastCheckTime(): Promise<void> {
  try {
    const cacheFile = getCacheFilePath();
    await fs.writeFile(cacheFile, new Date().toISOString());
  } catch {
    // Ignore write errors for cache file
  }
}

/**
 * Fetch the latest version from npm registry
 */
export async function fetchLatestVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const result = spawnSync("npm", ["view", PACKAGE_NAME, "version"], {
        encoding: "utf-8",
        timeout: 10000, // 10 second timeout
      });

      if (result.status === 0 && result.stdout) {
        resolve(result.stdout.trim());
      } else {
        resolve(null);
      }
    } catch {
      resolve(null);
    }
  });
}

/**
 * Compare two semantic version strings
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map((p) => parseInt(p, 10) || 0);
  const parts2 = v2.split(".").map((p) => parseInt(p, 10) || 0);

  // Pad arrays to same length
  const maxLen = Math.max(parts1.length, parts2.length);
  while (parts1.length < maxLen) parts1.push(0);
  while (parts2.length < maxLen) parts2.push(0);

  for (let i = 0; i < maxLen; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }

  return 0;
}

/**
 * Check if an upgrade is available
 */
export async function checkForUpgrade(): Promise<UpgradeCheckResult> {
  const currentVersion = getCurrentVersion();

  try {
    const latestVersion = await fetchLatestVersion();

    if (!latestVersion) {
      return {
        needsUpgrade: false,
        currentVersion,
        latestVersion: null,
        error: "Could not fetch latest version from npm",
      };
    }

    const needsUpgrade = compareVersions(latestVersion, currentVersion) > 0;

    return {
      needsUpgrade,
      currentVersion,
      latestVersion,
    };
  } catch (err) {
    return {
      needsUpgrade: false,
      currentVersion,
      latestVersion: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Perform a silent background upgrade
 * This spawns npm install in background and does not block
 */
export function performSilentUpgrade(): void {
  try {
    // Spawn npm install -g in background (detached)
    const child = spawn("npm", ["install", "-g", `${PACKAGE_NAME}@latest`], {
      detached: true,
      stdio: "ignore",
    });

    // Unref so parent can exit without waiting for child
    child.unref();
  } catch {
    // Silently ignore upgrade errors
  }
}

/**
 * Main auto-upgrade function to be called on CLI startup
 * This is non-blocking and runs checks/upgrades in background
 */
export async function autoUpgradeCheck(): Promise<void> {
  try {
    // Check if we should check for upgrades (throttled)
    if (!(await shouldCheckForUpgrade())) {
      return;
    }

    // Update last check time
    await updateLastCheckTime();

    // Check for upgrade
    const result = await checkForUpgrade();

    if (result.needsUpgrade && result.latestVersion) {
      // Perform silent background upgrade
      performSilentUpgrade();
    }
  } catch {
    // Silently ignore any errors during auto-upgrade
  }
}

/**
 * Force an upgrade check (ignoring throttle)
 * Returns the check result for display purposes
 */
export async function forceUpgradeCheck(): Promise<UpgradeCheckResult> {
  await updateLastCheckTime();
  return checkForUpgrade();
}
