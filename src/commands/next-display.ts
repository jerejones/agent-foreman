/**
 * Display helpers for 'next' command
 * Handles external memory sync and TDD guidance display
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import chalk from "chalk";

import { getRecentEntries } from "../progress-log.js";
import { detectCapabilities } from "../capabilities/index.js";
import { generateTDDGuidance, type TDDGuidance } from "../tdd-guidance/index.js";
import { generateTDDGuidanceWithAI } from "../tdd-ai-generator.js";
import { saveSingleFeature } from "../storage/index.js";
import type { Feature, CachedTDDGuidance, FeatureListMetadata } from "../types/index.js";

interface DisplayStats {
  passing: number;
  failing: number;
  needs_review: number;
  failed: number;
  blocked: number;
}

/**
 * Display external memory sync section
 */
export async function displayExternalMemorySync(
  cwd: string,
  stats: DisplayStats,
  completion: number,
  runCheck: boolean
): Promise<void> {
  const { spawnSync } = await import("node:child_process");

  console.log(chalk.bold.blue("\n═══════════════════════════════════════════════════════════════"));
  console.log(chalk.bold.blue("                    EXTERNAL MEMORY SYNC"));
  console.log(chalk.bold.blue("═══════════════════════════════════════════════════════════════\n"));

  // 1. Current Directory
  console.log(chalk.bold("📁 Current Directory:"));
  console.log(chalk.white(`   ${cwd}\n`));

  // 2. Git History
  console.log(chalk.bold("📜 Recent Git Commits:"));
  const gitLog = spawnSync("git", ["log", "--oneline", "-5"], { cwd, encoding: "utf-8" });
  if (gitLog.status === 0 && gitLog.stdout.trim()) {
    gitLog.stdout.trim().split("\n").forEach((line) => {
      console.log(chalk.gray(`   ${line}`));
    });
  } else {
    console.log(chalk.yellow("   No git history found"));
  }
  console.log("");

  // 3. Progress Log
  console.log(chalk.bold("📝 Recent Progress:"));
  const recentEntries = await getRecentEntries(cwd, 5);
  if (recentEntries.length > 0) {
    for (const entry of recentEntries) {
      const typeColor =
        entry.type === "INIT" ? chalk.blue :
        entry.type === "STEP" ? chalk.green :
        entry.type === "CHANGE" ? chalk.yellow : chalk.magenta;
      console.log(
        chalk.gray(`   ${entry.timestamp.substring(0, 16)} `) +
        typeColor(`[${entry.type}]`) +
        chalk.white(` ${entry.summary}`)
      );
    }
  } else {
    console.log(chalk.yellow("   No progress entries yet"));
  }
  console.log("");

  // 4. Feature List Status
  console.log(chalk.bold("📊 Task Status:"));
  console.log(chalk.green(`   ✓ Passing: ${stats.passing}`) +
    chalk.red(` | ✗ Failing: ${stats.failing}`) +
    chalk.yellow(` | ⚠ Review: ${stats.needs_review}`) +
    chalk.magenta(` | ⚡ Failed: ${stats.failed}`) +
    chalk.gray(` | Blocked: ${stats.blocked}`));

  const barWidth = 30;
  const filledWidth = Math.round((completion / 100) * barWidth);
  const progressBar = chalk.green("█".repeat(filledWidth)) + chalk.gray("░".repeat(barWidth - filledWidth));
  console.log(chalk.white(`   Progress: [${progressBar}] ${completion}%\n`));

  // 5. Run Basic Tests (optional)
  if (runCheck) {
    console.log(chalk.bold("🧪 Running Basic Tests:"));
    const initScript = path.join(cwd, "ai/init.sh");
    try {
      await fs.access(initScript);
      const testResult = spawnSync("bash", [initScript, "check"], {
        cwd,
        encoding: "utf-8",
        timeout: 60000,
      });
      if (testResult.status === 0) {
        console.log(chalk.green("   ✓ All checks passed"));
      } else {
        console.log(chalk.red("   ✗ Some checks failed:"));
        if (testResult.stdout) {
          testResult.stdout.split("\n").slice(0, 10).forEach((line) => {
            if (line.trim()) console.log(chalk.gray(`   ${line}`));
          });
        }
        if (testResult.stderr) {
          testResult.stderr.split("\n").slice(0, 5).forEach((line) => {
            if (line.trim()) console.log(chalk.red(`   ${line}`));
          });
        }
      }
    } catch {
      console.log(chalk.yellow("   ai/init.sh not found, skipping tests"));
    }
    console.log("");
  }
}

