#!/usr/bin/env bun
/**
 * Binary Hash Embedding Script
 *
 * Computes SHA-256 hashes of compiled binaries and embeds them into source files
 * for runtime integrity verification. This enables the binary to verify it has
 * not been tampered with.
 *
 * Usage:
 *   bun scripts/embed-hash.ts                           # Embed hash for all platforms
 *   bun scripts/embed-hash.ts --target darwin-arm64     # Embed hash for specific platform
 *   bun scripts/embed-hash.ts --verify                  # Verify existing hashes
 *
 * Two-pass build process:
 *   1. First pass: Compile binary with placeholder hash
 *   2. Compute hash of compiled binary
 *   3. Second pass: Recompile with actual hash embedded
 *
 * @example
 * // In CI/CD pipeline:
 * import { embedHashForCI } from './embed-hash.js';
 * await embedHashForCI('darwin-arm64');
 *
 * @module scripts/embed-hash
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// Constants
// ============================================================================

const ROOT_DIR = join(import.meta.dirname, "..");
const DIST_BIN_DIR = join(ROOT_DIR, "dist/bin");
const INTEGRITY_HASH_FILE = join(ROOT_DIR, "src/license/guards/integrity-hash.generated.ts");

/**
 * Supported platforms for binary compilation.
 */
export const SUPPORTED_PLATFORMS = [
  "darwin-arm64",
  "darwin-x64",
  "linux-arm64",
  "linux-x64",
  "windows-x64",
] as const;

export type Platform = (typeof SUPPORTED_PLATFORMS)[number];

/**
 * Placeholder string that gets replaced with actual hash at build time.
 */
const HASH_PLACEHOLDER = "__BINARY_HASH_PLACEHOLDER__";

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Custom error class for embed-hash operations.
 */
export class EmbedHashError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "EmbedHashError";
    this.code = code;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EmbedHashError);
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the output filename for a platform.
 *
 * @param platform - Target platform
 * @returns Output filename
 *
 * @example
 * getOutputFilename('darwin-arm64') // 'agent-foreman-darwin-arm64'
 * getOutputFilename('windows-x64')  // 'agent-foreman-windows-x64.exe'
 */
export function getOutputFilename(platform: string): string {
  const baseName = "agent-foreman";
  if (platform.startsWith("windows")) {
    return `${baseName}-${platform}.exe`;
  }
  return `${baseName}-${platform}`;
}

/**
 * Check if running in development mode.
 * Development mode is detected when running from source (not compiled binary).
 *
 * @returns True if in development mode
 */
export function isDevelopmentMode(): boolean {
  // If we're running via tsx/bun/node from source, we're in development
  return (
    process.env.NODE_ENV !== "production" &&
    !process.argv[0]?.includes("agent-foreman")
  );
}

/**
 * Get a warning message for development mode.
 *
 * @returns Warning message
 */
