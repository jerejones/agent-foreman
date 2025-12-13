#!/usr/bin/env node
/**
 * agent-foreman CLI
 * Long Task Harness for AI agents
 *
 * This file sets up the CLI using yargs and delegates to command handlers
 * in src/commands/ directory.
 */
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { InitMode } from "./types.js";
import { getCurrentVersion } from "./upgrade.js";
import { interactiveUpgradeCheck } from "./upgrade.js";
import { checkAndInstallPlugins } from "./plugin-installer.js";
import {
  runAnalyze,
  runInit,
  runNext,
  runStatus,
  runImpact,
  runCheck,
  runDone,
  runScan,
  runAgents,
  runInstall,
  runUninstall,
  runFail,
  runTDD,
  detectProjectGoal,
} from "./commands/index.js";

async function main() {
  // Run interactive upgrade check (prompts user if new version available)
  await interactiveUpgradeCheck();

  // Check and install/update plugins (for compiled binary)
  await checkAndInstallPlugins();

  await yargs(hideBin(process.argv))
    .scriptName("agent-foreman")
    .usage("$0 <command> [options]")
    .command(
      "analyze [output]",
      "Generate AI-powered project analysis report",
      (yargs) =>
        yargs
          .positional("output", {
            describe: "Output path for survey markdown",
            type: "string",
            default: "docs/ARCHITECTURE.md",
          })
          .option("verbose", {
            alias: "v",
            type: "boolean",
            default: false,
            describe: "Show detailed output",
          }),
      async (argv) => {
        await runAnalyze(argv.output, argv.verbose);
      }
    )
    .command(
      "init [goal]",
      "Initialize or upgrade the long-task harness",
      (yargs) =>
        yargs
          .positional("goal", {
            describe: "Project goal description (auto-detected if not provided)",
            type: "string",
          })
          .option("mode", {
            alias: "m",
            describe: "Init mode: merge, new, or scan",
            type: "string",
            default: "merge",
            choices: ["merge", "new", "scan"] as const,
          })
          .option("verbose", {
            alias: "v",
            type: "boolean",
            default: false,
          }),
      async (argv) => {
        const goal = argv.goal || (await detectProjectGoal(process.cwd()));
        await runInit(goal, argv.mode as InitMode, argv.verbose);
      }
    )
    .command(
      "next [feature_id]",
      "Show next feature to work on or specific feature details",
      (yargs) =>
        yargs
          .positional("feature_id", {
            describe: "Specific feature ID to work on",
            type: "string",
          })
          .option("dry-run", {
            alias: "d",
            type: "boolean",
            default: false,
            describe: "Show plan without making changes",
          })
          .option("check", {
            alias: "c",
            type: "boolean",
            default: false,
            describe: "Run basic tests before showing next task",
          })
          .option("allow-dirty", {
            type: "boolean",
            default: false,
            describe: "Allow running with uncommitted changes",
          })
          .option("json", {
            type: "boolean",
            default: false,
            describe: "Output as JSON for scripting",
          })
          .option("quiet", {
            alias: "q",
            type: "boolean",
            default: false,
            describe: "Suppress decorative output",
          })
          .option("refresh-guidance", {
            type: "boolean",
            default: false,
            describe: "Force regenerate TDD guidance (ignore cache)",
          }),
      async (argv) => {
        await runNext(argv.feature_id, argv.dryRun, argv.check, argv.allowDirty, argv.json, argv.quiet, argv.refreshGuidance);
      }
    )
    .command(
      "status",
      "Show current harness status",
      (yargs) =>
        yargs
          .option("json", {
            type: "boolean",
            default: false,
            describe: "Output as JSON for scripting",
          })
          .option("quiet", {
            alias: "q",
            type: "boolean",
            default: false,
            describe: "Suppress decorative output",
          }),
      async (argv) => {
        await runStatus(argv.json, argv.quiet);
      }
    )
    .command(
      "impact <feature_id>",
      "Analyze impact of changes to a feature",
      (yargs) =>
        yargs.positional("feature_id", {
          describe: "Feature ID to analyze",
          type: "string",
          demandOption: true,
        }),
      async (argv) => {
        await runImpact(argv.feature_id!);
      }
    )
    .command(
      "done <feature_id>",
      "Verify and mark a feature as complete",
      (yargs) =>
        yargs
          .positional("feature_id", {
            describe: "Feature ID to mark complete",
            type: "string",
            demandOption: true,
          })
          .option("notes", {
            alias: "n",
            type: "string",
            describe: "Additional notes",
          })
          .option("no-commit", {
            type: "boolean",
            default: false,
            describe: "Skip automatic git commit",
          })
          .option("skip-check", {
            type: "boolean",
            default: true,
            describe: "Skip verification (default: true, use --no-skip-check to verify)",
          })
          .option("verbose", {
            alias: "v",
            type: "boolean",
            default: false,
            describe: "Show detailed verification output",
          })
          .option("ai", {
            type: "boolean",
            default: false,
            describe: "Enable AI autonomous exploration for verification",
          })
          .option("quick", {
            alias: "q",
            type: "boolean",
            default: true,
            describe: "Run only related tests (selective test execution, default)",
          })
          .option("full", {
            type: "boolean",
            default: false,
            describe: "Force full test suite",
          })
          .option("test-pattern", {
            type: "string",
            describe: "Explicit test pattern to use (e.g., \"tests/auth/**\")",
          })
          .option("skip-e2e", {
            type: "boolean",
            default: false,
            describe: "Skip E2E tests entirely (run unit tests only)",
          })
          .option("loop", {
            type: "boolean",
            default: true,
            describe: "Enable loop mode (default: true, outputs continuation reminder for all-features workflow)",
          }),
      async (argv) => {
        // Determine test mode: --full > --quick (default)
        // Quick mode is now the default for faster iteration
        const testMode = argv.full ? "full" : "quick";
        // Determine E2E mode:
        // - --skip-e2e: skip
        // - --full (explicit): full E2E
        // - quick (default): tags (or smoke if no feature tags)
        const e2eMode = argv.skipE2e
          ? "skip"
          : argv.full
            ? "full"
            : undefined; // Quick mode: determined by tags in verifier
        await runDone(
          argv.feature_id!,
          argv.notes,
          !argv.noCommit,
          argv.skipCheck,
          argv.verbose,
          argv.ai,
          testMode,
          argv.testPattern,
          argv.skipE2e,
          e2eMode,
          argv.loop
        );
      }
    )
    .command(
      "check [feature_id]",
      "Verify code changes (fast mode) or task completion",
      (yargs) =>
        yargs
          .positional("feature_id", {
            describe: "Task/feature ID for task verification (omit for fast mode)",
            type: "string",
          })
          .option("full", {
            type: "boolean",
            default: false,
            describe: "Run full verification (all tests + build + E2E)",
          })
          .option("ai", {
            type: "boolean",
            default: false,
            describe: "Enable AI verification (autonomous exploration for tasks)",
          })
          .option("verbose", {
            alias: "v",
            type: "boolean",
            default: false,
            describe: "Show detailed output",
          })
          .option("skip-checks", {
            alias: "s",
            type: "boolean",
            default: false,
            describe: "Skip automated checks, AI only",
          })
          .option("quick", {
            type: "boolean",
            default: true,
            describe: "Run only related tests (for task mode)",
          })
          .option("test-pattern", {
            type: "string",
            describe: "Explicit test pattern to use",
          })
          .option("skip-e2e", {
            type: "boolean",
            default: false,
            describe: "Skip E2E tests entirely",
          }),
      async (argv) => {
        // Determine test mode based on flags
        const testMode = argv.full ? "full" : "quick";
        const e2eMode = argv.skipE2e ? "skip" : argv.full ? "full" : undefined;
        await runCheck(
          argv.feature_id,
          argv.verbose,
          argv.skipChecks,
          argv.ai,
          testMode,
          argv.testPattern,
          argv.skipE2e,
          e2eMode,
          argv.full
        );
      }
    )
    .command(
      "agents",
      "Show available AI agents status",
      {},
      async () => {
        await runAgents();
      }
    )
    .command(
      "scan",
      "Scan project verification capabilities",
      (yargs) =>
        yargs
          .option("force", {
            alias: "f",
            type: "boolean",
            default: false,
            describe: "Force re-scan even if cache exists",
          })
          .option("verbose", {
            alias: "v",
            type: "boolean",
            default: false,
            describe: "Show detailed scan output",
          }),
      async (argv) => {
        await runScan(argv.force, argv.verbose);
      }
    )
    .command(
      "install",
      "Install Claude Code plugin (marketplace + enable)",
      (yargs) =>
        yargs
          .option("force", {
            alias: "f",
            type: "boolean",
            default: false,
            describe: "Force reinstall even if already installed",
          }),
      async (argv) => {
        await runInstall(argv.force);
      }
    )
    .command(
      "uninstall",
      "Uninstall Claude Code plugin (remove all registrations)",
      {},
      async () => {
        await runUninstall();
      }
    )
    .command(
      "fail <feature_id>",
      "Mark a feature as failed and continue to next",
      (yargs) =>
        yargs
          .positional("feature_id", {
            describe: "Feature ID to mark as failed",
            type: "string",
            demandOption: true,
          })
          .option("reason", {
            alias: "r",
            type: "string",
            describe: "Reason for failure",
          })
          .option("no-loop", {
            type: "boolean",
            default: false,
            describe: "Disable loop continuation guidance",
          }),
      async (argv) => {
        await runFail(argv.feature_id!, argv.reason, !argv.noLoop);
      }
    )
    .command(
      "tdd [mode]",
      "View or change TDD mode (strict, recommended, disabled)",
      (yargs) =>
        yargs.positional("mode", {
          describe: "TDD mode to set (strict, recommended, disabled)",
          type: "string",
          choices: ["strict", "recommended", "disabled"],
        }),
      async (argv) => {
        await runTDD(argv.mode);
      }
    )
    .demandCommand(1, "You need at least one command")
    .help()
    .version(getCurrentVersion())
    .parseAsync();
}

// Run CLI
main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