/**
 * Display feature info section
 */
export async function displayFeatureInfo(cwd: string, feature: Feature, dryRun: boolean): Promise<void> {
  console.log(chalk.bold.blue("═══════════════════════════════════════════════════════════════"));
  console.log(chalk.bold.blue("                     NEXT TASK"));
  console.log(chalk.bold.blue("═══════════════════════════════════════════════════════════════\n"));

  console.log(chalk.bold(`📋 Task: ${chalk.cyan(feature.id)}`));
  console.log(chalk.gray(`   Module: ${feature.module} | Priority: ${feature.priority}`));
  console.log(
    chalk.gray(`   Status: `) +
      (feature.status === "passing"
        ? chalk.green(feature.status)
        : feature.status === "needs_review"
          ? chalk.yellow(feature.status)
          : chalk.red(feature.status))
  );
  // Show file path when it differs from the default (ID-based) path
  if (feature.filePath) {
    console.log(chalk.gray(`   File: ai/tasks/${feature.filePath}`));
  }
  console.log("");
  console.log(chalk.bold("   Description:"));
  console.log(chalk.white(`   ${feature.description}`));
  console.log("");
  console.log(chalk.bold("   Acceptance Criteria:"));
  const acceptance = feature.acceptance ?? [];
  if (acceptance.length > 0) {
    acceptance.forEach((a, i) => {
      console.log(chalk.white(`   ${i + 1}. ${a}`));
    });
  } else {
    console.log(chalk.gray("   (No acceptance criteria defined)"));
  }

  const dependsOn = feature.dependsOn ?? [];
  if (dependsOn.length > 0) {
    console.log("");
    console.log(chalk.yellow(`   ⚠ Depends on: ${dependsOn.join(", ")}`));
  }

  if (feature.notes) {
    console.log("");
    console.log(chalk.gray(`   Notes: ${feature.notes}`));
  }

  // Show spec context files for normal tasks only (BREAKDOWN tasks show them in their own section)
  const isBreakdown = feature.id.toUpperCase().includes(".BREAKDOWN");
  if (!isBreakdown) {
    const specDir = path.join(cwd, "ai/tasks/spec");
    try {
      const specFiles = await fs.readdir(specDir);
      const mdFiles = specFiles.filter(f => f.endsWith(".md")).sort();
      if (mdFiles.length > 0) {
        console.log("");
        console.log(chalk.bold("   Context Files:"));
        for (const fileName of mdFiles) {
          console.log(chalk.green(`   ✓ ai/tasks/spec/${fileName}`));
        }
      }
    } catch {
      // Silently skip if spec directory doesn't exist
    }
  }

  console.log("");
  console.log(chalk.bold.blue("═══════════════════════════════════════════════════════════════"));
  console.log(chalk.gray("   When done:"));
  console.log(chalk.gray("     1. Verify:   ") + chalk.cyan(`agent-foreman check ${feature.id}`));
  console.log(chalk.gray("     2. Complete: ") + chalk.cyan(`agent-foreman done ${feature.id}`));
  console.log(chalk.bold.blue("═══════════════════════════════════════════════════════════════\n"));

  if (dryRun) {
    console.log(chalk.yellow("   [Dry run - no changes made]"));
  }
}

/**
 * Check if all BREAKDOWN tasks are complete and show validation phase reminder
 * Returns true if validation phase reminder was shown
 *
 * Only shows when transitioning from breakdown to implementation phase,
 * not when implementation is already in progress.
 */
