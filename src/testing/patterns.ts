/**
 * Test file patterns and source-to-test file mapping
 */

import * as path from "node:path";

/**
 * Common test file patterns by framework
 */
export const TEST_PATTERNS: Record<string, string[]> = {
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
