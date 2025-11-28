#!/usr/bin/env node
/**
 * agent-foreman CLI
 * Long Task Harness for AI agents
 */
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { aiScanProject, aiResultToSurvey, generateAISurveyMarkdown, generateFeaturesFromSurvey } from "./ai-scanner.js";
import { printAgentStatus } from "./agents.js";
import { scanDirectoryStructure } from "./project-scanner.js";
import {
  loadFeatureList,
  saveFeatureList,
  selectNextFeature,
  findFeatureById,
  updateFeatureStatus,
  mergeFeatures,
  createEmptyFeatureList,
  discoveredToFeature,
  getFeatureStats,
  getCompletionPercentage,
} from "./feature-list.js";
import {
  appendProgressLog,
  readProgressLog,
  createInitEntry,
  createStepEntry,
  getRecentEntries,
} from "./progress-log.js";
import { generateInitScript, generateMinimalInitScript } from "./init-script.js";
import { generateClaudeMd, generateFeatureGuidance } from "./prompts.js";
import type { InitMode, Feature } from "./types.js";

/**
 * Auto-detect project goal from README or package.json
 */
async function detectProjectGoal(cwd: string): Promise<string> {
  // Try package.json description first
  try {
    const pkgPath = path.join(cwd, "package.json");
    const pkgContent = await fs.readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(pkgContent);
    if (pkg.description && pkg.description.length > 10) {
      console.log(chalk.gray(`  Auto-detected goal from package.json`));
      return pkg.description;
    }
  } catch {
    // No package.json or no description
  }

  // Try README first line (usually project title/description)
  try {
    const readmeNames = ["README.md", "README", "readme.md", "Readme.md"];
    for (const name of readmeNames) {
      try {
        const readmePath = path.join(cwd, name);
        const content = await fs.readFile(readmePath, "utf-8");
        const lines = content.split("\n").filter((l) => l.trim());
        // Skip markdown headers, get first meaningful line
        for (const line of lines.slice(0, 5)) {
          const clean = line.replace(/^#+\s*/, "").trim();
          if (clean.length > 10 && !clean.startsWith("!") && !clean.startsWith("[")) {
            console.log(chalk.gray(`  Auto-detected goal from ${name}`));
            return clean;
          }
        }
      } catch {
        // Try next README variant
      }
    }
  } catch {
    // No README found
  }

  // Fallback: use directory name
  const dirName = path.basename(cwd);
  console.log(chalk.yellow(`  No description found, using directory name: ${dirName}`));
  return `Development of ${dirName}`;
}

async function main() {
  await yargs(hideBin(process.argv))
    .scriptName("agent-foreman")
    .usage("$0 <command> [options]")
    .command(
      "survey [output]",
      "Generate AI-powered project survey report",
      (yargs) =>
        yargs
          .positional("output", {
            describe: "Output path for survey markdown",
            type: "string",
            default: "docs/PROJECT_SURVEY.md",
          })
          .option("verbose", {
            alias: "v",
            type: "boolean",
            default: false,
            describe: "Show detailed output",
          }),
      async (argv) => {
        await runSurvey(argv.output, argv.verbose);
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
      "step [feature_id]",
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
          }),
      async (argv) => {
        await runStep(argv.feature_id, argv.dryRun);
      }
    )
    .command(
      "status",
      "Show current harness status",
      {},
      async () => {
        await runStatus();
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
      "complete <feature_id>",
      "Mark a feature as complete",
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
          }),
      async (argv) => {
        await runComplete(argv.feature_id!, argv.notes);
      }
    )
    .command(
      "agents",
      "Show available AI agents status",
      {},
      async () => {
        printAgentStatus();
      }
    )
    .demandCommand(1, "You need at least one command")
    .help()
    .version()
    .parseAsync();
}

// ============================================================================
// Command Implementations
// ============================================================================

