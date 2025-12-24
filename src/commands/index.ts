#!/usr/bin/env node
/**
 * agent-foreman CLI
 * Long Task Harness for AI agents
 *
 * This module provides the main CLI entry point with yargs configuration.
 * Individual commands are implemented in separate modules.
 */
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { getCurrentVersion } from "../version.js";
import { checkAndInstallPlugins } from "../plugin-installer.js";
import {
  registerInitCommand,
  registerNextCommand,
  registerStatusCommand,
  registerImpactCommand,
  registerDoneCommand,
  registerFailCommand,
  registerTDDCommand,
  registerCheckCommand,
  registerUtilityCommands,
  registerInstallCommand,
  registerUninstallCommand,
} from "./cli-commands.js";

/**
 * Main CLI entry point
 */
export async function main(): Promise<void> {
  // Ensure Claude Code plugins are installed
  await checkAndInstallPlugins();

  let cli = yargs(hideBin(process.argv))
    .scriptName("agent-foreman")
    .usage("$0 <command> [options]\n\nNote: Tasks and features are used interchangeably in this CLI.");

  // Register all commands
  cli = registerInitCommand(cli);
  cli = registerNextCommand(cli);
  cli = registerStatusCommand(cli);
  cli = registerImpactCommand(cli);
  cli = registerDoneCommand(cli);
  cli = registerFailCommand(cli);
  cli = registerTDDCommand(cli);
  cli = registerCheckCommand(cli);
  cli = registerInstallCommand(cli);
  cli = registerUninstallCommand(cli);
  cli = registerUtilityCommands(cli);

  // Add examples and finalize
  await cli
    .example("$0 next", "Show next task/feature to work on")
    .example("$0 next auth.login", "Show details for specific task/feature")
    .example("$0 done auth.login", "Mark task/feature as complete")
    .example("$0 status", "Show project task/feature progress")
    .example("$0 check auth.login", "Verify task/feature implementation")
    .example("$0 fail auth.login -r 'Tests timeout'", "Mark task as failed")
    .example("$0 tdd strict", "Enable strict TDD mode")
    .demandCommand(1, "You need at least one command")
    .help()
    .version(getCurrentVersion())
    .parseAsync();
}

// Re-export command functions for programmatic use
export { runInit } from "./init.js";
export { runNext } from "./next.js";
export { runStatus } from "./status.js";
export { runImpact } from "./impact.js";
export { runCheck } from "./check.js";
export { runDone } from "./done.js";
export { runFail } from "./fail.js";
export { runTDD } from "./tdd.js";
export { runInstall } from "./install.js";
export { runUninstall } from "./uninstall.js";
// runMigrate is internal only - auto-executed when loading features
export { detectProjectGoal, promptConfirmation } from "./utils.js";