export function getDevelopmentModeWarning(): string {
  return "Running in development mode - hash verification will be skipped.";
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Compute SHA-256 hash of a binary file.
 *
 * @param binaryPath - Path to the binary file
 * @returns SHA-256 hash as hex string
 * @throws {EmbedHashError} If file not found or read error
 *
 * @example
 * const hash = await computeHash('dist/bin/agent-foreman-darwin-arm64');
 * console.log(hash); // '64-character hex string'
 */
export async function computeHash(binaryPath: string): Promise<string> {
  if (!existsSync(binaryPath)) {
    throw new EmbedHashError(
      `Binary file not found: ${binaryPath}`,
      "ENOENT"
    );
  }

  try {
    const content = readFileSync(binaryPath);
    const hash = createHash("sha256").update(content).digest("hex");
    return hash;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new EmbedHashError(`Failed to compute hash: ${message}`, "HASH_ERROR");
  }
}

/**
 * Replace the hash placeholder in a source file with the actual hash.
 *
 * @param sourcePath - Path to the source file
 * @param hash - Hash value to embed
 * @returns True if replacement was made, false if placeholder not found
 *
 * @example
 * const replaced = await replaceHashInSource(
 *   'src/license/guards/integrity.ts',
 *   'abc123...'
 * );
 */
export async function replaceHashInSource(
  sourcePath: string,
  hash: string
): Promise<boolean> {
  if (!existsSync(sourcePath)) {
    throw new EmbedHashError(
      `Source file not found: ${sourcePath}`,
      "ENOENT"
    );
  }

  const content = readFileSync(sourcePath, "utf-8");

  // Check if placeholder exists
  if (!content.includes(HASH_PLACEHOLDER)) {
    return false;
  }

  // Replace placeholder with actual hash
  const updatedContent = content.replace(HASH_PLACEHOLDER, hash);

  writeFileSync(sourcePath, updatedContent, "utf-8");
  return true;
}

/**
 * Restore the hash placeholder in a source file.
 * Used to reset after embedding for clean builds.
 *
 * @param sourcePath - Path to the source file
 * @param hash - Hash value to replace with placeholder
 * @returns True if restoration was made
 */
export async function restoreHashPlaceholder(
  sourcePath: string,
  hash: string
): Promise<boolean> {
  if (!existsSync(sourcePath)) {
    return false;
  }

  const content = readFileSync(sourcePath, "utf-8");

  if (!content.includes(hash)) {
    return false;
  }

  const updatedContent = content.replace(hash, HASH_PLACEHOLDER);
  writeFileSync(sourcePath, updatedContent, "utf-8");
  return true;
}

/**
 * Embed hash for a specific platform binary.
 * This is the main function for embedding hashes.
 *
 * @param platform - Target platform
 * @returns Computed hash
 * @throws {EmbedHashError} If binary not found or embedding fails
 */
export async function embedHashForPlatform(platform: string): Promise<string> {
  const outputFilename = getOutputFilename(platform);
  const binaryPath = join(DIST_BIN_DIR, outputFilename);

  console.log(`\nEmbedding hash for ${platform}...`);
  console.log(`  Binary: ${binaryPath}`);

  const hash = await computeHash(binaryPath);
  console.log(`  Hash: ${hash.substring(0, 16)}...`);

  const replaced = await replaceHashInSource(INTEGRITY_HASH_FILE, hash);
  if (replaced) {
    console.log(`  ✓ Hash embedded in ${INTEGRITY_HASH_FILE}`);
  } else {
    console.log(`  ⚠ Placeholder not found (hash may already be embedded)`);
  }

  return hash;
}

/**
 * CI/CD integration function for embedding hashes.
 * Designed to be called from CI pipelines.
 *
 * @param platform - Target platform (optional, embeds all if not specified)
 * @returns Map of platform to hash
 *
 * @example
 * // In GitHub Actions:
 * const hashes = await embedHashForCI('darwin-arm64');
 */
export async function embedHashForCI(
  platform?: string
): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();

  const platforms = platform
    ? [platform]
    : SUPPORTED_PLATFORMS;

  for (const p of platforms) {
    try {
      const hash = await embedHashForPlatform(p);
      hashes.set(p, hash);
    } catch (error) {
      if (error instanceof EmbedHashError && error.code === "ENOENT") {
        console.log(`  ⚠ Skipping ${p} (binary not found)`);
      } else {
        throw error;
      }
    }
  }

  return hashes;
}

/**
 * Verify that embedded hashes match compiled binaries.
 *
 * @returns True if all hashes match
 */
export async function verifyHashes(): Promise<boolean> {
  console.log("\n=== Verifying Binary Hashes ===");

  let allValid = true;

  for (const platform of SUPPORTED_PLATFORMS) {
    const outputFilename = getOutputFilename(platform);
    const binaryPath = join(DIST_BIN_DIR, outputFilename);

    if (!existsSync(binaryPath)) {
      console.log(`  ⚠ ${platform}: Binary not found (skipped)`);
      continue;
    }

    try {
      const hash = await computeHash(binaryPath);
      console.log(`  ✓ ${platform}: ${hash.substring(0, 16)}...`);
    } catch (error) {
      console.log(`  ✗ ${platform}: Error computing hash`);
      allValid = false;
    }
  }

  return allValid;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

/**
 * Parse command line arguments.
 */
function parseArgs(): { target?: string; verify: boolean } {
  const args = process.argv.slice(2);
  let target: string | undefined;
  let verify = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--target" && args[i + 1]) {
      target = args[i + 1];
      i++;
    } else if (args[i] === "--verify") {
      verify = true;
    }
  }

  return { target, verify };
}

/**
 * Main entry point for CLI execution.
 */
async function main(): Promise<void> {
  console.log("=== Binary Hash Embedding ===");

  const { target, verify } = parseArgs();

  if (isDevelopmentMode()) {
    console.log(`\n⚠ ${getDevelopmentModeWarning()}`);
  }

  if (verify) {
    const valid = await verifyHashes();
    if (!valid) {
      process.exit(1);
    }
    return;
  }

  try {
    const hashes = await embedHashForCI(target);

    console.log("\n=== Summary ===");
    console.log(`Processed ${hashes.size} platform(s)`);

    for (const [platform, hash] of hashes) {
      console.log(`  ${platform}: ${hash.substring(0, 16)}...`);
    }
  } catch (error) {
    console.error(
      `\n✗ Error: ${error instanceof Error ? error.message : error}`
    );
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
