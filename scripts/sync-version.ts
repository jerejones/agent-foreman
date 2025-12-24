#!/usr/bin/env tsx
/**
 * Version sync script for automated releases
 *
 * This script syncs the version from package.json to:
 * - .claude-plugin/marketplace.json (metadata.version + plugins[0].version)
 * - plugins/agent-foreman/.claude-plugin/plugin.json (version)
 *
 * Usage:
 *   npx tsx scripts/sync-version.ts           # Sync version from package.json
 *   npx tsx scripts/sync-version.ts --version 1.0.0  # Override with specific version
 *
 * This script is automatically triggered by the npm version lifecycle hook.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

interface MarketplaceJson {
  metadata: {
    version: string;
    [key: string]: unknown;
  };
  plugins: Array<{
    version: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

interface PluginJson {
  version: string;
  [key: string]: unknown;
}

/**
 * Read version from package.json
 */
function readPackageVersion(): string {
  const packageJsonPath = path.join(ROOT_DIR, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  return packageJson.version;
}

/**
 * Parse CLI arguments to extract version override
 */
function parseCliArgs(args: string[]): { version?: string } {
  const versionIndex = args.indexOf("--version");
  if (versionIndex !== -1 && args[versionIndex + 1]) {
    return { version: args[versionIndex + 1] };
  }
  return {};
}

/**
 * Update marketplace.json with new version
 */
function updateMarketplaceJson(version: string): void {
  const marketplacePath = path.join(ROOT_DIR, ".claude-plugin/marketplace.json");

  const marketplace: MarketplaceJson = JSON.parse(fs.readFileSync(marketplacePath, "utf-8"));

  marketplace.metadata.version = version;
  if (marketplace.plugins && marketplace.plugins.length > 0) {
    marketplace.plugins[0].version = version;
  }

  fs.writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 2) + "\n");
  console.log(`✓ Updated .claude-plugin/marketplace.json → ${version}`);
}

/**
 * Update plugin.json with new version
 */
function updatePluginJson(version: string): void {
  const pluginPath = path.join(ROOT_DIR, "plugins/agent-foreman/.claude-plugin/plugin.json");

  const plugin: PluginJson = JSON.parse(fs.readFileSync(pluginPath, "utf-8"));
  plugin.version = version;

  fs.writeFileSync(pluginPath, JSON.stringify(plugin, null, 2) + "\n");
  console.log(`✓ Updated plugins/agent-foreman/.claude-plugin/plugin.json → ${version}`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log("🔄 Syncing version across files...\n");

  // Parse CLI args for version override
  const cliArgs = parseCliArgs(process.argv.slice(2));

  // Determine target version
  const version = cliArgs.version || readPackageVersion();
  console.log(`📦 Target version: ${version}`);

  // Update all version files
  updateMarketplaceJson(version);
  updatePluginJson(version);

  console.log("\n✅ Version sync complete!");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
