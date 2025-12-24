/**
 * Unit tests for next.ts
 * Tests next task/feature selection and display
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

import { runNext } from "../../src/commands/next.js";

// Custom error for exit handling
class ExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.code = code;
    this.name = "ExitError";
  }
}

describe("commands/next", () => {
  describe("runNext()", () => {
    let tempDir: string;
    let originalCwd: string;
    let mockExit: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "foreman-next-test-"));
      originalCwd = process.cwd();
      process.chdir(tempDir);

      // Initialize git repo to avoid dirty check issues
      await fs.mkdir(path.join(tempDir, ".git"), { recursive: true });

      // Create ai/tasks directory structure
      await fs.mkdir(path.join(tempDir, "ai/tasks/core"), { recursive: true });

      // Mock process.exit inside each test
      mockExit = vi.spyOn(process, "exit").mockImplementation(((code: number) => {
        throw new ExitError(code);
      }) as () => never);
    });

    afterEach(async () => {
      process.chdir(originalCwd);
      await fs.rm(tempDir, { recursive: true, force: true });
      mockExit.mockRestore();
      vi.clearAllMocks();
    });

    async function createFeatureIndex(
      features: Record<string, unknown>,
      metadata?: Record<string, unknown>
    ) {
      const index = {
        version: "2.0.0",
        updatedAt: new Date().toISOString(),
        metadata: {
          projectGoal: "Test project goal",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-15T12:00:00.000Z",
          version: "1.0.0",
          ...metadata,
        },
        features,
      };
      await fs.writeFile(
        path.join(tempDir, "ai/tasks/index.json"),
        JSON.stringify(index, null, 2)
      );
    }

    async function createFeatureMarkdown(
      module: string,
      id: string,
      content: string
    ) {
      const featureId = id.includes(".") ? id.split(".").slice(1).join(".") : id;
      const filePath = path.join(tempDir, "ai/tasks", module, `${featureId}.md`);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
    }

    it("should show error when no task list exists", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        await runNext(undefined, false, false, true);
      } catch {
        // Expected: process.exit called
      }

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("No task list found");

      consoleSpy.mockRestore();
    });

    it("should output JSON error when no task list exists", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        await runNext(undefined, false, false, true, true);
      } catch {
        // Expected: process.exit called
      }

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain('"error"');
      expect(allOutput).toContain("No task list found");

      consoleSpy.mockRestore();
    });

    it("should show error when task not found", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.setup": {
          status: "passing",
          priority: 1,
          module: "core",
          description: "Setup project",
        },
      });

      await createFeatureMarkdown(
        "core",
        "setup",
        `---
id: core.setup
module: core
priority: 1
status: passing
version: 1
origin: manual
dependsOn: []
---
# Setup project

## Acceptance Criteria
1. Project is setup
`
      );

      try {
        await runNext("nonexistent.task", false, false, true);
      } catch {
        // Expected: process.exit called
      }

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("not found");

      consoleSpy.mockRestore();
    });

    it("should show JSON error when task not found", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.setup": {
          status: "passing",
          priority: 1,
          module: "core",
          description: "Setup project",
        },
      });

      await createFeatureMarkdown(
        "core",
        "setup",
        `---
id: core.setup
module: core
priority: 1
status: passing
version: 1
origin: manual
dependsOn: []
---
# Setup project

## Acceptance Criteria
1. Project is setup
`
      );

      try {
        await runNext("nonexistent.task", false, false, true, true);
      } catch {
        // Expected: process.exit called
      }

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain('"error"');
      expect(allOutput).toContain("not found");

      consoleSpy.mockRestore();
    });

    it("should show completion message when all tasks are passing", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.setup": {
          status: "passing",
          priority: 1,
          module: "core",
          description: "Setup project",
        },
      });

      await createFeatureMarkdown(
        "core",
        "setup",
        `---
id: core.setup
module: core
priority: 1
status: passing
version: 1
origin: manual
dependsOn: []
---
# Setup project

## Acceptance Criteria
1. Project is setup
`
      );

      await runNext(undefined, false, false, true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("All tasks are passing");

      consoleSpy.mockRestore();
    });

    it("should show JSON completion message when all tasks are passing", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.setup": {
          status: "passing",
          priority: 1,
          module: "core",
          description: "Setup project",
        },
      });

      await createFeatureMarkdown(
        "core",
        "setup",
        `---
id: core.setup
module: core
priority: 1
status: passing
version: 1
origin: manual
dependsOn: []
---
# Setup project

## Acceptance Criteria
1. Project is setup
`
      );

      await runNext(undefined, false, false, true, true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain('"complete"');
      expect(allOutput).toContain("true");

      consoleSpy.mockRestore();
    });

    it("should display next failing task in normal mode", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.setup": {
          status: "failing",
          priority: 1,
          module: "core",
          description: "Setup project",
        },
      });

      await createFeatureMarkdown(
        "core",
        "setup",
        `---
id: core.setup
module: core
priority: 1
status: failing
version: 1
origin: manual
dependsOn: []
---
# Setup project

## Acceptance Criteria
1. Project is setup
`
      );

      await runNext(undefined, false, false, true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("core.setup");
      expect(allOutput).toContain("Setup project");

      consoleSpy.mockRestore();
    });

    it("should output feature data in JSON mode", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.setup": {
          status: "failing",
          priority: 1,
          module: "core",
          description: "Setup project",
        },
      });

      await createFeatureMarkdown(
        "core",
        "setup",
        `---
id: core.setup
module: core
priority: 1
status: failing
version: 1
origin: manual
dependsOn: []
---
# Setup project

## Acceptance Criteria
1. Project is setup
`
      );

      await runNext(undefined, false, false, true, true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      const parsed = JSON.parse(allOutput);
      expect(parsed.feature.id).toBe("core.setup");
      expect(parsed.feature.status).toBe("failing");
      expect(parsed.stats.failing).toBe(1);
      expect(parsed.completion).toBe(0);

      consoleSpy.mockRestore();
    });

    it("should output feature info in quiet mode", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.setup": {
          status: "failing",
          priority: 1,
          module: "core",
          description: "Setup project",
        },
      });

      await createFeatureMarkdown(
        "core",
        "setup",
        `---
id: core.setup
module: core
priority: 1
status: failing
version: 1
origin: manual
dependsOn: []
---
# Setup project

## Acceptance Criteria
1. Project is setup
`
      );

      await runNext(undefined, false, false, true, false, true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Task: core.setup");
      expect(allOutput).toContain("Description: Setup project");
      expect(allOutput).toContain("Status: failing");
      expect(allOutput).toContain("Acceptance:");

      consoleSpy.mockRestore();
    });

    it("should prioritize needs_review tasks over failing tasks", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.setup": {
          status: "failing",
          priority: 1,
          module: "core",
          description: "Setup project",
        },
        "core.review": {
          status: "needs_review",
          priority: 2,
          module: "core",
          description: "Review task",
        },
      });

      await createFeatureMarkdown(
        "core",
        "setup",
        `---
id: core.setup
module: core
priority: 1
status: failing
version: 1
origin: manual
dependsOn: []
---
# Setup project

## Acceptance Criteria
1. Project is setup
`
      );

      await createFeatureMarkdown(
        "core",
        "review",
        `---
id: core.review
module: core
priority: 2
status: needs_review
version: 1
origin: manual
dependsOn: []
---
# Review task

## Acceptance Criteria
1. Task is reviewed
`
      );

      await runNext(undefined, false, false, true, false, true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Task: core.review");

      consoleSpy.mockRestore();
    });

    it("should select specific task by ID", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.setup": {
          status: "failing",
          priority: 1,
          module: "core",
          description: "Setup project",
        },
        "core.build": {
          status: "failing",
          priority: 2,
          module: "core",
          description: "Build project",
        },
      });

      await createFeatureMarkdown(
        "core",
        "setup",
        `---
id: core.setup
module: core
priority: 1
status: failing
version: 1
origin: manual
dependsOn: []
---
# Setup project

## Acceptance Criteria
1. Project is setup
`
      );

      await createFeatureMarkdown(
        "core",
        "build",
        `---
id: core.build
module: core
priority: 2
status: failing
version: 1
origin: manual
dependsOn: []
---
# Build project

## Acceptance Criteria
1. Project builds
`
      );

      await runNext("core.build", false, false, true, false, true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Task: core.build");
      expect(allOutput).toContain("Build project");

      consoleSpy.mockRestore();
    });
  });
});