async function runSurvey(outputPath: string, verbose: boolean) {
  const cwd = process.cwd();

  console.log(chalk.blue("🤖 AI-powered project scan (priority: Gemini > Codex > Claude)"));
  if (verbose) {
    printAgentStatus();
  }

  const aiResult = await aiScanProject(cwd, { verbose });

  if (!aiResult.success) {
    console.log(chalk.red(`✗ AI analysis failed: ${aiResult.error}`));
    console.log(chalk.yellow("  Make sure gemini, codex, or claude CLI is installed"));
    process.exit(1);
  }

  console.log(chalk.green(`✓ AI analysis successful (agent: ${aiResult.agentUsed})`));

  const structure = await scanDirectoryStructure(cwd);
  const survey = aiResultToSurvey(aiResult, structure);
  const markdown = generateAISurveyMarkdown(survey, aiResult);
  const fullPath = path.join(cwd, outputPath);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, markdown);

  console.log(chalk.green(`✓ Survey written to ${outputPath}`));
  console.log(chalk.gray(`  Tech stack: ${survey.techStack.language}/${survey.techStack.framework}`));
  console.log(chalk.gray(`  Modules: ${survey.modules.length}`));
  console.log(chalk.gray(`  Features: ${survey.features.length}`));
  console.log(chalk.gray(`  Completion: ${survey.completion.overall}%`));

  if (aiResult.summary) {
    console.log(chalk.cyan("\n📝 Summary:"));
    console.log(chalk.white(`  ${aiResult.summary}`));
  }

  if (aiResult.recommendations && aiResult.recommendations.length > 0) {
    console.log(chalk.cyan("\n💡 Recommendations:"));
    aiResult.recommendations.forEach((rec, i) => {
      console.log(chalk.white(`  ${i + 1}. ${rec}`));
    });
  }
}

async function runInit(goal: string, mode: InitMode, verbose: boolean) {
  const cwd = process.cwd();
  console.log(chalk.blue(`🚀 Initializing harness (mode: ${mode})...`));

  // Step 1: Try to use existing PROJECT_SURVEY.md, otherwise do full scan
  const surveyPath = path.join(cwd, "docs/PROJECT_SURVEY.md");
  let aiResult;

  try {
    const surveyContent = await fs.readFile(surveyPath, "utf-8");
    console.log(chalk.green(`✓ Found PROJECT_SURVEY.md`));

    // Use survey + goal to generate features
    aiResult = await generateFeaturesFromSurvey(surveyContent, goal);
  } catch {
    // No survey file, do full AI scan
    console.log(chalk.gray("  No PROJECT_SURVEY.md found, running full AI scan..."));
    if (verbose) {
      printAgentStatus();
    }

    aiResult = await aiScanProject(cwd, { verbose });
  }

  if (!aiResult.success) {
    console.log(chalk.red(`✗ AI analysis failed: ${aiResult.error}`));
    console.log(chalk.yellow("  Make sure gemini, codex, or claude CLI is installed"));
    process.exit(1);
  }

  console.log(chalk.green(`✓ AI analysis successful (agent: ${aiResult.agentUsed})`));

  const structure = await scanDirectoryStructure(cwd);
  const survey = aiResultToSurvey(aiResult, structure);

  if (verbose) {
    console.log(chalk.gray(`  Found ${survey.features.length} features`));
  }

  // Step 2: Load existing feature list or create new
  let featureList = await loadFeatureList(cwd);

  if (mode === "new" || !featureList) {
    featureList = createEmptyFeatureList(goal);
  } else {
    // Update goal if provided
    featureList.metadata.projectGoal = goal;
  }

  // Step 3: Convert discovered features to Feature objects
  const discoveredFeatures: Feature[] = survey.features.map((df, idx) =>
    discoveredToFeature(df, idx)
  );

  // Step 4: Merge or replace based on mode
  if (mode === "merge") {
    const beforeCount = featureList.features.length;
    featureList.features = mergeFeatures(featureList.features, discoveredFeatures);
    const addedCount = featureList.features.length - beforeCount;
    if (verbose && addedCount > 0) {
      console.log(chalk.gray(`  Added ${addedCount} new features`));
    }
  } else if (mode === "new") {
    featureList.features = discoveredFeatures;
  }
  // mode === "scan" doesn't modify the list

  // Step 5: Save feature list
  if (mode !== "scan") {
    await saveFeatureList(cwd, featureList);
    console.log(chalk.green(`✓ Feature list saved with ${featureList.features.length} features`));
  } else {
    console.log(chalk.yellow(`ℹ Scan mode: ${discoveredFeatures.length} features discovered (not saved)`));
  }

  // Step 6: Generate init.sh
  const initScript =
    survey.commands.install || survey.commands.dev || survey.commands.test
      ? generateInitScript(survey.commands)
      : generateMinimalInitScript();

  await fs.mkdir(path.join(cwd, "ai"), { recursive: true });
  await fs.writeFile(path.join(cwd, "ai/init.sh"), initScript);
  await fs.chmod(path.join(cwd, "ai/init.sh"), 0o755);
  console.log(chalk.green("✓ Generated ai/init.sh"));

  // Step 7: Generate CLAUDE.md
  const claudeMd = generateClaudeMd(goal);
  await fs.writeFile(path.join(cwd, "CLAUDE.md"), claudeMd);
  console.log(chalk.green("✓ Generated CLAUDE.md"));

  // Step 8: Write progress log entry
  if (mode !== "scan") {
    await appendProgressLog(
      cwd,
      createInitEntry(goal, `mode=${mode}, features=${featureList.features.length}`)
    );
    console.log(chalk.green("✓ Updated ai/progress.log"));
  }

  console.log(chalk.bold.green("\n🎉 Harness initialized successfully!"));
  console.log(chalk.gray("Next: Run 'agent-foreman step' to start working on features"));
}