export function displayValidationPhaseReminder(
  feature: Feature,
  allFeatures: Feature[]
): boolean {
  // Only show for implementation tasks (not BREAKDOWN)
  const isBreakdown = feature.id.toUpperCase().includes(".BREAKDOWN");
  if (isBreakdown) {
    return false;
  }

  // Check if there are any BREAKDOWN tasks
  const breakdownTasks = allFeatures.filter(f =>
    f.id.toUpperCase().includes(".BREAKDOWN")
  );

  if (breakdownTasks.length === 0) {
    return false; // No BREAKDOWN tasks in project
  }

  // Check if all BREAKDOWNs are complete
  const allBreakdownsComplete = breakdownTasks.every(f => f.status === "passing");

  if (!allBreakdownsComplete) {
    return false; // Still have incomplete BREAKDOWNs
  }

  // Check if implementation has already started
  // Implementation tasks are any non-BREAKDOWN tasks
  const implementationTasks = allFeatures.filter(f =>
    !f.id.toUpperCase().includes(".BREAKDOWN")
  );

  // If any implementation task is passing or failed, implementation has started
  const implementationStarted = implementationTasks.some(f =>
    f.status === "passing" || f.status === "failed"
  );

  if (implementationStarted) {
    return false; // Implementation already in progress, skip reminder
  }

  // All BREAKDOWNs complete, no implementation started yet
  // This is the transition point - show validation reminder
  console.log(chalk.bold.cyan("═══════════════════════════════════════════════════════════════"));
  console.log(chalk.bold.cyan("              ⚠️  VALIDATION PHASE REMINDER"));
  console.log(chalk.bold.cyan("═══════════════════════════════════════════════════════════════\n"));

  console.log(chalk.white(`   All ${breakdownTasks.length} BREAKDOWN tasks completed.`));
  console.log(chalk.white(`   Before implementation, validate the task breakdown:\n`));

  console.log(chalk.bold.yellow("   RECOMMENDED ACTION:"));
  console.log(chalk.cyan("   agent-foreman validate\n"));

  console.log(chalk.gray("   This ensures:"));
  console.log(chalk.gray("   • All spec requirements are covered"));
  console.log(chalk.gray("   • Task granularity is appropriate"));
  console.log(chalk.gray("   • No gaps in acceptance criteria\n"));

  console.log(chalk.bold.cyan("═══════════════════════════════════════════════════════════════\n"));

  return true;
}

/**
 * Display TDD guidance section
 */
