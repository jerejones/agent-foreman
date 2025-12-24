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
import { copyRulesToProject, hasRulesInstalled } from "../rules/index.js";

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
    console.log(chalk.yellow("⚠ No embedded plugins available"));
    console.log(chalk.gray("  Plugin install requires embedded plugins from a build process."));
    console.log(chalk.gray("  For development, plugins are loaded directly from source."));
    console.log();
    console.log(chalk.white("To build with embedded plugins:"));
    console.log(chalk.cyan("  npm run build          # Build npm package with plugins"));
    console.log(chalk.cyan("  npm run build:bin      # Build standalone binary with plugins"));
    console.log();
    console.log(chalk.white("Or install from GitHub:"));
    console.log(chalk.cyan("  /plugin marketplace add mylukin/agent-foreman"));
    console.log(chalk.cyan("  /plugin install agent-foreman:agent-foreman"));
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

    // Step 5: Update project rules if they exist or force mode is enabled
    await updateProjectRules(force);

    console.log();
    console.log(chalk.yellow("⚡ Restart Claude Code to use the plugin"));
  } catch (error) {
    console.error(chalk.red(`✗ Failed to install plugin: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}

/**
 * Update project-level .claude/rules/ directory
 * Only updates if rules already exist (initialized project) or force mode is enabled
 */
async function updateProjectRules(force: boolean): Promise<void> {
  const cwd = process.cwd();
  const rulesExist = hasRulesInstalled(cwd);

  // Skip if no existing rules and not forcing
  if (!rulesExist && !force) {
    return;
  }

  console.log();
  if (rulesExist) {
    console.log(chalk.cyan("Updating project rules..."));
  } else {
    console.log(chalk.cyan("Installing project rules..."));
  }

  try {
    const result = await copyRulesToProject(cwd, { force: true });

    if (result.created > 0) {
      console.log(chalk.green(`  5. Updated ${result.created} rule files in .claude/rules/`));
    }
  } catch (error) {
    console.warn(chalk.yellow(`  ⚠ Failed to update project rules: ${error instanceof Error ? error.message : error}`));
  }
}
