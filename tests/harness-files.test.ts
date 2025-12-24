/**
 * Tests for harness-files.ts module
 * Tests the refactored atomic functions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import type { InitContext } from "../src/init/harness-files.js";
import type { FeatureList, InitMode } from "../src/types/index.js";
import type { ProjectSurvey } from "../src/types/survey.js";

// Create a minimal survey for testing
function createMockSurvey(): ProjectSurvey {
  return {
    techStack: {
      language: "typescript",
      framework: "node",
      buildTool: "tsc",
      testFramework: "vitest",
      packageManager: "npm",
    },
    structure: {
      entryPoints: ["src/index.ts"],
      srcDirs: ["src"],
      testDirs: ["tests"],
      configFiles: ["tsconfig.json"],
    },
    modules: [],
    features: [],
    completion: {
      overall: 0,
      byModule: {},
      notes: [],
    },
    commands: {
      install: "npm install",
      dev: "npm run dev",
      build: "npm run build",
      test: "npm test",
    },
  };
}

// Create a minimal feature list for testing
function createMockFeatureList(): FeatureList {
  return {
    features: [
      {
        id: "test.feature",
        description: "Test feature",
        module: "test",
        priority: 1,
        status: "failing",
        acceptance: ["Test passes"],
        dependsOn: [],
        supersedes: [],
        tags: [],
        version: 1,
        origin: "manual",
        notes: "",
      },
    ],
    metadata: {
      projectGoal: "Test project",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
    },
  };
}

// Create a test context
function createMockContext(
  cwd: string,
  mode: InitMode = "new"
): InitContext {
  return {
    cwd,
    goal: "Test project goal",
    mode,
    survey: createMockSurvey(),
    featureList: createMockFeatureList(),
  };
}

describe("InitContext", () => {
  it("should have all required properties", () => {
    const ctx = createMockContext("/tmp/test");

    expect(ctx.cwd).toBe("/tmp/test");
    expect(ctx.goal).toBe("Test project goal");
    expect(ctx.mode).toBe("new");
    expect(ctx.survey).toBeDefined();
    expect(ctx.featureList).toBeDefined();
    expect(ctx.capabilities).toBeUndefined();
  });

  it("should allow capabilities to be set", () => {
    const ctx = createMockContext("/tmp/test");
    ctx.capabilities = {
      testCommand: "npm test",
      hasTests: true,
    } as any;

    expect(ctx.capabilities).toBeDefined();
    expect(ctx.capabilities?.testCommand).toBe("npm test");
  });
});

describe("harness-files integration", () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = path.join(tmpdir(), `harness-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create minimal project structure
    await fs.writeFile(
      path.join(testDir, "package.json"),
      JSON.stringify({ name: "test-project", version: "1.0.0" })
    );
  });

  afterEach(async () => {
    // Clean up
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("generateGitignore", () => {
    it("should be importable and callable", async () => {
      const { generateGitignore } = await import("../src/init/harness-files.js");
      expect(typeof generateGitignore).toBe("function");
    });
  });

  describe("generateProgressLog", () => {
    it("should be importable and callable", async () => {
      const { generateProgressLog } = await import("../src/init/harness-files.js");
      expect(typeof generateProgressLog).toBe("function");
    });

    it("should not create log in scan mode", async () => {
      const { generateProgressLog } = await import("../src/init/harness-files.js");
      const ctx = createMockContext(testDir, "scan");

      await generateProgressLog(ctx);

      // Verify no progress log was created
      const logPath = path.join(testDir, "ai/progress.log");
      await expect(fs.access(logPath)).rejects.toThrow();
    });
  });

  describe("showGitSuggestion", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should show git suggestion in new mode", async () => {
      const { showGitSuggestion } = await import("../src/init/harness-files.js");
      const ctx = createMockContext(testDir, "new");

      showGitSuggestion(ctx);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("git"));
    });

    it("should not show git suggestion in scan mode", async () => {
      const { showGitSuggestion } = await import("../src/init/harness-files.js");
      const ctx = createMockContext(testDir, "scan");

      showGitSuggestion(ctx);

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe("generateClaudeRules", () => {
    it("should be importable and callable", async () => {
      const { generateClaudeRules } = await import("../src/init/harness-files.js");
      expect(typeof generateClaudeRules).toBe("function");
    });
  });
});

describe("module exports", () => {
  it("should export all atomic functions", async () => {
    const harnessFiles = await import("../src/init/harness-files.js");

    expect(harnessFiles.generateHarnessFiles).toBeDefined();
    expect(harnessFiles.generateCapabilities).toBeDefined();
    expect(harnessFiles.generateGitignore).toBeDefined();
    expect(harnessFiles.generateInitScript).toBeDefined();
    expect(harnessFiles.generateClaudeRules).toBeDefined();
    expect(harnessFiles.generateProgressLog).toBeDefined();
    expect(harnessFiles.showGitSuggestion).toBeDefined();
  });

  it("should export InitContext type through index", async () => {
    const initModule = await import("../src/init/index.js");

    // Type exports don't exist at runtime, but the module should have the function exports
    expect(initModule.generateHarnessFiles).toBeDefined();
    expect(initModule.generateCapabilities).toBeDefined();
  });
});
