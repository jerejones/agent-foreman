/**
 * Task Impact Detection
 *
 * Maps changed files to affected tasks using:
 * 1. Explicit glob patterns (task.affectedBy)
 * 2. Test patterns (task.testRequirements.unit.pattern)
 * 3. Module-based matching (task.module)
 */

import * as path from "node:path";
import { minimatch } from "minimatch";
import type { Feature } from "../types/index.js";
import { loadFeatureList } from "../features/index.js";

/**
 * Task impact result
 */
export interface TaskImpact {
  /** Task ID */
  taskId: string;
  /** Human-readable reason for impact */
  reason: string;
  /** Confidence level */
  confidence: "high" | "medium" | "low";
  /** Files that caused the impact */
  matchedFiles: string[];
}

/**
 * Get affected tasks for changed files
 */
export async function getTaskImpact(
  cwd: string,
  changedFiles: string[]
): Promise<TaskImpact[]> {
  const featureList = await loadFeatureList(cwd);
  if (!featureList || featureList.features.length === 0) {
    return [];
  }

  const impacts: TaskImpact[] = [];
  const seenTasks = new Set<string>();

  for (const feature of featureList.features) {
    // Skip completed or deprecated tasks
    if (feature.status === "passing" || feature.status === "deprecated") {
      continue;
    }

    const matchResult = matchFeatureToFiles(feature, changedFiles);
    if (matchResult && !seenTasks.has(feature.id)) {
      seenTasks.add(feature.id);
      impacts.push(matchResult);
    }
  }

  // Sort by confidence (high → medium → low)
  const confidenceOrder = { high: 0, medium: 1, low: 2 };
  impacts.sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence]);

  return impacts;
}

/**
 * Match a feature to changed files
 */
function matchFeatureToFiles(
  feature: Feature,
  changedFiles: string[]
): TaskImpact | null {
  const matchedFiles: string[] = [];
  let reason = "";
  let confidence: TaskImpact["confidence"] = "low";

  // Strategy 1: Explicit affectedBy patterns (highest confidence)
  if (feature.affectedBy && feature.affectedBy.length > 0) {
    for (const pattern of feature.affectedBy) {
      for (const file of changedFiles) {
        if (minimatch(file, pattern, { matchBase: true })) {
          matchedFiles.push(file);
        }
      }
    }
    if (matchedFiles.length > 0) {
      reason = `matches affectedBy pattern: ${feature.affectedBy[0]}`;
      confidence = "high";
      return { taskId: feature.id, reason, confidence, matchedFiles };
    }
  }

  // Strategy 2: Test pattern matching (medium confidence)
  const testPattern = feature.testRequirements?.unit?.pattern;
  if (testPattern) {
    // Extract source path from test pattern
    // e.g., "tests/auth/**/*.test.ts" → "src/auth/**/*.ts"
    const sourcePath = testPatternToSourcePath(testPattern);
    if (sourcePath) {
      for (const file of changedFiles) {
        if (minimatch(file, sourcePath, { matchBase: true })) {
          matchedFiles.push(file);
        }
      }
      if (matchedFiles.length > 0) {
        reason = `matches test pattern: ${testPattern}`;
        confidence = "medium";
        return { taskId: feature.id, reason, confidence, matchedFiles };
      }
    }
  }

  // Strategy 3: Module-based matching (low confidence)
  if (feature.module) {
    const modulePattern = `**/${feature.module}/**/*`;
    for (const file of changedFiles) {
      if (minimatch(file, modulePattern, { matchBase: true }) ||
          file.includes(`/${feature.module}/`) ||
          file.includes(`${feature.module}/`)) {
        matchedFiles.push(file);
      }
    }
    if (matchedFiles.length > 0) {
      reason = `file in module: ${feature.module}`;
      confidence = "low";
      return { taskId: feature.id, reason, confidence, matchedFiles };
    }
  }

  return null;
}

/**
 * Convert test pattern to likely source path pattern.
 * Example: tests/auth/foo.test.ts -> src/auth/foo.ts
 */
function testPatternToSourcePath(testPattern: string): string | null {
  // Common test directory prefixes
  const testPrefixes = ["tests/", "test/", "__tests__/", "spec/"];
  const srcPrefixes = ["src/", "lib/", ""];

  let pattern = testPattern;

  // Remove test prefix
  for (const prefix of testPrefixes) {
    if (pattern.startsWith(prefix)) {
      pattern = pattern.slice(prefix.length);
      break;
    }
  }

  // Remove test file suffix patterns
  pattern = pattern
    .replace(/\.test\.\*$/, ".*")
    .replace(/\.spec\.\*$/, ".*")
    .replace(/\.test\.ts$/, ".ts")
    .replace(/\.spec\.ts$/, ".ts")
    .replace(/\.test\.tsx$/, ".tsx")
    .replace(/\.spec\.tsx$/, ".tsx")
    .replace(/\.test\.js$/, ".js")
    .replace(/\.spec\.js$/, ".js");

  // Try with src/ prefix first
  return `src/${pattern}`;
}

/**
 * Build a reverse index from file paths to task IDs
 * (For future optimization with caching)
 */
export function buildFileTaskIndex(
  tasks: Feature[]
): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();

  for (const task of tasks) {
    const patterns: string[] = [];

    // Collect all patterns for this task
    if (task.affectedBy) {
      patterns.push(...task.affectedBy);
    }
    if (task.testRequirements?.unit?.pattern) {
      const srcPattern = testPatternToSourcePath(task.testRequirements.unit.pattern);
      if (srcPattern) patterns.push(srcPattern);
    }
    if (task.module) {
      patterns.push(`**/${task.module}/**/*`);
    }

    // Add to index
    for (const pattern of patterns) {
      if (!index.has(pattern)) {
        index.set(pattern, new Set());
      }
      index.get(pattern)!.add(task.id);
    }
  }

  return index;
}
