#!/usr/bin/env bun
/**
 * Build Script - Compile to Standalone Executables
 *
 * Uses Bun's compile feature to create standalone executables for multiple platforms.
 *
 * Usage:
 *   bun scripts/build.ts                              # Build all platforms
 *   bun scripts/build.ts --target macos               # Build all macOS (arm64 + x64)
 *   bun scripts/build.ts --target linux               # Build all Linux (arm64 + x64)
 *   bun scripts/build.ts --target windows             # Build Windows (x64)
 *   bun scripts/build.ts --target macos --arch arm64  # Build specific platform+arch
 */

import { $ } from "bun";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT_DIR = join(import.meta.dirname, "..");
const DIST_BIN_DIR = join(ROOT_DIR, "dist/bin");
const ENTRY_POINT = join(ROOT_DIR, "src/index.ts");

// Bun compile targets
// See: https://bun.sh/docs/bundler/executables#cross-compile-to-other-platforms
const TARGETS = {
  "darwin-arm64": "bun-darwin-arm64",
  "darwin-x64": "bun-darwin-x64",
  "linux-arm64": "bun-linux-arm64",
  "linux-x64": "bun-linux-x64",
  "windows-x64": "bun-windows-x64",
} as const;

type TargetKey = keyof typeof TARGETS;

const PLATFORM_GROUPS: Record<string, TargetKey[]> = {
  macos: ["darwin-arm64", "darwin-x64"],
  linux: ["linux-arm64", "linux-x64"],
  windows: ["windows-x64"],
  all: Object.keys(TARGETS) as TargetKey[],
};

/**
 * Get output filename for a target
 */
function getOutputName(target: TargetKey): string {
  const baseName = "agent-foreman";
  if (target.startsWith("windows")) {
    return `${baseName}-${target}.exe`;
  }
  return `${baseName}-${target}`;
}

/**
 * Build for a specific target
 */
async function buildTarget(target: TargetKey, version: string): Promise<boolean> {
  const bunTarget = TARGETS[target];
  const outputName = getOutputName(target);
  const outputPath = join(DIST_BIN_DIR, outputName);

  console.log(`\nBuilding for ${target}...`);
  console.log(`  Target: ${bunTarget}`);
  console.log(`  Output: ${outputPath}`);
  console.log(`  Version: ${version}`);

  try {
    // Inject version at compile time using --define
    await $`bun build ${ENTRY_POINT} --compile --target ${bunTarget} --outfile ${outputPath} --define __VERSION__='"${version}"'`.quiet();
    console.log(`  ✓ Success`);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): { targets: TargetKey[] } {
  const args = process.argv.slice(2);
  let targetGroup = "all";
  let arch: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--target" && args[i + 1]) {
      targetGroup = args[i + 1];
      i++;
    } else if (args[i] === "--arch" && args[i + 1]) {
      arch = args[i + 1];
      i++;
    }
  }

  // If both --target and --arch are specified, build specific target
  if (arch && targetGroup !== "all") {
    const platformMap: Record<string, string> = {
      macos: "darwin",
      linux: "linux",
      windows: "windows",
    };
    const platform = platformMap[targetGroup] || targetGroup;
    const specificTarget = `${platform}-${arch}` as TargetKey;

    if (!(specificTarget in TARGETS)) {
      console.error(`Unknown target: ${specificTarget}`);
      console.error(`Available targets: ${Object.keys(TARGETS).join(", ")}`);
      process.exit(1);
    }

    return { targets: [specificTarget] };
  }

  const targets = PLATFORM_GROUPS[targetGroup];
  if (!targets) {
    console.error(`Unknown target group: ${targetGroup}`);
    console.error(`Available groups: ${Object.keys(PLATFORM_GROUPS).join(", ")}`);
    console.error(`Available targets: ${Object.keys(TARGETS).join(", ")}`);
    process.exit(1);
  }

  return { targets };
}

/**
 * Generate SHA256SUMS.txt for all binaries in dist/bin
 */
function generateChecksums(): void {
  console.log("\n=== Generating SHA256SUMS.txt ===");

  const files = readdirSync(DIST_BIN_DIR).filter(
    (f) => f.startsWith("agent-foreman-") && !f.endsWith(".txt")
  );

  if (files.length === 0) {
    console.log("No binary files found, skipping checksum generation");
    return;
  }

  const checksums: string[] = [];

  for (const file of files.sort()) {
    const filePath = join(DIST_BIN_DIR, file);
    const content = readFileSync(filePath);
    const hash = createHash("sha256").update(content).digest("hex");
    checksums.push(`${hash}  ${file}`);
    console.log(`  ${file}: ${hash.substring(0, 16)}...`);
  }

  const checksumsPath = join(DIST_BIN_DIR, "SHA256SUMS.txt");
  writeFileSync(checksumsPath, checksums.join("\n") + "\n");
  console.log(`\n✓ SHA256SUMS.txt generated with ${files.length} entries`);
}

/**
 * Check prerequisites and return version
 */
function checkPrerequisites(): string {
  // Check if embedded assets exist (current project uses single file)
  const embeddedAssets = join(ROOT_DIR, "src/embedded-assets.generated.ts");

  if (!existsSync(embeddedAssets)) {
    console.error("Error: Embedded assets not found.");
    console.error("Run 'npm run build:embed' first.");
    process.exit(1);
  }

  // Read version
  const packageJson = JSON.parse(readFileSync(join(ROOT_DIR, "package.json"), "utf-8"));
  const version = packageJson.version;
  console.log(`Building agent-foreman v${version}`);
  return version;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log("=== Building Standalone Executables ===");

  const version = checkPrerequisites();

  const { targets } = parseArgs();
  console.log(`\nTargets: ${targets.join(", ")}`);

  // Ensure output directory exists
  if (!existsSync(DIST_BIN_DIR)) {
    mkdirSync(DIST_BIN_DIR, { recursive: true });
  }

  // Build each target
  const results: { target: TargetKey; success: boolean }[] = [];

  for (const target of targets) {
    const success = await buildTarget(target, version);
    results.push({ target, success });
  }

  // Summary
  console.log("\n=== Build Summary ===");
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  if (successful.length > 0) {
    console.log(`\n✓ Successful (${successful.length}):`);
    for (const { target } of successful) {
      console.log(`  - ${getOutputName(target)}`);
    }
  }

  if (failed.length > 0) {
    console.log(`\n✗ Failed (${failed.length}):`);
    for (const { target } of failed) {
      console.log(`  - ${target}`);
    }
    process.exit(1);
  }

  // Generate SHA256SUMS.txt for all binaries
  generateChecksums();

  console.log(`\nOutput directory: ${DIST_BIN_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
