/**
 * Project detection and analysis
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import chalk from "chalk";

import { scanDirectoryStructure, isProjectEmpty } from "../project-scanner.js";
import { aiScanProject, generateFeaturesFromGoal, generateFeaturesFromSurvey, aiResultToSurvey, generateAISurveyMarkdown } from "../scanner/index.js";
import { featureListExists } from "../features/index.js";
import { printAgentStatus } from "../agents.js";
import { debugInit } from "../debug.js";
import type { AnalysisResult } from "./types.js";

/**
 * Step 1: Detect project type and analyze with AI
 * Determines feature source based on project state:
 * - If ARCHITECTURE.md exists, use it
 * - If project is empty, generate features from goal
 * - Otherwise, run AI scan to analyze existing code
 */
export async function detectAndAnalyzeProject(
  cwd: string,
  goal: string,
  verbose: boolean
): Promise<AnalysisResult> {
  // Check for ARCHITECTURE.md
  const surveyPaths = [
    path.join(cwd, "docs/ARCHITECTURE.md"),
  ];

  let surveyContent: string | null = null;
  let foundPath: string | null = null;

  // Try each survey path in order
  for (const surveyPath of surveyPaths) {
    try {
      surveyContent = await fs.readFile(surveyPath, "utf-8");
      foundPath = surveyPath;
      break;
    } catch {
      // Try next path
    }
  }

  if (surveyContent && foundPath) {
    const fileName = path.basename(foundPath);
    console.log(chalk.green(`✓ Found ${fileName}`));

    const aiResult = await generateFeaturesFromSurvey(surveyContent, goal);
    if (!aiResult.success) {
      return { success: false, error: aiResult.error };
    }

    const structure = await scanDirectoryStructure(cwd);
    const survey = aiResultToSurvey(aiResult, structure);

    return {
      success: true,
      survey,
      agentUsed: aiResult.agentUsed,
    };
  }

  debugInit("No ARCHITECTURE.md found, checking project state...");

  // Check if ai/tasks already exists with valid tasks
  // If so, preserve them - don't generate new features from goal
  const tasksExist = await featureListExists(cwd);
  if (tasksExist) {
    console.log(chalk.green("✓ Found existing ai/tasks - preserving current tasks"));
    console.log(chalk.gray("  (Use 'agent-foreman init --mode new' to regenerate tasks)"));

    // Return empty survey so mergeOrCreateFeatures preserves existing tasks
    const structure = await scanDirectoryStructure(cwd);
    return {
      success: true,
      survey: {
        techStack: {
          language: "unknown",
          framework: "unknown",
          buildTool: "unknown",
          testFramework: "unknown",
          packageManager: "unknown",
        },
        structure,
        modules: [],
        features: [], // No new features to merge
        completion: { overall: 0, byModule: {}, notes: ["Tasks preserved from existing ai/tasks"] },
        commands: { install: "", dev: "", build: "", test: "" },
      },
      agentUsed: "none",
    };
  }

  // No survey file - check if project has source code
  const empty = await isProjectEmpty(cwd);

  if (empty) {
    // Empty project: generate features from goal description
    console.log(chalk.gray("  New/empty project detected, generating features from goal..."));
    if (verbose) {
      printAgentStatus();
    }

    const aiResult = await generateFeaturesFromGoal(goal);
    if (!aiResult.success) {
      return { success: false, error: aiResult.error };
    }

    const structure = await scanDirectoryStructure(cwd);
    const survey = aiResultToSurvey(aiResult, structure);

    return {
      success: true,
      survey,
      agentUsed: aiResult.agentUsed,
    };
  }

  // Has source code: auto-run survey first, then use it
  console.log(chalk.gray("  No ARCHITECTURE.md found, auto-generating..."));
  if (verbose) {
    printAgentStatus();
  }

  const aiResult = await aiScanProject(cwd, { verbose });

  if (!aiResult.success) {
    return { success: false, error: aiResult.error };
  }

  // Auto-save survey for future use (use ARCHITECTURE.md as the default output)
  const tempStructure = await scanDirectoryStructure(cwd);
  const tempSurvey = aiResultToSurvey(aiResult, tempStructure);
  const surveyMarkdown = generateAISurveyMarkdown(tempSurvey, aiResult);

  const defaultSurveyPath = path.join(cwd, "docs/ARCHITECTURE.md");
  await fs.mkdir(path.dirname(defaultSurveyPath), { recursive: true });
  await fs.writeFile(defaultSurveyPath, surveyMarkdown);
  console.log(chalk.green(`✓ Auto-generated docs/ARCHITECTURE.md`));

  const structure = await scanDirectoryStructure(cwd);
  const survey = aiResultToSurvey(aiResult, structure);

  return {
    success: true,
    survey,
    agentUsed: aiResult.agentUsed,
  };
}
