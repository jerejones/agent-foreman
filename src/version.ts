/**
 * Version utility functions
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Build-time injected version (for compiled binaries)
declare const __VERSION__: string | undefined;

/**
 * Get the current package version
 * Uses build-time injected version if available (compiled binary),
 * otherwise reads from package.json
 */
export function getCurrentVersion(): string {
  // Check for build-time injected version (compiled binary)
  if (typeof __VERSION__ !== "undefined") {
    return __VERSION__;
  }

  // Fall back to reading package.json
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Compare two semantic version strings
 * @returns positive if a > b, negative if a < b, 0 if equal
 */
export function compareVersions(a: string, b: string): number {
  const parseVersion = (v: string): number[] => {
    return v
      .replace(/^v/, "")
      .split(".")
      .map((n) => parseInt(n, 10) || 0);
  };

  const partsA = parseVersion(a);
  const partsB = parseVersion(b);
  const maxLen = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLen; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA !== numB) {
      return numA - numB;
    }
  }

  return 0;
}
