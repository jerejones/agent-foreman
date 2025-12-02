/**
 * Test discovery and selective test execution
 * Finds related tests based on changed files and feature patterns
 *
 * Hybrid approach:
 * 1. Use AI-discovered selective test templates from capabilities cache
 * 2. Fall back to hardcoded patterns for known frameworks
 */

import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Feature } from "./types.js";
import type { VerificationCapabilities, TestCapabilityInfo, E2ECapabilityInfo } from "./verification-types.js";
import { fileExists } from "./file-utils.js";

const execAsync = promisify(exec);

// ============================================================================
// Test File Discovery
// ============================================================================

/**
 * Common test file patterns by framework
 */
const TEST_PATTERNS: Record<string, string[]> = {
  vitest: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
  jest: ["**/*.test.js", "**/*.test.jsx", "**/*.test.ts", "**/*.test.tsx", "**/__tests__/**/*"],
  mocha: ["test/**/*.js", "test/**/*.ts", "**/*.test.js", "**/*.spec.js"],
  pytest: ["test_*.py", "*_test.py", "tests/**/*.py"],
  go: ["*_test.go"],
  cargo: ["**/tests/**/*.rs", "src/**/*_test.rs"],
};

/**
 * Map source file to potential test file paths
 * @param sourceFile - Source file path (e.g., "src/auth/login.ts")
 * @returns Array of potential test file paths
 */