async function runStep(featureId: string | undefined, dryRun: boolean) {
  const cwd = process.cwd();

  const featureList = await loadFeatureList(cwd);
  if (!featureList) {
    console.log(chalk.red("✗ No feature list found. Run 'agent-foreman init <goal>' first."));
    process.exit(1);
  }

  let feature: Feature | undefined;

  if (featureId) {
    feature = findFeatureById(featureList.features, featureId);
    if (!feature) {
      console.log(chalk.red(`✗ Feature '${featureId}' not found.`));
      process.exit(1);
    }
  } else {
    feature = selectNextFeature(featureList.features) ?? undefined;
    if (!feature) {
      console.log(chalk.green("🎉 All features are passing or blocked. Nothing to do!"));
      return;
    }
  }

  // Display feature details
  console.log("");
  console.log(chalk.bold.blue(`📋 Selected Feature: ${feature.id}`));
  console.log(chalk.gray(`   Module: ${feature.module}`));
  console.log(chalk.gray(`   Priority: ${feature.priority}`));
  console.log(
    chalk.gray(`   Status: `) +
      (feature.status === "passing"
        ? chalk.green(feature.status)
        : feature.status === "needs_review"
          ? chalk.yellow(feature.status)
          : chalk.red(feature.status))
  );
  console.log("");
  console.log(chalk.white(`   ${feature.description}`));
  console.log("");
  console.log(chalk.bold("   Acceptance Criteria:"));
  feature.acceptance.forEach((a, i) => {
    console.log(chalk.white(`   ${i + 1}. ${a}`));
  });

  if (feature.dependsOn.length > 0) {
    console.log("");
    console.log(chalk.yellow(`   ⚠ Depends on: ${feature.dependsOn.join(", ")}`));
  }

  if (feature.notes) {
    console.log("");
    console.log(chalk.gray(`   Notes: ${feature.notes}`));
  }

  console.log("");
  console.log(chalk.gray("   ─────────────────────────────────────────"));
  console.log(chalk.gray("   When done, run: agent-foreman complete " + feature.id));
  console.log("");

  if (dryRun) {
    console.log(chalk.yellow("   [Dry run - no changes made]"));
  }

  // Output feature guidance
  console.log(generateFeatureGuidance(feature));
}

