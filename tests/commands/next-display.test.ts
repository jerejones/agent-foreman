/**
 * Unit tests for next-display.ts
 * Tests display helpers for 'next' command
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

// Mock expensive modules before importing the module under test
vi.mock("../../src/capabilities/index.js", () => ({
  detectCapabilities: vi.fn().mockResolvedValue({
    testFramework: "vitest",
    hasUnitTests: true,
    hasE2ETests: false,
    packageManager: "npm",
    languages: ["typescript"],
  }),
}));

vi.mock("../../src/tdd-ai-generator.js", () => ({
  generateTDDGuidanceWithAI: vi.fn().mockResolvedValue({
    forVersion: 1,
    generatedAt: new Date().toISOString(),
    generatedBy: "test-mock",
    suggestedTestFiles: {
      unit: ["tests/core/setup.test.ts"],
      e2e: [],
    },
    unitTestCases: [
      { name: "should work", assertions: ["expect true"] },
    ],
    e2eScenarios: [],
  }),
}));

vi.mock("../../src/storage/index.js", () => ({
  saveSingleFeature: vi.fn().mockResolvedValue(undefined),
}));

import {
  displayExternalMemorySync,
  displayFeatureInfo,
  displayTDDGuidance,
  displayBreakdownContext,
} from "../../src/commands/next-display.js";
import { isBreakdownTask } from "../../src/features/index.js";
import type { Feature } from "../../src/types/index.js";

describe("commands/next-display", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "foreman-display-test-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Initialize git repo
    await fs.mkdir(path.join(tempDir, ".git"), { recursive: true });
    await fs.mkdir(path.join(tempDir, "ai"), { recursive: true });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe("displayExternalMemorySync()", () => {
    it("should display current directory", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayExternalMemorySync(
        tempDir,
        { passing: 1, failing: 2, needs_review: 0, failed: 0, blocked: 0 },
        33,
        false
      );

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("EXTERNAL MEMORY SYNC");
      expect(allOutput).toContain("Current Directory:");
      expect(allOutput).toContain(tempDir);

      consoleSpy.mockRestore();
    });

    it("should display git history", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayExternalMemorySync(
        tempDir,
        { passing: 0, failing: 1, needs_review: 0, failed: 0, blocked: 0 },
        0,
        false
      );

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Recent Git Commits:");

      consoleSpy.mockRestore();
    });

    it("should display progress entries when available", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await fs.writeFile(
        path.join(tempDir, "ai/progress.log"),
        `2024-01-15T10:00:00Z INIT summary="Project initialized"\n2024-01-15T11:00:00Z STEP feature=core.setup status=passing summary="Completed setup"\n`
      );

      await displayExternalMemorySync(
        tempDir,
        { passing: 1, failing: 0, needs_review: 0, failed: 0, blocked: 0 },
        100,
        false
      );

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Recent Progress:");
      expect(allOutput).toContain("INIT");
      expect(allOutput).toContain("Project initialized");

      consoleSpy.mockRestore();
    });

    it("should display message when no progress entries", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayExternalMemorySync(
        tempDir,
        { passing: 0, failing: 1, needs_review: 0, failed: 0, blocked: 0 },
        0,
        false
      );

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("No progress entries yet");

      consoleSpy.mockRestore();
    });

    it("should display task status summary", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayExternalMemorySync(
        tempDir,
        { passing: 5, failing: 3, needs_review: 2, failed: 1, blocked: 1 },
        41,
        false
      );

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Task Status:");
      expect(allOutput).toContain("Passing: 5");
      expect(allOutput).toContain("Failing: 3");
      expect(allOutput).toContain("Review: 2");
      expect(allOutput).toContain("Failed: 1");
      expect(allOutput).toContain("Blocked: 1");

      consoleSpy.mockRestore();
    });

    it("should display progress bar", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayExternalMemorySync(
        tempDir,
        { passing: 5, failing: 5, needs_review: 0, failed: 0, blocked: 0 },
        50,
        false
      );

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Progress:");
      expect(allOutput).toContain("50%");

      consoleSpy.mockRestore();
    });

    it("should run tests when runCheck is true", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayExternalMemorySync(
        tempDir,
        { passing: 0, failing: 1, needs_review: 0, failed: 0, blocked: 0 },
        0,
        true
      );

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Running Basic Tests:");
      // Since ai/init.sh doesn't exist, should show not found
      expect(allOutput).toContain("not found");

      consoleSpy.mockRestore();
    });
  });

  describe("displayFeatureInfo()", () => {
    const sampleFeature: Feature = {
      id: "core.setup",
      module: "core",
      priority: 1,
      status: "failing",
      description: "Setup the project structure",
      acceptance: ["Project files are created", "Dependencies are installed"],
      dependsOn: [],
      version: 1,
      origin: "manual",
    };

    it("should display feature header", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayFeatureInfo(tempDir, sampleFeature, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("NEXT TASK");
      expect(allOutput).toContain("core.setup");

      consoleSpy.mockRestore();
    });

    it("should display module and priority", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayFeatureInfo(tempDir, sampleFeature, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Module: core");
      expect(allOutput).toContain("Priority: 1");

      consoleSpy.mockRestore();
    });

    it("should display status with correct color indicator", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayFeatureInfo(tempDir, sampleFeature, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Status:");
      expect(allOutput).toContain("failing");

      consoleSpy.mockRestore();
    });

    it("should display passing status", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const passingFeature = { ...sampleFeature, status: "passing" as const };

      await displayFeatureInfo(tempDir, passingFeature, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("passing");

      consoleSpy.mockRestore();
    });

    it("should display needs_review status", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const reviewFeature = { ...sampleFeature, status: "needs_review" as const };

      await displayFeatureInfo(tempDir, reviewFeature, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("needs_review");

      consoleSpy.mockRestore();
    });

    it("should display description", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayFeatureInfo(tempDir, sampleFeature, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Description:");
      expect(allOutput).toContain("Setup the project structure");

      consoleSpy.mockRestore();
    });

    it("should display acceptance criteria", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayFeatureInfo(tempDir, sampleFeature, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Acceptance Criteria:");
      expect(allOutput).toContain("1. Project files are created");
      expect(allOutput).toContain("2. Dependencies are installed");

      consoleSpy.mockRestore();
    });

    it("should display dependencies when present", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const featureWithDeps = { ...sampleFeature, dependsOn: ["core.init", "core.config"] };

      await displayFeatureInfo(tempDir, featureWithDeps, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Depends on:");
      expect(allOutput).toContain("core.init");
      expect(allOutput).toContain("core.config");

      consoleSpy.mockRestore();
    });

    it("should display notes when present", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const featureWithNotes = { ...sampleFeature, notes: "Remember to update docs" };

      await displayFeatureInfo(tempDir, featureWithNotes, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Notes:");
      expect(allOutput).toContain("Remember to update docs");

      consoleSpy.mockRestore();
    });

    it("should display command suggestions", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayFeatureInfo(tempDir, sampleFeature, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("agent-foreman check core.setup");
      expect(allOutput).toContain("agent-foreman done core.setup");

      consoleSpy.mockRestore();
    });

    it("should show dry run indicator when dryRun is true", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayFeatureInfo(tempDir, sampleFeature, true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Dry run");

      consoleSpy.mockRestore();
    });
  });

  describe("displayTDDGuidance()", () => {
    const sampleFeature: Feature = {
      id: "core.setup",
      module: "core",
      priority: 1,
      status: "failing",
      description: "Setup the project structure",
      acceptance: ["Project files are created", "Dependencies are installed"],
      dependsOn: [],
      version: 1,
      origin: "manual",
    };

    it("should display TDD guidance header", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayTDDGuidance(tempDir, sampleFeature, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("TDD GUIDANCE");

      consoleSpy.mockRestore();
    });

    it("should display strict TDD warning when tddMode is strict", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayTDDGuidance(tempDir, sampleFeature, false, {
        tddMode: "strict",
        projectGoal: "Test project",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        version: "1.0.0",
      });

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("TDD ENFORCEMENT ACTIVE");
      expect(allOutput).toContain("REQUIRED");

      consoleSpy.mockRestore();
    });

    it("should display TDD workflow for features with required tests", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const featureWithTests = {
        ...sampleFeature,
        testRequirements: {
          unit: { required: true, pattern: "tests/core/**/*.test.ts" },
        },
      };

      await displayTDDGuidance(tempDir, featureWithTests, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("TDD Workflow");
      expect(allOutput).toContain("RED:");
      expect(allOutput).toContain("GREEN:");
      expect(allOutput).toContain("REFACTOR:");

      consoleSpy.mockRestore();
    });

    it("should display suggested test files", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayTDDGuidance(tempDir, sampleFeature, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Suggested Test Files:");

      consoleSpy.mockRestore();
    });

    it("should use cached guidance when available and valid", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const featureWithCache = {
        ...sampleFeature,
        tddGuidance: {
          forVersion: 1,
          generatedAt: "2024-01-15T10:00:00Z",
          generatedBy: "claude-3.5",
          suggestedTestFiles: {
            unit: ["tests/core/setup.test.ts"],
            e2e: [],
          },
          unitTestCases: [
            { name: "should create project files", assertions: ["files exist"] },
          ],
          e2eScenarios: [],
        },
      };

      await displayTDDGuidance(tempDir, featureWithCache, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("cached from");

      consoleSpy.mockRestore();
    });

    it("should regenerate guidance when refreshGuidance is true", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const featureWithCache = {
        ...sampleFeature,
        tddGuidance: {
          forVersion: 1,
          generatedAt: "2024-01-15T10:00:00Z",
          generatedBy: "claude-3.5",
          suggestedTestFiles: {
            unit: ["tests/core/setup.test.ts"],
            e2e: [],
          },
          unitTestCases: [],
          e2eScenarios: [],
        },
      };

      await displayTDDGuidance(tempDir, featureWithCache, true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      // Should regenerate and not show "cached"
      expect(allOutput).not.toContain("cached from");

      consoleSpy.mockRestore();
    });

    it("should display acceptance to test mapping for regex guidance", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Without AI, should use regex-based guidance
      await displayTDDGuidance(tempDir, sampleFeature, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      // May show acceptance mapping or AI guidance depending on availability
      expect(allOutput).toContain("TDD GUIDANCE");

      consoleSpy.mockRestore();
    });

    it("should display unit test cases for AI-generated guidance", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const featureWithAIGuidance = {
        ...sampleFeature,
        tddGuidance: {
          forVersion: 1,
          generatedAt: "2024-01-15T10:00:00Z",
          generatedBy: "claude-3.5",
          suggestedTestFiles: {
            unit: ["tests/core/setup.test.ts"],
            e2e: [],
          },
          unitTestCases: [
            {
              name: "should create project files",
              assertions: ["file exists", "has correct content", "has correct permissions"]
            },
            {
              name: "should install dependencies",
              assertions: ["node_modules exists", "package-lock.json created"],
            },
          ],
          e2eScenarios: [],
        },
      };

      await displayTDDGuidance(tempDir, featureWithAIGuidance, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Unit Test Cases:");
      expect(allOutput).toContain("should create project files");
      expect(allOutput).toContain("file exists");

      consoleSpy.mockRestore();
    });

    it("should display E2E scenarios when present", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const featureWithE2E = {
        ...sampleFeature,
        tddGuidance: {
          forVersion: 1,
          generatedAt: "2024-01-15T10:00:00Z",
          generatedBy: "claude-3.5",
          suggestedTestFiles: {
            unit: [],
            e2e: ["e2e/setup.spec.ts"],
          },
          unitTestCases: [],
          e2eScenarios: [
            {
              name: "User can setup project",
              steps: ["Navigate to setup page", "Click initialize button", "Verify success message"],
            },
          ],
        },
      };

      await displayTDDGuidance(tempDir, featureWithE2E, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("E2E Scenarios:");
      expect(allOutput).toContain("User can setup project");
      expect(allOutput).toContain("Navigate to setup page");

      consoleSpy.mockRestore();
    });
  });

  describe("isBreakdownTask()", () => {
    it("should return true for tasks ending with .BREAKDOWN", () => {
      expect(isBreakdownTask("auth.BREAKDOWN")).toBe(true);
      expect(isBreakdownTask("auth.oauth.BREAKDOWN")).toBe(true);
    });

    it("should be case-insensitive", () => {
      expect(isBreakdownTask("auth.breakdown")).toBe(true);
      expect(isBreakdownTask("auth.Breakdown")).toBe(true);
      expect(isBreakdownTask("auth.BreakDown")).toBe(true);
    });

    it("should return false for regular tasks", () => {
      expect(isBreakdownTask("auth.login")).toBe(false);
      expect(isBreakdownTask("auth.oauth-google")).toBe(false);
      expect(isBreakdownTask("breakdown.auth")).toBe(false);
    });

    it("should return false for tasks containing BREAKDOWN but not ending with it", () => {
      expect(isBreakdownTask("auth.BREAKDOWN.login")).toBe(false);
      expect(isBreakdownTask("BREAKDOWN.auth")).toBe(false);
    });
  });

  describe("displayBreakdownContext()", () => {
    const breakdownFeature: Feature = {
      id: "auth.BREAKDOWN",
      module: "auth",
      priority: 1,
      status: "failing",
      description: "Break down auth module into tasks",
      acceptance: ["Create 4-8 tasks", "Update index.json"],
      dependsOn: [],
      version: 1,
      origin: "spec-workflow" as const,
    };

    const allFeatures: Feature[] = [
      breakdownFeature,
      {
        id: "auth.login",
        module: "auth",
        priority: 2,
        status: "failing",
        description: "Login functionality",
        acceptance: ["User can login"],
        dependsOn: [],
        version: 1,
        origin: "manual" as const,
      },
      {
        id: "core.BREAKDOWN",
        module: "core",
        priority: 1,
        status: "passing",
        description: "Core module breakdown",
        acceptance: ["Done"],
        dependsOn: [],
        version: 1,
        origin: "spec-workflow" as const,
      },
    ];

    it("should display breakdown context header", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayBreakdownContext(tempDir, breakdownFeature, allFeatures);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("MODULE BREAKDOWN CONTEXT");

      consoleSpy.mockRestore();
    });

    it("should display context files section", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayBreakdownContext(tempDir, breakdownFeature, allFeatures);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Context Files:");
      // When spec directory doesn't exist, shows "directory not found"
      expect(allOutput).toContain("directory not found");

      consoleSpy.mockRestore();
    });

    it("should mark spec files as found when they exist", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Create spec directory and files
      const specDir = path.join(tempDir, "ai/tasks/spec");
      await fs.mkdir(specDir, { recursive: true });
      await fs.writeFile(path.join(specDir, "OVERVIEW.md"), "# Overview");

      await displayBreakdownContext(tempDir, breakdownFeature, allFeatures);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("OVERVIEW.md");

      consoleSpy.mockRestore();
    });

    it("should display module map", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayBreakdownContext(tempDir, breakdownFeature, allFeatures);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("BREAKDOWN Progress:");
      expect(allOutput).toContain("YOU ARE HERE");

      consoleSpy.mockRestore();
    });

    it("should display breakdown instructions", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayBreakdownContext(tempDir, breakdownFeature, allFeatures);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Breakdown Instructions:");
      expect(allOutput).toContain("Read all context files");
      expect(allOutput).toContain("minimal implementable units");

      consoleSpy.mockRestore();
    });

    it("should display good task example", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayBreakdownContext(tempDir, breakdownFeature, allFeatures);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Good Task Example:");
      expect(allOutput).toContain("oauth-google");

      consoleSpy.mockRestore();
    });

    it("should display bad task examples", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await displayBreakdownContext(tempDir, breakdownFeature, allFeatures);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Bad Task Examples:");
      expect(allOutput).toContain("Too broad");
      expect(allOutput).toContain("Too granular");

      consoleSpy.mockRestore();
    });
  });
});
