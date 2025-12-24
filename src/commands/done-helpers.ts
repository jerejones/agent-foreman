/**
 * Helper functions for 'done' command
 * Handles survey regeneration and verification display
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import chalk from "chalk";

import { aiScanProject, aiResultToSurvey, generateAISurveyMarkdown } from "../scanner/index.js";
import { scanDirectoryStructure } from "../project-scanner.js";
import type { Feature, FeatureList } from "../types/index.js";

/**
 * Regenerate ARCHITECTURE.md when all features are complete
 */
export async function regenerateSurvey(
  cwd: string,
  featureList: FeatureList
): Promise<void> {
  console.log(chalk.blue("\n📊 Regenerating project survey..."));
  try {
    const aiResult = await aiScanProject(cwd, { verbose: false });
    if (aiResult.success) {
      const structure = await scanDirectoryStructure(cwd);
      const survey = aiResultToSurvey(aiResult, structure);

      // Replace survey.features with actual features from feature index
      // Show actual status (passing/failing) instead of AI confidence
      survey.features = featureList.features.map((f) => ({
        id: f.id,
        description: f.description,
        module: f.module,
        source: "feature_list" as const,
        confidence: f.status === "passing" ? 1.0 : 0.0,
        status: f.status,
      }));

      // Override completion to 100% since all features are passing
      const passingCount = featureList.features.filter((f) => f.status === "passing").length;
      const totalCount = featureList.features.length;
      survey.completion = {
        overall: Math.round((passingCount / totalCount) * 100),
        byModule: Object.fromEntries(
          survey.modules.map((m) => [m.name, 100])
        ),
        notes: [
          "All tasks are passing",
          `Completed ${passingCount}/${totalCount} tasks`,
          `Last updated: ${new Date().toISOString().split("T")[0]}`
        ]
      };
      const markdown = generateAISurveyMarkdown(survey, aiResult);
      const surveyPath = path.join(cwd, "docs/ARCHITECTURE.md");
      await fs.mkdir(path.dirname(surveyPath), { recursive: true });
      await fs.writeFile(surveyPath, markdown);
      console.log(chalk.green("✓ Updated docs/ARCHITECTURE.md (100% complete)"));
    }
  } catch {
    console.log(chalk.yellow("⚠ Could not regenerate survey (AI agent unavailable)"));
  }
}

/**
 * Display test file verification header
 */
export function displayTestFileHeader(): void {
  console.log(chalk.bold.blue("\n═══════════════════════════════════════════════════════════════"));
  console.log(chalk.bold.blue("                    TEST FILE VERIFICATION"));
  console.log(chalk.bold.blue("═══════════════════════════════════════════════════════════════\n"));
}

/**
 * Display verification header
 */
export function displayVerificationHeader(
  feature: Feature,
  ai: boolean,
  testMode: "full" | "quick" | "skip"
): void {
  console.log(chalk.bold.blue("\n═══════════════════════════════════════════════════════════════"));
  console.log(chalk.bold.blue("                      TASK VERIFICATION"));
  console.log(chalk.bold.blue("═══════════════════════════════════════════════════════════════\n"));

  console.log(chalk.bold(`📋 Task: ${chalk.cyan(feature.id)}`));
  console.log(chalk.gray(`   Module: ${feature.module} | Priority: ${feature.priority}`));
  if (ai) {
    console.log(chalk.cyan(`   Mode: AI autonomous exploration`));
  }
  if (testMode === "quick") {
    console.log(chalk.cyan(`   Test mode: Quick (selective tests)`));
  }
  console.log("");
  console.log(chalk.bold("📝 Acceptance Criteria:"));
  feature.acceptance.forEach((a, i) => {
    console.log(chalk.white(`   ${i + 1}. ${a}`));
  });
}

/**
 * Display commit suggestion
 */
export function displayCommitSuggestion(module: string, description: string): void {
  const shortDesc = description.length > 50
    ? description.substring(0, 47) + "..."
    : description;
  console.log(chalk.cyan("\n📝 Suggested commit:"));
  console.log(chalk.white(`   git add -A && git commit -m "feat(${module}): ${shortDesc}"`));
}