export async function displayTDDGuidance(
  cwd: string,
  feature: Feature,
  refreshGuidance: boolean,
  metadata?: FeatureListMetadata
): Promise<void> {
  try {
    // Check cache validity FIRST (unless --refresh-guidance is set)
    // This avoids expensive detectCapabilities call when cache is valid
    const isCacheValid =
      !refreshGuidance &&
      feature.tddGuidance &&
      feature.tddGuidance.forVersion === feature.version;

    let guidance: TDDGuidance | CachedTDDGuidance;
    let isCached = false;
    let isAIGenerated = false;
    let detectedCapabilities: Awaited<ReturnType<typeof detectCapabilities>> | undefined;

    if (isCacheValid && feature.tddGuidance) {
      // Use cached AI guidance - no need for capabilities detection
      guidance = feature.tddGuidance;
      isCached = true;
      isAIGenerated = true;
    } else {
      // Cache miss - need to generate new guidance, detect capabilities
      detectedCapabilities = await detectCapabilities(cwd, { verbose: false });
      const aiGuidance = await generateTDDGuidanceWithAI(feature, detectedCapabilities, cwd);

      if (aiGuidance) {
        feature.tddGuidance = aiGuidance;
        // Skip version increment - we're only caching metadata, not changing feature content
        await saveSingleFeature(cwd, feature, { skipVersionIncrement: true });
        guidance = aiGuidance;
        isAIGenerated = true;
      } else {
        guidance = generateTDDGuidance(feature, detectedCapabilities, cwd);
      }
    }

    // Check TDD mode from metadata
    const tddMode = metadata?.tddMode || "recommended";
    const isStrictTDD = tddMode === "strict";
    const hasRequiredTests =
      feature.testRequirements?.unit?.required ||
      feature.testRequirements?.e2e?.required;

    // Show enforcement warning for strict mode
    if (isStrictTDD || hasRequiredTests) {
      console.log(chalk.bold.red("\n!!! TDD ENFORCEMENT ACTIVE !!!"));
      console.log(
        chalk.red("   Tests are REQUIRED for this feature to pass verification.")
      );
      console.log(
        chalk.red("   The 'check' and 'done' commands will fail without tests.\n")
      );
    }

    // Display TDD guidance header with appropriate styling
    const headerColor = isStrictTDD ? chalk.bold.red : chalk.bold.magenta;
    const headerText = isStrictTDD ? "TDD GUIDANCE (REQUIRED)" : "TDD GUIDANCE";
    console.log(headerColor("═══════════════════════════════════════════════════════════════"));
    console.log(headerColor(`                    ${headerText}`));
    console.log(headerColor("═══════════════════════════════════════════════════════════════\n"));

    // Show TDD workflow instructions for strict mode
    if (isStrictTDD || hasRequiredTests) {
      console.log(chalk.bold.yellow("📋 TDD Workflow (MANDATORY):"));
      console.log(chalk.white("   1. RED:      Create test file(s), write failing tests"));
      console.log(chalk.white("   2. GREEN:    Implement minimum code to pass tests"));
      console.log(chalk.white("   3. REFACTOR: Clean up under test protection"));
      console.log(chalk.white(`   4. CHECK:    Run 'agent-foreman check ${feature.id}'`));
      console.log(chalk.white(`   5. DONE:     Run 'agent-foreman done ${feature.id}'`));
      console.log("");
    }

    // Source indicator
    if (isCached) {
      console.log(chalk.gray(`   (cached from ${(guidance as CachedTDDGuidance).generatedAt})`));
    } else if (isAIGenerated) {
      console.log(chalk.gray(`   (AI-generated by ${(guidance as CachedTDDGuidance).generatedBy})`));
    } else {
      console.log(chalk.yellow(`   (fallback: regex-based)`));
    }

    // Suggested test files
    console.log(chalk.bold("\n📝 Suggested Test Files:"));
    if (guidance.suggestedTestFiles.unit.length > 0) {
      console.log(chalk.cyan(`   Unit: ${guidance.suggestedTestFiles.unit[0]}`));
    }
    if (guidance.suggestedTestFiles.e2e.length > 0) {
      console.log(chalk.blue(`   E2E:  ${guidance.suggestedTestFiles.e2e[0]}`));
    }

    if (isAIGenerated) {
      displayAIGuidance(guidance as CachedTDDGuidance);
    } else {
      displayRegexGuidance(guidance as TDDGuidance, detectedCapabilities?.testFramework);
    }

    console.log(chalk.bold.magenta("\n═══════════════════════════════════════════════════════════════\n"));
  } catch {
    // Silently skip if capabilities detection fails
  }
}

function displayAIGuidance(guidance: CachedTDDGuidance): void {
  // Show ALL guidance without truncation - this is instruction for AI agents
  console.log(chalk.bold("\n📋 Unit Test Cases:"));
  guidance.unitTestCases.forEach((tc, i) => {
    console.log(chalk.green(`   ${i + 1}. ${tc.name}`));
    if (tc.assertions.length > 0) {
      tc.assertions.forEach((a) => {
        console.log(chalk.gray(`      → ${a}`));
      });
    }
  });

  if (guidance.e2eScenarios.length > 0) {
    console.log(chalk.bold("\n🎭 E2E Scenarios:"));
    guidance.e2eScenarios.forEach((sc, i) => {
      console.log(chalk.blue(`   ${i + 1}. ${sc.name}`));
      sc.steps.forEach((step) => {
        console.log(chalk.gray(`      → ${step}`));
      });
    });
  }
}

/**
 * Display enhanced context for BREAKDOWN tasks
 */
