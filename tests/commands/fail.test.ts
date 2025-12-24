/**
 * Unit tests for fail.ts
 * Tests task/feature failure marking command
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { runFail } from "../../src/commands/fail.js";

// Custom error for exit handling
class ExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.code = code;
    this.name = "ExitError";
  }
}

describe("commands/fail", () => {
  describe("runFail()", () => {
    let tempDir: string;
    let originalCwd: string;
    let mockExit: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      const rawTempDir = await fs.mkdtemp(path.join(os.tmpdir(), "foreman-fail-test-"));
      tempDir = fsSync.realpathSync(rawTempDir); // Resolve symlinks (macOS /var -> /private/var)
      originalCwd = process.cwd();
      process.chdir(tempDir);

      // Create ai/tasks directory
      await fs.mkdir(path.join(tempDir, "ai/tasks/core"), { recursive: true });

      // Mock process.exit
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

    async function createFeatureList(features: unknown[], metadata?: Record<string, unknown>) {
      await fs.mkdir(path.join(tempDir, "ai"), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, "ai/feature_list.json"),
        JSON.stringify(
          {
            features,
            metadata: {
              projectGoal: "Test project goal",
              createdAt: "2024-01-01T00:00:00.000Z",
              updatedAt: "2024-01-15T12:00:00.000Z",
              version: "1.0.0",
              ...metadata,
            },
          },
          null,
          2
        )
      );
    }

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
        await runFail("some.task");
      } catch {
        // Expected: process.exit called
      }

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("No task list found");
      expect(mockExit).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
    });

    it("should show error when task not found", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList([
        {
          id: "core.setup",
          module: "core",
          priority: 1,
          status: "failing",
          description: "Setup project",
          acceptance: ["Project is setup"],
          version: 1,
          origin: "manual",
          dependsOn: [],
        },
      ]);

      try {
        await runFail("nonexistent.task");
      } catch {
        // Expected: process.exit called
      }

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("not found");
      expect(mockExit).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
    });

    it("should warn when task is already failed", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList([
        {
          id: "core.setup",
          module: "core",
          priority: 1,
          status: "failed",
          description: "Setup project",
          acceptance: ["Project is setup"],
          version: 1,
          origin: "manual",
          dependsOn: [],
          notes: "Previous failure reason",
        },
      ]);

      try {
        await runFail("core.setup", "New reason");
      } catch {
        // Expected: process.exit called with code 0
      }

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("already marked as failed");
      expect(allOutput).toContain("Previous reason");
      expect(mockExit).toHaveBeenCalledWith(0);

      consoleSpy.mockRestore();
    });

    it("should mark task as failed with reason", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList([
        {
          id: "core.setup",
          module: "core",
          priority: 1,
          status: "failing",
          description: "Setup project",
          acceptance: ["Project is setup"],
          version: 1,
          origin: "manual",
          dependsOn: [],
        },
      ]);

      await runFail("core.setup", "Tests timeout after 30 seconds", false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Marked 'core.setup' as failed");
      expect(allOutput).toContain("Reason: Tests timeout after 30 seconds");

      // Check that the markdown file was updated
      const mdContent = await fs.readFile(
        path.join(tempDir, "ai/tasks/core/setup.md"),
        "utf-8"
      );
      expect(mdContent).toContain("status: failed");
      expect(mdContent).toContain("Verification failed: Tests timeout after 30 seconds");

      consoleSpy.mockRestore();
    });

    it("should mark task as failed without reason", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList([
        {
          id: "core.setup",
          module: "core",
          priority: 1,
          status: "failing",
          description: "Setup project",
          acceptance: ["Project is setup"],
          version: 1,
          origin: "manual",
          dependsOn: [],
        },
      ]);

      await runFail("core.setup", undefined, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Marked 'core.setup' as failed");
      expect(allOutput).not.toContain("Reason:");

      consoleSpy.mockRestore();
    });

    it("should preserve existing notes when no reason provided", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList([
        {
          id: "core.setup",
          module: "core",
          priority: 1,
          status: "failing",
          description: "Setup project",
          acceptance: ["Project is setup"],
          version: 1,
          origin: "manual",
          dependsOn: [],
          notes: "Some existing notes",
        },
      ]);

      await runFail("core.setup", undefined, false);

      // Check that the markdown file contains both existing notes and failure marker
      const mdContent = await fs.readFile(
        path.join(tempDir, "ai/tasks/core/setup.md"),
        "utf-8"
      );
      expect(mdContent).toContain("Some existing notes | Marked as failed");

      consoleSpy.mockRestore();
    });

    it("should update progress log", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList([
        {
          id: "core.setup",
          module: "core",
          priority: 1,
          status: "failing",
          description: "Setup project",
          acceptance: ["Project is setup"],
          version: 1,
          origin: "manual",
          dependsOn: [],
        },
      ]);

      await runFail("core.setup", "API error", false);

      // Check that progress.log was created/updated
      const progressLogPath = path.join(tempDir, "ai/progress.log");
      const progressContent = await fs.readFile(progressLogPath, "utf-8");
      expect(progressContent).toContain("VERIFY");
      expect(progressContent).toContain("core.setup");
      expect(progressContent).toContain("fail");
      expect(progressContent).toContain("API error");

      consoleSpy.mockRestore();
    });

    it("should show loop mode instructions with next task", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList([
        {
          id: "core.setup",
          module: "core",
          priority: 1,
          status: "failing",
          description: "Setup project",
          acceptance: ["Project is setup"],
          version: 1,
          origin: "manual",
          dependsOn: [],
        },
        {
          id: "core.build",
          module: "core",
          priority: 2,
          status: "failing",
          description: "Build project",
          acceptance: ["Project builds"],
          version: 1,
          origin: "manual",
          dependsOn: [],
        },
      ]);

      await runFail("core.setup", "Test failure", true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("CONTINUE TO NEXT TASK");
      expect(allOutput).toContain("Failed: core.setup");
      expect(allOutput).toContain("Next up: core.build");
      expect(allOutput).toContain("LOOP INSTRUCTION");
      expect(allOutput).toContain("agent-foreman next");

      consoleSpy.mockRestore();
    });

    it("should show no more tasks message when all processed", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Use modular format to ensure proper state
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

      await runFail("core.setup", "Test failure", true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("No more tasks to process");
      expect(allOutput).toContain("agent-foreman status");

      consoleSpy.mockRestore();
    });

    it("should not show loop mode instructions when loopMode is false", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList([
        {
          id: "core.setup",
          module: "core",
          priority: 1,
          status: "failing",
          description: "Setup project",
          acceptance: ["Project is setup"],
          version: 1,
          origin: "manual",
          dependsOn: [],
        },
        {
          id: "core.build",
          module: "core",
          priority: 2,
          status: "failing",
          description: "Build project",
          acceptance: ["Project builds"],
          version: 1,
          origin: "manual",
          dependsOn: [],
        },
      ]);

      await runFail("core.setup", "Test failure", false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Marked 'core.setup' as failed");
      expect(allOutput).not.toContain("CONTINUE TO NEXT TASK");
      expect(allOutput).not.toContain("LOOP INSTRUCTION");

      consoleSpy.mockRestore();
    });

    it("should update feature status via index when using modular storage", async () => {
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

      await runFail("core.setup", "API timeout", false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Marked 'core.setup' as failed");

      // Check that the markdown file was updated
      const mdContent = await fs.readFile(
        path.join(tempDir, "ai/tasks/core/setup.md"),
        "utf-8"
      );
      expect(mdContent).toContain("status: failed");

      // Check that the index was updated
      const indexContent = await fs.readFile(
        path.join(tempDir, "ai/tasks/index.json"),
        "utf-8"
      );
      const index = JSON.parse(indexContent);
      expect(index.features["core.setup"].status).toBe("failed");

      consoleSpy.mockRestore();
    });

    it("should show failed tasks count in loop mode", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Create one already failed task and one failing task
      await createFeatureList([
        {
          id: "core.auth",
          module: "core",
          priority: 1,
          status: "failed",
          description: "Auth module",
          acceptance: ["Auth works"],
          version: 1,
          origin: "manual",
          dependsOn: [],
        },
        {
          id: "core.setup",
          module: "core",
          priority: 2,
          status: "failing",
          description: "Setup project",
          acceptance: ["Project is setup"],
          version: 1,
          origin: "manual",
          dependsOn: [],
        },
        {
          id: "core.build",
          module: "core",
          priority: 3,
          status: "failing",
          description: "Build project",
          acceptance: ["Project builds"],
          version: 1,
          origin: "manual",
          dependsOn: [],
        },
      ]);

      await runFail("core.setup", "Database error", true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      // After marking core.setup as failed, we should have 2 failed tasks
      expect(allOutput).toContain("Failed tasks: 2");

      consoleSpy.mockRestore();
    });
  });
});
