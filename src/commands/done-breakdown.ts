/**
 * BREAKDOWN task completion verification
 * Verifies that module breakdown tasks have been properly created
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import chalk from "chalk";
import matter from "gray-matter";
import type { Feature, FeatureList, FeatureStatus } from "../types/index.js";
import { loadFeatureIndex, saveFeatureIndex } from "../storage/index.js";

export interface BreakdownVerificationResult {
  passed: boolean;
  moduleName: string;
  tasksCreated: number;
  taskIds: string[];
  autoRegistered: string[];
  coverageCheck: {
    hasSpecDir: boolean;
    screensFound: number;
    screensCovered: number;
    apisFound: number;
    apisCovered: number;
  };
  issues: string[];
  warnings: string[];
}

/**
 * Verify that a BREAKDOWN task has been properly completed
 */
export async function verifyBreakdownCompletion(
  cwd: string,
  feature: Feature,
  featureList: FeatureList
): Promise<BreakdownVerificationResult> {
  const moduleName = feature.module;
  const moduleDir = path.join(cwd, "ai/tasks", moduleName);
  const specDir = path.join(cwd, "ai/tasks/spec");

  const result: BreakdownVerificationResult = {
    passed: true,
    moduleName,
    tasksCreated: 0,
    taskIds: [],
    autoRegistered: [],
    coverageCheck: {
      hasSpecDir: false,
      screensFound: 0,
      screensCovered: 0,
      apisFound: 0,
      apisCovered: 0,
    },
    issues: [],
    warnings: [],
  };

  // 1. Check that module directory exists
  try {
    await fs.access(moduleDir);
  } catch {
    result.issues.push(`Module directory not found: ai/tasks/${moduleName}/`);
    result.passed = false;
    return result;
  }

  // 2. Find tasks created in the module directory
  const files = await fs.readdir(moduleDir);
  const taskFiles = files.filter(f =>
    f.endsWith(".md") && !f.toUpperCase().includes("BREAKDOWN")
  );

  result.tasksCreated = taskFiles.length;

  if (taskFiles.length === 0) {
    result.issues.push("No task files created. Expected 4-8 implementation tasks.");
    result.passed = false;
    return result;
  }

  if (taskFiles.length < 3) {
    result.warnings.push(`Only ${taskFiles.length} tasks created. Consider breaking down further.`);
  }

  // 3. Extract task IDs from files (read frontmatter for accurate IDs)
  interface TaskInfo {
    id: string;
    filePath: string;
    description: string;
    priority: number;
    status: FeatureStatus;
  }
  const taskInfos: TaskInfo[] = [];

  for (const file of taskFiles) {
    const filePath = path.join(moduleDir, file);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const { data } = matter(content);

      // Get task ID from frontmatter, fallback to filename-based
      const taskId = data.id || `${moduleName}.${path.basename(file, ".md")}`;
      const description = data.description || extractDescription(content) || file;
      const priority = data.priority || 100;
      const status = (data.status as FeatureStatus) || "failing";

      result.taskIds.push(taskId);
      taskInfos.push({ id: taskId, filePath: `${moduleName}/${file}`, description, priority, status });
    } catch {
      // Fallback to filename-based ID
      const taskId = `${moduleName}.${path.basename(file, ".md")}`;
      result.taskIds.push(taskId);
      taskInfos.push({ id: taskId, filePath: `${moduleName}/${file}`, description: file, priority: 100, status: "failing" });
    }
  }

  // 4. Check which tasks are missing from index and auto-register them
  const missingFromIndex = result.taskIds.filter(id =>
    !featureList.features.some(f => f.id === id)
  );

  if (missingFromIndex.length > 0) {
    // Auto-register missing tasks to index
    const index = await loadFeatureIndex(cwd);
    if (index) {
      for (const taskInfo of taskInfos) {
        if (missingFromIndex.includes(taskInfo.id)) {
          index.features[taskInfo.id] = {
            status: taskInfo.status,
            priority: taskInfo.priority,
            module: moduleName,
            description: taskInfo.description,
            filePath: taskInfo.filePath,
          };
          result.autoRegistered.push(taskInfo.id);
        }
      }
      await saveFeatureIndex(cwd, index);
    } else {
      // No index file - this is a warning, not a failure
      result.warnings.push(`Index file not found, tasks may need manual registration`);
    }
  }

  // 5. Check spec directory coverage (optional)
  try {
    await fs.access(specDir);
    result.coverageCheck.hasSpecDir = true;

    // Try to parse UX.md for screens (new naming convention)
    try {
      const uxDesign = await fs.readFile(path.join(specDir, "UX.md"), "utf-8");
      const screenMatches = uxDesign.match(/\*\*\[?Screen[^\*]*\*\*/gi) || [];
      result.coverageCheck.screensFound = screenMatches.length;

      // Count how many screens are covered by tasks
      // This is a simple heuristic - tasks that mention screens
      let covered = 0;
      for (const taskId of result.taskIds) {
        const taskFile = path.join(moduleDir, `${taskId.split(".").pop()}.md`);
        try {
          const taskContent = await fs.readFile(taskFile, "utf-8");
          if (taskContent.toLowerCase().includes("screen") ||
              taskContent.toLowerCase().includes("page") ||
              taskContent.toLowerCase().includes("ui")) {
            covered++;
          }
        } catch {
          // Ignore read errors
        }
      }
      result.coverageCheck.screensCovered = covered;
    } catch {
      // UX.md not found, skip
    }

    // Try to parse OVERVIEW.md for APIs
    try {
      const overview = await fs.readFile(path.join(specDir, "OVERVIEW.md"), "utf-8");
      const apiMatches = overview.match(/\*\*(GET|POST|PUT|DELETE|PATCH)\s+\/[^\*]+\*\*/gi) || [];
      result.coverageCheck.apisFound = apiMatches.length;

      // Count how many APIs are covered by tasks
      let covered = 0;
      for (const taskId of result.taskIds) {
        const taskFile = path.join(moduleDir, `${taskId.split(".").pop()}.md`);
        try {
          const taskContent = await fs.readFile(taskFile, "utf-8");
          if (taskContent.toLowerCase().includes("api") ||
              taskContent.toLowerCase().includes("endpoint") ||
              taskContent.match(/(GET|POST|PUT|DELETE|PATCH)\s+\//i)) {
            covered++;
          }
        } catch {
          // Ignore read errors
        }
      }
      result.coverageCheck.apisCovered = covered;
    } catch {
      // OVERVIEW.md not found, skip
    }
  } catch {
    // No spec directory - that's okay for non-spec workflows
    result.coverageCheck.hasSpecDir = false;
  }

  // 6. Verify each task has acceptance criteria
  for (const taskId of result.taskIds) {
    const taskFile = path.join(moduleDir, `${taskId.split(".").pop()}.md`);
    try {
      const content = await fs.readFile(taskFile, "utf-8");
      if (!content.includes("Acceptance Criteria") && !content.includes("acceptance:")) {
        result.warnings.push(`Task ${taskId} missing acceptance criteria`);
      }
    } catch {
      // Ignore read errors
    }
  }

  return result;
}

/**
 * Display BREAKDOWN verification result
 */
export function displayBreakdownResult(result: BreakdownVerificationResult): void {
  console.log(chalk.bold.yellow("\n═══════════════════════════════════════════════════════════════"));
  console.log(chalk.bold.yellow("                  BREAKDOWN COMPLETION CHECK"));
  console.log(chalk.bold.yellow("═══════════════════════════════════════════════════════════════\n"));

  console.log(chalk.bold(`   Module: ${result.moduleName}`));
  console.log(chalk.bold(`   Tasks Created: ${result.tasksCreated}`));

  if (result.taskIds.length > 0) {
    console.log(chalk.gray("\n   Task Files:"));
    for (const taskId of result.taskIds) {
      const wasAutoRegistered = result.autoRegistered.includes(taskId);
      if (wasAutoRegistered) {
        console.log(chalk.green(`     ✓ ${taskId} `) + chalk.cyan("(auto-registered)"));
      } else {
        console.log(chalk.green(`     ✓ ${taskId}`));
      }
    }
  }

  // Show auto-registration summary
  if (result.autoRegistered.length > 0) {
    console.log(chalk.cyan(`\n   ✓ Auto-registered ${result.autoRegistered.length} task(s) to index.json`));
  }

  // Coverage check (if spec exists)
  if (result.coverageCheck.hasSpecDir) {
    console.log(chalk.bold("\n   Coverage Check:"));
    if (result.coverageCheck.screensFound > 0) {
      const screenPct = Math.round(
        (result.coverageCheck.screensCovered / result.coverageCheck.screensFound) * 100
      );
      console.log(chalk.gray(
        `     UX Screens: ${result.coverageCheck.screensCovered}/${result.coverageCheck.screensFound} (${screenPct}%)`
      ));
    }
    if (result.coverageCheck.apisFound > 0) {
      const apiPct = Math.round(
        (result.coverageCheck.apisCovered / result.coverageCheck.apisFound) * 100
      );
      console.log(chalk.gray(
        `     APIs: ${result.coverageCheck.apisCovered}/${result.coverageCheck.apisFound} (${apiPct}%)`
      ));
    }
  }

  // Issues
  if (result.issues.length > 0) {
    console.log(chalk.bold.red("\n   Issues:"));
    for (const issue of result.issues) {
      console.log(chalk.red(`     ✗ ${issue}`));
    }
  }

  // Warnings
  if (result.warnings.length > 0) {
    console.log(chalk.bold.yellow("\n   Warnings:"));
    for (const warning of result.warnings) {
      console.log(chalk.yellow(`     ⚠ ${warning}`));
    }
  }

  // Final verdict
  console.log("");
  if (result.passed) {
    console.log(chalk.green("   Result: PASS ✓"));
  } else {
    console.log(chalk.red("   Result: FAIL ✗"));
  }

  console.log(chalk.bold.yellow("\n═══════════════════════════════════════════════════════════════\n"));
}

/**
 * Extract description from markdown content (first heading or first paragraph)
 */
function extractDescription(content: string): string | null {
  // Try to find first heading after frontmatter
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.startsWith("# ")) {
      return line.replace(/^#+\s*/, "").trim();
    }
  }
  return null;
}