export async function displayBreakdownContext(
  cwd: string,
  feature: Feature,
  allFeatures: Feature[]
): Promise<void> {
  const specDir = path.join(cwd, "ai/tasks/spec");
  const moduleName = feature.module;

  console.log(chalk.bold.yellow("\n═══════════════════════════════════════════════════════════════"));
  console.log(chalk.bold.yellow("                    MODULE BREAKDOWN CONTEXT"));
  console.log(chalk.bold.yellow("═══════════════════════════════════════════════════════════════\n"));

  // Context files section - dynamically read all files in spec directory
  console.log(chalk.bold("📚 Context Files:"));
  try {
    const specFiles = await fs.readdir(specDir);
    const mdFiles = specFiles.filter(f => f.endsWith(".md")).sort();

    if (mdFiles.length === 0) {
      console.log(chalk.gray("   No spec files found in ai/tasks/spec/"));
    } else {
      for (const fileName of mdFiles) {
        console.log(chalk.green(`   ✓ ai/tasks/spec/${fileName}`));
      }
    }
  } catch {
    console.log(chalk.gray("   ai/tasks/spec/ directory not found"));
  }

  // Module map section - only show BREAKDOWN tasks
  console.log(chalk.bold("\n🗺️  BREAKDOWN Progress:"));
  const moduleFeatures = allFeatures.filter(f =>
    f.id.toUpperCase().includes(".BREAKDOWN")
  );

  let currentIndex = 0;
  for (const f of moduleFeatures) {
    currentIndex++;
    const isCurrent = f.id === feature.id;
    const statusIcon = f.status === "passing" ? "✓" :
                       f.status === "failing" ? "○" :
                       f.status === "blocked" ? "⊘" : "?";
    const statusColor = f.status === "passing" ? chalk.green :
                        f.status === "failing" ? chalk.yellow :
                        f.status === "blocked" ? chalk.red : chalk.gray;

    if (isCurrent) {
      console.log(chalk.cyan(`   [${currentIndex}] ${f.id} ← YOU ARE HERE`));
    } else {
      console.log(statusColor(`   [${currentIndex}] ${f.id} ${statusIcon} ${f.status}`));
    }
  }

  // Breakdown instructions
  console.log(chalk.bold("\n📋 Breakdown Instructions:"));
  console.log(chalk.white("   1. Read all context files listed above"));
  console.log(chalk.white("   2. Break into minimal implementable units (smallest testable pieces)"));
  console.log(chalk.white("   3. Create task files in ai/tasks/" + moduleName + "/"));
  console.log(chalk.white("   4. Update ai/tasks/index.json with new tasks"));
  console.log(chalk.white("   5. Run: ") + chalk.cyan(`agent-foreman done ${feature.id}`));

  // Task granularity guidance
  console.log(chalk.bold("\n✅ Good Task Example:"));
  console.log(chalk.green("   id: auth.oauth-google"));
  console.log(chalk.green("   description: Implement Google OAuth flow"));
  console.log(chalk.green("   Acceptance Criteria:"));
  console.log(chalk.green("     1. GET /auth/google redirects to Google OAuth"));
  console.log(chalk.green("     2. Callback validates state and exchanges code"));
  console.log(chalk.green("     3. User profile is fetched and stored"));

  console.log(chalk.bold("\n❌ Bad Task Examples:"));
  console.log(chalk.red("   • Too broad: \"Implement all OAuth\""));
  console.log(chalk.red("   • Too granular: \"Import Passport.js\""));
  console.log(chalk.red("   • Vague criteria: \"OAuth should work\""));

  console.log(chalk.bold.yellow("\n═══════════════════════════════════════════════════════════════\n"));
}

function displayRegexGuidance(guidance: TDDGuidance, testFramework?: string): void {
  console.log(chalk.bold("\n📋 Acceptance → Test Mapping:"));
  guidance.acceptanceMapping.forEach((m, i) => {
    console.log(chalk.gray(`   ${i + 1}. "${m.criterion}"`));
    console.log(chalk.green(`      → Unit: ${m.unitTestCase}`));
    if (m.e2eScenario) {
      console.log(chalk.blue(`      → E2E:  ${m.e2eScenario}`));
    }
  });

  // Show ALL test cases without truncation - this is instruction for AI agents
  if (guidance.testCaseStubs.unit.length > 0 && testFramework) {
    const framework = testFramework.toLowerCase();
    const supportedFrameworks = ["vitest", "jest", "mocha"];
    if (supportedFrameworks.includes(framework)) {
      console.log(chalk.bold("\n📄 Test Skeleton:"));
      console.log(chalk.gray(`   Framework: ${testFramework}`));
      console.log(chalk.gray("   ```"));
      guidance.testCaseStubs.unit.forEach((testCase) => {
        console.log(chalk.white(`   it("${testCase}", () => { ... });`));
      });
      console.log(chalk.gray("   ```"));
    }
  }
}
