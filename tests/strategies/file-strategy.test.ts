/**
 * Tests for FileStrategyExecutor
 * Universal Verification Strategy (UVS) Phase 3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, writeFile, rm, mkdir, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import type { Feature } from "../../src/types.js";
import type { FileVerificationStrategy } from "../../src/verifier/types/index.js";

// Import after setting up temp directory
import { FileStrategyExecutor, fileStrategyExecutor } from "../../src/strategies/file-strategy.js";
import { defaultRegistry } from "../../src/strategy-executor.js";

// Base feature for testing
const baseFeature: Feature = {
  id: "test.feature",
  description: "Test feature",
  module: "test",
  priority: 1,
  status: "failing",
  acceptance: ["Acceptance criterion"],
  dependsOn: [],
  supersedes: [],
  tags: [],
  version: 1,
  origin: "manual",
  notes: "",
};

describe("FileStrategyExecutor", () => {
  let executor: FileStrategyExecutor;
  let tempDir: string;

  beforeEach(async () => {
    executor = new FileStrategyExecutor();
    // Create a temporary directory for tests
    tempDir = await mkdtemp(join(tmpdir(), "file-strategy-test-"));
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
  });

  describe("type property", () => {
    it("should have type 'file'", () => {
      expect(executor.type).toBe("file");
    });
  });

  describe("execute with single path", () => {
    it("should verify file exists", async () => {
      // Create a test file
      const testFile = join(tempDir, "test.txt");
      await writeFile(testFile, "Hello World");

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "test.txt",
        exists: true,
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.filesChecked).toBe(1);
    });

    it("should fail when file does not exist", async () => {
      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "nonexistent.txt",
        exists: true,
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("No files matched");
    });

    it("should verify file does not exist", async () => {
      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "nonexistent.txt",
        exists: false,
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(true);
    });

    it("should fail when file exists but should not", async () => {
      const testFile = join(tempDir, "shouldnt-exist.txt");
      await writeFile(testFile, "content");

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "shouldnt-exist.txt",
        checks: [{ exists: false }],
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("exists but should not");
    });
  });

  describe("execute with glob patterns", () => {
    it("should match files with glob pattern", async () => {
      // Create test files
      await writeFile(join(tempDir, "file1.ts"), "export const a = 1;");
      await writeFile(join(tempDir, "file2.ts"), "export const b = 2;");
      await writeFile(join(tempDir, "file3.js"), "module.exports = {};");

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        paths: ["*.ts"],
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.filesChecked).toBe(2);
    });

    it("should match files in subdirectories with **", async () => {
      // Create subdirectory and files
      const subDir = join(tempDir, "src");
      await mkdir(subDir, { recursive: true });
      await writeFile(join(subDir, "index.ts"), "export {};");
      await writeFile(join(tempDir, "root.ts"), "export {};");

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        paths: ["**/*.ts"],
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.filesChecked).toBe(2);
    });

    it("should combine path and paths", async () => {
      await writeFile(join(tempDir, "main.ts"), "export {};");
      await writeFile(join(tempDir, "index.js"), "module.exports = {};");

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "main.ts",
        paths: ["*.js"],
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.filesChecked).toBe(2);
    });
  });

  describe("content checks", () => {
    it("should verify file contains pattern", async () => {
      const testFile = join(tempDir, "config.json");
      await writeFile(testFile, '{"version": "1.2.3", "name": "test"}');

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "config.json",
        containsPattern: '"version":\\s*"\\d+\\.\\d+\\.\\d+"',
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(true);
    });

    it("should fail when pattern not found", async () => {
      const testFile = join(tempDir, "config.json");
      await writeFile(testFile, '{"name": "test"}');

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "config.json",
        containsPattern: '"version"',
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("Pattern not found");
    });

    it("should verify file matches exact content", async () => {
      const content = "exact content here";
      const testFile = join(tempDir, "exact.txt");
      await writeFile(testFile, content);

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "exact.txt",
        matchesContent: content,
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(true);
    });

    it("should fail when content does not match exactly", async () => {
      const testFile = join(tempDir, "exact.txt");
      await writeFile(testFile, "actual content");

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "exact.txt",
        matchesContent: "expected content",
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("does not match expected");
    });
  });

  describe("size constraint checks", () => {
    it("should verify file size within constraints", async () => {
      const testFile = join(tempDir, "sized.txt");
      await writeFile(testFile, "A".repeat(100)); // 100 bytes

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "sized.txt",
        sizeConstraint: { min: 50, max: 200 },
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(true);
    });

    it("should fail when file is too small", async () => {
      const testFile = join(tempDir, "small.txt");
      await writeFile(testFile, "tiny");

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "small.txt",
        sizeConstraint: { min: 100 },
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("less than minimum");
    });

    it("should fail when file is too large", async () => {
      const testFile = join(tempDir, "large.txt");
      await writeFile(testFile, "X".repeat(1000));

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "large.txt",
        sizeConstraint: { max: 100 },
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("exceeds maximum");
    });
  });

  describe("checks array", () => {
    it("should apply multiple checks from checks array", async () => {
      const testFile = join(tempDir, "multi.txt");
      await writeFile(testFile, "This is valid content with the keyword");

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "multi.txt",
        checks: [
          { exists: true },
          { notEmpty: true },
          { containsPattern: "keyword" },
          { sizeConstraint: { min: 10, max: 1000 } },
        ],
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(true);
    });

    it("should fail when any check in array fails", async () => {
      const testFile = join(tempDir, "partial.txt");
      await writeFile(testFile, "content");

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "partial.txt",
        checks: [
          { exists: true },
          { containsPattern: "missing-word" },
        ],
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(false);
    });

    it("should check notEmpty correctly", async () => {
      const emptyFile = join(tempDir, "empty.txt");
      await writeFile(emptyFile, "");

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "empty.txt",
        checks: [{ notEmpty: true }],
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("empty");
    });
  });

  describe("security validation", () => {
    it("should block path traversal with ..", async () => {
      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "../../../etc/passwd",
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.reason).toBe("security-violation");
    });

    it("should block absolute paths outside project", async () => {
      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "/etc/passwd",
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.reason).toBe("security-violation");
    });

    it("should allow paths with safe .. usage", async () => {
      // Create nested structure
      const subDir = join(tempDir, "src", "utils");
      await mkdir(subDir, { recursive: true });
      await writeFile(join(tempDir, "src", "index.ts"), "export {};");

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        // This starts from src/utils and goes back to src
        paths: ["src/utils/../index.ts"],
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(true);
    });

    it("should block glob patterns that escape project", async () => {
      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        paths: ["../../../**/passwd"],
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.reason).toBe("security-violation");
    });
  });

  describe("permissions check (Unix only)", () => {
    it("should verify file permissions", async () => {
      const testFile = join(tempDir, "script.sh");
      await writeFile(testFile, "#!/bin/bash\necho hello");
      await chmod(testFile, 0o755);

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "script.sh",
        checks: [{ permissions: "755" }],
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(true);
    });

    it("should fail when permissions do not match", async () => {
      const testFile = join(tempDir, "readonly.txt");
      await writeFile(testFile, "content");
      await chmod(testFile, 0o644);

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "readonly.txt",
        checks: [{ permissions: "755" }],
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("do not match expected");
    });
  });

  describe("edge cases", () => {
    it("should fail when no paths specified", async () => {
      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("No paths specified");
    });

    it("should use default exists check when no checks specified", async () => {
      const testFile = join(tempDir, "default.txt");
      await writeFile(testFile, "content");

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "default.txt",
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.success).toBe(true);
    });

    it("should handle multiple paths with mixed results", async () => {
      // Both files exist, but one fails the content check
      await writeFile(join(tempDir, "valid.txt"), "content with keyword");
      await writeFile(join(tempDir, "invalid.txt"), "no match here");

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        paths: ["valid.txt", "invalid.txt"],
        checks: [{ containsPattern: "keyword" }],
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      // One file passes, one fails
      expect(result.success).toBe(false);
      expect(result.details?.results).toHaveLength(2);
      expect(result.output).toContain("1 passed");
      expect(result.output).toContain("1 failed");
    });
  });

  describe("return value details", () => {
    it("should include filesChecked in details", async () => {
      await writeFile(join(tempDir, "a.txt"), "a");
      await writeFile(join(tempDir, "b.txt"), "b");

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        paths: ["*.txt"],
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.details?.filesChecked).toBe(2);
    });

    it("should include patterns in details", async () => {
      await writeFile(join(tempDir, "test.ts"), "export {};");

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "test.ts",
        paths: ["*.js"],
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.details?.patterns).toContain("test.ts");
      expect(result.details?.patterns).toContain("*.js");
    });

    it("should include check results in details", async () => {
      await writeFile(join(tempDir, "detail.txt"), "content here");

      const strategy: FileVerificationStrategy = {
        type: "file",
        required: true,
        path: "detail.txt",
        checks: [{ exists: true }, { containsPattern: "content" }],
      };

      const result = await executor.execute(tempDir, strategy, baseFeature);

      expect(result.details?.results).toBeDefined();
      expect(result.details?.results[0].checks).toHaveLength(2);
    });
  });
});

describe("fileStrategyExecutor singleton", () => {
  it("should be a FileStrategyExecutor instance", () => {
    expect(fileStrategyExecutor).toBeInstanceOf(FileStrategyExecutor);
  });

  it("should have type 'file'", () => {
    expect(fileStrategyExecutor.type).toBe("file");
  });
});

describe("defaultRegistry integration", () => {
  it("should have file executor registered", () => {
    expect(defaultRegistry.has("file")).toBe(true);
  });

  it("should return fileStrategyExecutor for 'file' type", () => {
    const executor = defaultRegistry.get("file");
    expect(executor).toBe(fileStrategyExecutor);
  });
});
