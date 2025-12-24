/**
 * Unit tests for status.ts
 * Tests task/feature status display
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import { runStatus } from "../../src/commands/status.js";

describe("commands/status", () => {
  describe("runStatus()", () => {
    let tempDir: string;
    let originalCwd: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "foreman-status-test-"));
      originalCwd = process.cwd();
      process.chdir(tempDir);

      // Create ai/tasks directory structure
      await fs.mkdir(path.join(tempDir, "ai/tasks/core"), { recursive: true });
    });

    afterEach(async () => {
      process.chdir(originalCwd);
      await fs.rm(tempDir, { recursive: true, force: true });
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

    async function createProgressLog(content: string) {
      await fs.writeFile(path.join(tempDir, "ai/progress.log"), content);
    }

    it("should show error when no task list exists", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await runStatus();

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("No task list found");

      consoleSpy.mockRestore();
    });

    it("should output JSON error when no task list exists and outputJson is true", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await runStatus(true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain('"error"');
      expect(allOutput).toContain("No task list found");

      consoleSpy.mockRestore();
    });

    it("should display project status in normal mode", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.setup": {
          status: "passing",
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

      await runStatus();

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Project Status");
      expect(allOutput).toContain("Test project goal");
      expect(allOutput).toContain("Task Status");
      expect(allOutput).toContain("Passing:");
      expect(allOutput).toContain("Failing:");
      expect(allOutput).toContain("Completion:");

      consoleSpy.mockRestore();
    });

    it("should display next feature", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.setup": {
          status: "failing",
          priority: 1,
          module: "core",
          description: "Setup the project first",
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
# Setup the project first

## Acceptance Criteria
1. Project is setup
`
      );

      await runStatus();

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Next Up");
      expect(allOutput).toContain("core.setup");

      consoleSpy.mockRestore();
    });

    it("should output JSON format when outputJson is true", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.setup": {
          status: "passing",
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

      await runStatus(true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      const parsed = JSON.parse(allOutput);
      expect(parsed.goal).toBe("Test project goal");
      expect(parsed.stats.passing).toBe(1);
      expect(parsed.stats.failing).toBe(1);
      expect(parsed.stats.total).toBe(2);
      expect(parsed.completion).toBe(50);
      expect(parsed.nextFeature).toBeDefined();
      expect(parsed.nextFeature.id).toBe("core.build");

      consoleSpy.mockRestore();
    });

    it("should output minimal info in quiet mode", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.setup": {
          status: "passing",
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

      await runStatus(false, true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("complete");
      expect(allOutput).toContain("passing");
      expect(allOutput).toContain("Next:");
      expect(allOutput).not.toContain("Project Status");
      expect(allOutput).not.toContain("Task Status:");

      consoleSpy.mockRestore();
    });

    it("should display recent activity from progress log", async () => {
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

      await createProgressLog(`# Progress Log

2024-01-15T10:00:00Z INIT summary="Project initialized"
2024-01-15T11:00:00Z STEP feature=core.setup status=passing summary="Completed setup"
`);

      await runStatus();

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Recent Activity");
      expect(allOutput).toContain("INIT");
      expect(allOutput).toContain("STEP");

      consoleSpy.mockRestore();
    });

    it("should calculate correct completion percentage", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.a": { status: "passing", priority: 1, module: "core", description: "A" },
        "core.b": { status: "passing", priority: 2, module: "core", description: "B" },
        "core.c": { status: "passing", priority: 3, module: "core", description: "C" },
        "core.d": { status: "failing", priority: 4, module: "core", description: "D" },
      });

      for (const id of ["a", "b", "c", "d"]) {
        const status = id === "d" ? "failing" : "passing";
        await createFeatureMarkdown(
          "core",
          id,
          `---
id: core.${id}
module: core
priority: ${["a", "b", "c", "d"].indexOf(id) + 1}
status: ${status}
version: 1
origin: manual
dependsOn: []
---
# Feature ${id}

## Acceptance Criteria
1. Criterion
`
        );
      }

      await runStatus(true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      const parsed = JSON.parse(allOutput);
      expect(parsed.completion).toBe(75); // 3 out of 4 passing

      consoleSpy.mockRestore();
    });
  });
});