async function runStatus() {
  const cwd = process.cwd();

  const featureList = await loadFeatureList(cwd);
  if (!featureList) {
    console.log(chalk.red("✗ No feature list found. Run 'agent-foreman init <goal>' first."));
    return;
  }

  const stats = getFeatureStats(featureList.features);
  const completion = getCompletionPercentage(featureList.features);
  const recentEntries = await getRecentEntries(cwd, 5);

  console.log("");
  console.log(chalk.bold.blue("📊 Project Status"));
  console.log(chalk.gray(`   Goal: ${featureList.metadata.projectGoal}`));
  console.log(chalk.gray(`   Last updated: ${featureList.metadata.updatedAt}`));
  console.log("");

  console.log(chalk.bold("   Feature Status:"));
  console.log(chalk.green(`   ✓ Passing: ${stats.passing}`));
  console.log(chalk.yellow(`   ⚠ Needs Review: ${stats.needs_review}`));
  console.log(chalk.red(`   ✗ Failing: ${stats.failing}`));
  console.log(chalk.gray(`   ⏸ Blocked: ${stats.blocked}`));
  console.log(chalk.gray(`   ⊘ Deprecated: ${stats.deprecated}`));
  console.log("");

  // Progress bar
  const barWidth = 30;
  const filledWidth = Math.round((completion / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;
  const progressBar = chalk.green("█".repeat(filledWidth)) + chalk.gray("░".repeat(emptyWidth));
  console.log(chalk.bold(`   Completion: [${progressBar}] ${completion}%`));
  console.log("");

  // Recent activity
  if (recentEntries.length > 0) {
    console.log(chalk.bold("   Recent Activity:"));
    for (const entry of recentEntries) {
      const typeColor =
        entry.type === "INIT"
          ? chalk.blue
          : entry.type === "STEP"
            ? chalk.green
            : entry.type === "CHANGE"
              ? chalk.yellow
              : chalk.magenta;
      console.log(
        chalk.gray(`   ${entry.timestamp.substring(0, 10)} `) +
          typeColor(`[${entry.type}]`) +
          chalk.white(` ${entry.summary}`)
      );
    }
    console.log("");
  }

  // Next feature
  const next = selectNextFeature(featureList.features);
  if (next) {
    console.log(chalk.bold("   Next Up:"));
    console.log(chalk.white(`   → ${next.id}: ${next.description}`));
    console.log("");
  }
}

async function runImpact(featureId: string) {
  const cwd = process.cwd();

  const featureList = await loadFeatureList(cwd);
  if (!featureList) {
    console.log(chalk.red("✗ No feature list found."));
    return;
  }

  const feature = findFeatureById(featureList.features, featureId);
  if (!feature) {
    console.log(chalk.red(`✗ Feature '${featureId}' not found.`));
    return;
  }

  // Find dependent features
  const dependents = featureList.features.filter((f) => f.dependsOn.includes(featureId));

  // Find same-module features
  const sameModule = featureList.features.filter(
    (f) => f.module === feature.module && f.id !== featureId && f.status !== "deprecated"
  );

  console.log("");
  console.log(chalk.bold.blue(`🔍 Impact Analysis: ${featureId}`));
  console.log("");

  if (dependents.length > 0) {
    console.log(chalk.bold.yellow("   ⚠ Directly Affected Features:"));
    for (const f of dependents) {
      console.log(chalk.yellow(`   → ${f.id} (${f.status}) - depends on this feature`));
    }
    console.log("");
  }

  if (sameModule.length > 0) {
    console.log(chalk.bold.gray("   📁 Same Module (review recommended):"));
    for (const f of sameModule.slice(0, 10)) {
      console.log(chalk.gray(`   → ${f.id} (${f.status})`));
    }
    if (sameModule.length > 10) {
      console.log(chalk.gray(`   ... and ${sameModule.length - 10} more`));
    }
    console.log("");
  }

  if (dependents.length === 0 && sameModule.length === 0) {
    console.log(chalk.green("   ✓ No other features appear to be affected"));
    console.log("");
  }

  // Recommendations
  if (dependents.length > 0) {
    console.log(chalk.bold("   Recommendations:"));
    console.log(chalk.white("   1. Review and test dependent features"));
    console.log(chalk.white("   2. Mark uncertain features as 'needs_review'"));
    console.log(chalk.white("   3. Update feature notes with impact details"));
    console.log("");
  }
}

async function runComplete(featureId: string, notes?: string) {
  const cwd = process.cwd();

  const featureList = await loadFeatureList(cwd);
  if (!featureList) {
    console.log(chalk.red("✗ No feature list found."));
    process.exit(1);
  }

  const feature = findFeatureById(featureList.features, featureId);
  if (!feature) {
    console.log(chalk.red(`✗ Feature '${featureId}' not found.`));
    process.exit(1);
  }

  // Update status
  featureList.features = updateFeatureStatus(
    featureList.features,
    featureId,
    "passing",
    notes || feature.notes
  );

  // Save
  await saveFeatureList(cwd, featureList);

  // Log progress
  await appendProgressLog(
    cwd,
    createStepEntry(featureId, "passing", "./ai/init.sh check", `Completed ${featureId}`)
  );

  console.log(chalk.green(`✓ Marked '${featureId}' as passing`));

  // Show next feature
  const next = selectNextFeature(featureList.features);
  if (next) {
    console.log(chalk.gray(`  Next up: ${next.id}`));
  } else {
    console.log(chalk.green("  🎉 All features are now passing!"));
  }
}

// Run CLI
main().catch((err) => {
  console.error(chalk.red(err.message));
  process.exit(1);
});