export function mapSourceToTestFiles(sourceFile: string): string[] {
  const candidates: string[] = [];
  const ext = path.extname(sourceFile);
  const baseName = path.basename(sourceFile, ext);
  const dirName = path.dirname(sourceFile);

  // Common test file naming conventions
  // 1. Same directory: foo.ts -> foo.test.ts, foo.spec.ts
  candidates.push(path.join(dirName, `${baseName}.test${ext}`));
  candidates.push(path.join(dirName, `${baseName}.spec${ext}`));

  // 2. __tests__ subdirectory: src/auth/login.ts -> src/auth/__tests__/login.test.ts
  candidates.push(path.join(dirName, "__tests__", `${baseName}.test${ext}`));
  candidates.push(path.join(dirName, "__tests__", `${baseName}${ext}`));

  // 3. Parallel test directory: src/auth/login.ts -> tests/auth/login.test.ts
  const srcMatch = sourceFile.match(/^src\//);
  if (srcMatch) {
    const relativePath = sourceFile.replace(/^src\//, "");
    const testDir = path.dirname(relativePath);
    candidates.push(path.join("tests", testDir, `${baseName}.test${ext}`));
    candidates.push(path.join("test", testDir, `${baseName}.test${ext}`));
    candidates.push(path.join("__tests__", testDir, `${baseName}.test${ext}`));
  }

  // 4. Python conventions: src/auth/login.py -> tests/test_login.py
  if (ext === ".py") {
    candidates.push(path.join("tests", `test_${baseName}.py`));
    candidates.push(path.join("test", `test_${baseName}.py`));
  }

  // 5. Go conventions: auth/login.go -> auth/login_test.go
  if (ext === ".go") {
    candidates.push(path.join(dirName, `${baseName}_test.go`));
  }

  return candidates;
}

/**
 * Extract module name from file path for broader test matching
 * @param filePath - File path (e.g., "src/auth/login.ts")
 * @returns Module name (e.g., "auth")
 */
export function extractModuleFromPath(filePath: string): string | null {
  // Common patterns: src/module/..., lib/module/..., app/module/...
  const match = filePath.match(/^(?:src|lib|app|pkg)\/([^/]+)/);
  if (match) {
    return match[1];
  }

  // Direct module: module/...
  const parts = filePath.split("/");
  if (parts.length >= 2 && !parts[0].startsWith(".")) {
    return parts[0];
  }

  return null;
}

// ============================================================================
// Git-based Discovery
// ============================================================================

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

// ============================================================================
// Test Pattern Generation
// ============================================================================

/**
 * Result of test discovery
 */
export interface TestDiscoveryResult {
  /** Discovered test pattern to use */
  pattern: string | null;
  /** How the pattern was discovered */
  source: "explicit" | "auto-detected" | "module-based" | "none";
  /** List of specific test files found */
  testFiles: string[];
  /** Confidence in the discovery (0-1) */
  confidence: number;
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
  // 1. Use explicit pattern if defined
  if (feature.testPattern) {
    return {
      pattern: feature.testPattern,
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

// ============================================================================
// Test Command Building
// ============================================================================

/**
 * Extended capabilities interface that includes TestCapabilityInfo
 */
interface ExtendedTestCapabilities extends VerificationCapabilities {
  testInfo?: TestCapabilityInfo;
}

/**
 * Build a selective test command using AI-discovered templates or fallback patterns
 *
 * Priority:
 * 1. Use selectiveFileTemplate from AI-discovered capabilities (if test files found)
 * 2. Use selectiveNameTemplate from AI-discovered capabilities (if pattern provided)
 * 3. Fall back to hardcoded framework patterns
 */
export function buildSelectiveTestCommand(
  capabilities: VerificationCapabilities | ExtendedTestCapabilities,
  pattern: string | null,
  discovery: TestDiscoveryResult
): string | null {
  if (!capabilities.hasTests || !capabilities.testCommand) {
    return null;
  }

  // If no pattern, use full test command
  if (!pattern) {
    return capabilities.testCommand;
  }

  const baseCommand = capabilities.testCommand;
  const framework = capabilities.testFramework;

  // Check for AI-discovered selective test templates
  const testInfo = (capabilities as ExtendedTestCapabilities).testInfo;

  if (testInfo) {
    // Priority 1: Use selectiveFileTemplate if we have specific test files
    if (discovery.testFiles.length > 0 && testInfo.selectiveFileTemplate) {
      const filesStr = discovery.testFiles.join(" ");
      return testInfo.selectiveFileTemplate.replace("{files}", filesStr);
    }

    // Priority 2: Use selectiveNameTemplate for pattern-based filtering
    if (testInfo.selectiveNameTemplate) {
      return testInfo.selectiveNameTemplate.replace("{pattern}", pattern);
    }
  }

  // Priority 3: Fall back to hardcoded framework patterns
  return buildHardcodedSelectiveCommand(framework, baseCommand, pattern, discovery);
}

/**
 * Fallback: Build selective test command using hardcoded framework patterns
 * Used when AI-discovered templates are not available
 */
function buildHardcodedSelectiveCommand(
  framework: string | undefined,
  baseCommand: string,
  pattern: string,
  discovery: TestDiscoveryResult
): string {
  switch (framework) {
    case "vitest":
      if (discovery.testFiles.length > 0) {
        return `npx vitest run ${discovery.testFiles.join(" ")}`;
      }
      return `npx vitest run --testNamePattern "${pattern}"`;

    case "jest":
      if (discovery.testFiles.length > 0) {
        return `npx jest ${discovery.testFiles.join(" ")}`;
      }
      return `npx jest --testPathPattern "${pattern}"`;

    case "mocha":
      if (discovery.testFiles.length > 0) {
        return `npx mocha ${discovery.testFiles.join(" ")}`;
      }
      return `npx mocha --grep "${pattern}"`;

    case "pytest":
      if (discovery.testFiles.length > 0) {
        return `pytest ${discovery.testFiles.join(" ")}`;
      }
      return `pytest -k "${pattern}"`;

    case "go":
      return `go test -run "${pattern}" ./...`;

    case "cargo":
      return `cargo test "${pattern}"`;

    default:
      // For unknown frameworks, try appending pattern to npm-based commands
      if (baseCommand.startsWith("npm ")) {
        return `${baseCommand} -- "${pattern}"`;
      }
      if (baseCommand.startsWith("pnpm ")) {
        return `${baseCommand} -- "${pattern}"`;
      }
      if (baseCommand.startsWith("yarn ")) {
        return `${baseCommand} "${pattern}"`;
      }
      if (baseCommand.startsWith("bun ")) {
        return `${baseCommand} "${pattern}"`;
      }
      // Fall back to full test command
      return baseCommand;
  }
}

/**
 * Get a selective test command for a feature
 * Returns full test command if no selective pattern can be determined
 */
export async function getSelectiveTestCommand(
  cwd: string,
  feature: Feature,
  capabilities: VerificationCapabilities,
  changedFiles?: string[]
): Promise<{
  command: string | null;
  isSelective: boolean;
  discovery: TestDiscoveryResult;
}> {
  const discovery = await discoverTestsForFeature(cwd, feature, changedFiles);
  const command = buildSelectiveTestCommand(capabilities, discovery.pattern, discovery);

  return {
    command,
    isSelective: discovery.source !== "none" && discovery.pattern !== null,
    discovery,
  };
}

// ============================================================================
// E2E Test Command Building
// ============================================================================

/**
 * E2E test execution mode
 */
export type E2EMode = "full" | "smoke" | "tags" | "skip";

/**
 * Build an E2E test command based on tags
 *
 * @param e2eInfo - E2E capability info from detection
 * @param tags - E2E tags from feature.e2eTags (e.g., ["@feature-auth", "@smoke"])
 * @param mode - E2E execution mode:
 *   - "full": Run all E2E tests (no grep filter)
 *   - "smoke": Run only @smoke tagged tests
 *   - "tags": Run tests matching the provided tags (OR logic)
 *   - "skip": Skip E2E tests entirely
 * @returns E2E test command or null if not available/skipped
 */
export function buildE2ECommand(
  e2eInfo: E2ECapabilityInfo | undefined,
  tags: string[] = [],
  mode: E2EMode = "tags"
): string | null {
  // Skip if E2E not available or mode is skip
  if (!e2eInfo?.available || !e2eInfo.command || mode === "skip") {
    return null;
  }

  // Full mode: run all E2E tests
  if (mode === "full" || (tags.length === 1 && tags[0] === "*")) {
    return e2eInfo.command;
  }

  // Smoke mode: run only @smoke tests
  if (mode === "smoke" || tags.length === 0) {
    return buildE2EGrepCommand(e2eInfo, ["@smoke"]);
  }

  // Tags mode: run tests matching the provided tags
  return buildE2EGrepCommand(e2eInfo, tags);
}

/**
 * Build E2E command with grep filter for specific tags
 * Multiple tags are joined with | for OR matching
 *
 * @param e2eInfo - E2E capability info
 * @param tags - Tags to filter (e.g., ["@feature-auth", "@smoke"])
 * @returns E2E command with grep filter
 */
function buildE2EGrepCommand(
  e2eInfo: E2ECapabilityInfo,
  tags: string[]
): string {
  // Use AI-discovered grep template if available
  if (e2eInfo.grepTemplate) {
    const tagPattern = tags.join("|");
    return e2eInfo.grepTemplate.replace("{tags}", `"${tagPattern}"`);
  }

  // Fallback to framework-specific patterns
  const tagPattern = tags.join("|");

  switch (e2eInfo.framework) {
    case "playwright":
      return `npx playwright test --grep "${tagPattern}"`;
    case "cypress":
      return `npx cypress run --spec "**/*" --env grep="${tagPattern}"`;
    case "puppeteer":
      // Puppeteer typically uses jest/mocha for running tests
      return `npx jest --testPathPattern "e2e" --testNamePattern "${tagPattern}"`;
    default:
      // Generic fallback using grep flag (works for many frameworks)
      return `${e2eInfo.command} --grep "${tagPattern}"`;
  }
}

/**
 * Get E2E tags for a feature
 * Returns feature.e2eTags if defined, otherwise empty array
 *
 * @param feature - Feature to get tags from
 * @returns Array of E2E tags
 */
export function getE2ETagsForFeature(feature: Feature): string[] {
  return feature.e2eTags || [];
}

/**
 * Determine E2E mode based on test mode and feature
 *
 * @param testMode - Overall test mode ("full" | "quick" | "skip")
 * @param hasE2ETags - Whether the feature has e2eTags defined
 * @returns E2E execution mode
 */
export function determineE2EMode(
  testMode: "full" | "quick" | "skip",
  hasE2ETags: boolean
): E2EMode {
  switch (testMode) {
    case "skip":
      return "skip";
    case "full":
      return "full";
    case "quick":
      // In quick mode, use feature tags if available, otherwise smoke
      return hasE2ETags ? "tags" : "smoke";
    default:
      return "smoke";
  }
}
