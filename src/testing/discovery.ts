/**
 * Test discovery functions for finding related tests
 */

import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Feature } from "../types/index.js";
import { getTestPattern } from "../types/index.js";
import { fileExists } from "../file-utils.js";
import type { TestDiscoveryResult } from "./types.js";
import { mapSourceToTestFiles, extractModuleFromPath } from "./patterns.js";

const execAsync = promisify(exec);

/**
 * Get changed files from git diff
 */
export async function getChangedFiles(cwd: string): Promise<string[]> {
  try {
    // Get both staged and unstaged changes
    const { stdout: stagedOutput } = await execAsync(
      "git diff --cached --name-only",
      { cwd }
    );
    const { stdout: unstagedOutput } = await execAsync(
      "git diff --name-only",
      { cwd }
    );

    // Also check last commit for recently committed changes
    const { stdout: lastCommitOutput } = await execAsync(
      "git diff HEAD~1 HEAD --name-only 2>/dev/null || echo ''",
      { cwd }
    );

    const allFiles = new Set<string>();

    for (const output of [stagedOutput, unstagedOutput, lastCommitOutput]) {
      output.trim().split("\n")
        .filter((f) => f.length > 0)
        .forEach((f) => allFiles.add(f));
    }

    return Array.from(allFiles);
  } catch (error) {
    return [];
  }
}

/**
 * Find existing test files that match the candidates
 */
export async function findExistingTestFiles(
  cwd: string,
  candidates: string[]
): Promise<string[]> {
  const existing: string[] = [];

  for (const candidate of candidates) {
    const fullPath = path.join(cwd, candidate);
    if (await fileExists(fullPath)) {
      existing.push(candidate);
    }
  }

  return existing;
}

/**
 * Discover related tests for a feature based on changes
 *
 * Priority:
 * 1. Explicit testPattern from feature
 * 2. Auto-detect from changed files
 * 3. Module-based pattern from feature.module
 * 4. No pattern (run all tests)
 */
export async function discoverTestsForFeature(
  cwd: string,
  feature: Feature,
  changedFiles?: string[]
): Promise<TestDiscoveryResult> {
  // 1. Use explicit pattern if defined (from testRequirements.unit.pattern)
  const explicitPattern = getTestPattern(feature);
  if (explicitPattern) {
    return {
      pattern: explicitPattern,
      source: "explicit",
      testFiles: [],
      confidence: 1.0,
    };
  }

  // 2. Get changed files if not provided
  const files = changedFiles || await getChangedFiles(cwd);

  if (files.length === 0) {
    return {
      pattern: null,
      source: "none",
      testFiles: [],
      confidence: 0,
    };
  }

  // 3. Find test files for changed source files
  const sourceFiles = files.filter(
    (f) =>
      !f.includes(".test.") &&
      !f.includes(".spec.") &&
      !f.includes("__tests__") &&
      !f.startsWith("test/") &&
      !f.startsWith("tests/")
  );

  const testCandidates: string[] = [];
  for (const source of sourceFiles) {
    testCandidates.push(...mapSourceToTestFiles(source));
  }

  // Also include directly changed test files
  const changedTestFiles = files.filter(
    (f) =>
      f.includes(".test.") ||
      f.includes(".spec.") ||
      f.includes("__tests__") ||
      f.startsWith("test/") ||
      f.startsWith("tests/")
  );

  const existingTestFiles = await findExistingTestFiles(cwd, [
    ...testCandidates,
    ...changedTestFiles,
  ]);

  if (existingTestFiles.length > 0) {
    // Build pattern from discovered test files
    // For most test runners, we can pass file paths directly
    return {
      pattern: existingTestFiles.join(" "),
      source: "auto-detected",
      testFiles: existingTestFiles,
      confidence: 0.9,
    };
  }

  // 4. Fall back to module-based pattern
  const modules = new Set<string>();
  for (const file of files) {
    const module = extractModuleFromPath(file);
    if (module) {
      modules.add(module);
    }
  }

  if (modules.size > 0) {
    // Use feature module or extracted modules
    const modulePattern = feature.module || Array.from(modules)[0];
    return {
      pattern: `**/${modulePattern}/**/*.test.*`,
      source: "module-based",
      testFiles: [],
      confidence: 0.6,
    };
  }

  return {
    pattern: null,
    source: "none",
    testFiles: [],
    confidence: 0,
  };
}
