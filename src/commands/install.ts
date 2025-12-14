/**
 * Install Command
 *
 * Install the agent-foreman Claude Code plugin:
 * 1. Register marketplace in known_marketplaces.json
 * 2. Install plugin files to cache
 * 3. Enable plugin in settings.json
 */

import chalk from "chalk";
import {
  fullInstall,
  hasEmbeddedPlugins,
  getPluginInstallInfo,
} from "../plugin-installer.js";
import { updateProjectRulesIfExists } from "../rules/index.js";

export async function runInstall(force: boolean = false): Promise<void> {
  const info = getPluginInstallInfo();

  console.log(chalk.cyan("Agent Foreman Plugin Installer"));
  console.log(chalk.gray("─".repeat(40)));
  console.log();

  // Show current state
  console.log(chalk.white("Plugin Status:"));
  console.log(`  Version:     ${chalk.cyan(info.bundledVersion)}`);
  console.log(`  Marketplace: ${info.isMarketplaceRegistered ? chalk.green("✓ registered") : chalk.gray("not registered")}`);
  console.log(`  Plugin:      ${info.isPluginInstalled ? chalk.green(`✓ installed (${info.installedVersion})`) : chalk.gray("not installed")}`);
  console.log(`  Enabled:     ${info.isPluginEnabled ? chalk.green("✓ yes") : chalk.gray("no")}`);
  console.log();

  // Check if embedded plugins are available
  if (!hasEmbeddedPlugins()) {
    console.log(chalk.yellow("⚠ Running in development mode (no embedded plugins)"));
    console.log(chalk.gray("  Plugins are loaded directly from source in development."));
    console.log();
    console.log(chalk.white("To build with embedded plugins:"));
    console.log(chalk.cyan("  npm run build        # Build npm package"));
    console.log(chalk.cyan("  npm run build:bin    # Build standalone binary"));
    console.log();
    console.log(chalk.white("Or install from GitHub:"));
    console.log(chalk.cyan("  /plugin marketplace add mylukin/agent-foreman"));
    console.log(chalk.cyan("  /plugin install agent-foreman"));
    console.log();
    return;
  }

  // Check if already fully installed
  if (!force && info.isMarketplaceRegistered && info.isPluginInstalled && info.isPluginEnabled) {
    console.log(chalk.green("✓ Plugin is already installed and enabled"));
    console.log(chalk.gray("  Use --force to reinstall"));
    console.log();
    console.log(chalk.white("To manage the plugin:"));
    console.log(chalk.gray("  /plugin                    # Browse plugins"));
    console.log(chalk.gray("  agent-foreman uninstall    # Remove plugin"));
    return;
  }

  // Perform installation
  console.log(chalk.cyan("Installing plugin..."));
  console.log();

  try {
    fullInstall();

    console.log(chalk.green("✓ Plugin installed successfully!"));
    console.log();
    console.log(chalk.white("Steps completed:"));
    console.log(chalk.gray("  1. Installed marketplace files"));
    console.log(chalk.gray("  2. Registered in known_marketplaces.json"));
    console.log(chalk.gray("  3. Installed plugin to cache"));
    console.log(chalk.gray("  4. Enabled in settings.json"));

    // Step 5: Auto-update project rules if they exist
    const cwd = process.cwd();
    const rulesResult = await updateProjectRulesIfExists(cwd);
    if (rulesResult) {
      console.log(chalk.gray(`  5. Updated ${rulesResult.created} rule file(s) in .claude/rules/`));
    }

    console.log();
    console.log(chalk.yellow("⚡ Restart Claude Code to use the plugin"));
  } catch (error) {
    console.error(chalk.red(`✗ Failed to install plugin: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}
