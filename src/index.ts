#!/usr/bin/env node
/**
 * agent-foreman CLI
 * Long Task Harness for AI agents
 *
 * This is the main entry point. All command logic is in src/commands/.
 */
import chalk from "chalk";
import { main } from "./commands/index.js";

// Run CLI
main().catch((err) => {
  console.error(chalk.red(err.message));
  process.exit(1);
});
