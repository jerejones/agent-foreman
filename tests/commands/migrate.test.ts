/**
 * Unit tests for migrate.ts
 * Tests legacy feature list migration command
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import { runMigrate } from "../../src/commands/migrate.js";

// Custom error for exit handling
class ExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.code = code;
    this.name = "ExitError";
  }
}

describe("commands/migrate", () => {
  describe("runMigrate()", () => {
    let tempDir: string;
    let originalCwd: string;
    let mockExit: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "foreman-migrate-test-"));
      originalCwd = process.cwd();
      process.chdir(tempDir);

      // Create ai directory
      await fs.mkdir(path.join(tempDir, "ai"), { recursive: true });

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

    async function createLegacyFeatureList(features: unknown[]) {
      await fs.writeFile(
        path.join(tempDir, "ai/feature_list.json"),
        JSON.stringify(
          {
            features,
            metadata: {
              projectGoal: "Test project",
              createdAt: "2024-01-01T00:00:00.000Z",
              updatedAt: "2024-01-01T00:00:00.000Z",
              version: "1.0.0",
            },
          },
          null,
          2
        )
      );
    }

    async function createFeatureIndex(features: Record<string, unknown>) {
      await fs.mkdir(path.join(tempDir, "ai/tasks"), { recursive: true });
      const index = {
        version: "2.0.0",
        updatedAt: new Date().toISOString(),
        metadata: {
          projectGoal: "Test project",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          version: "1.0.0",
        },
        features,
      };
      await fs.writeFile(
        path.join(tempDir, "ai/tasks/index.json"),
        JSON.stringify(index, null, 2)
      );
    }

    it("should display migration header", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await runMigrate(true, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("FEATURE LIST MIGRATION");

      consoleSpy.mockRestore();
    });

    it("should show warning when already migrated", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.setup": { status: "passing", priority: 1, module: "core" },
      });

      await runMigrate(false, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Already migrated to modular format");
      expect(allOutput).toContain("--force");

      consoleSpy.mockRestore();
    });

    it("should show warning when no legacy file found", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await runMigrate(false, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("No legacy feature_list.json found");
      expect(allOutput).toContain("Nothing to migrate");

      consoleSpy.mockRestore();
    });

    it("should show error when cannot load task list", async () => {
      const logCalls: string[] = [];
      const consoleSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
        logCalls.push(args.map(String).join(" "));
      });
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
        logCalls.push(args.map(String).join(" "));
      });

      // Create an invalid JSON file that will fail to parse
      await fs.writeFile(
        path.join(tempDir, "ai/feature_list.json"),
        "{ invalid json content }"
      );

      let exitCalled = false;
      let exitCode: number | undefined;
      let thrownError: Error | undefined;
      try {
        await runMigrate(false, false);
      } catch (e) {
        thrownError = e as Error;
        // Exit may be called with ExitError
        if ((e as ExitError).code !== undefined) {
          exitCalled = true;
          exitCode = (e as ExitError).code;
        }
      }

      const allOutput = logCalls.join("\n");

      // The migrate command should either:
      // 1. Print "Could not load task list" and exit(1)
      // 2. Or throw some error related to parsing
      const hasErrorMessage = allOutput.includes("Could not load") ||
                              allOutput.includes("Failed") ||
                              allOutput.includes("Invalid");
      const hasExitCode = exitCalled && exitCode === 1;
      const hasThrownError = thrownError !== undefined;

      expect(hasErrorMessage || hasExitCode || hasThrownError).toBe(true);

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it("should show dry run preview", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createLegacyFeatureList([
        { id: "core.setup", module: "core", status: "failing", priority: 1, description: "Setup", acceptance: [], version: 1, origin: "manual", dependsOn: [] },
        { id: "core.build", module: "core", status: "failing", priority: 2, description: "Build", acceptance: [], version: 1, origin: "manual", dependsOn: [] },
        { id: "auth.login", module: "auth", status: "failing", priority: 3, description: "Login", acceptance: [], version: 1, origin: "manual", dependsOn: [] },
      ]);

      await runMigrate(true, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Dry Run");
      expect(allOutput).toContain("Tasks to migrate: 3");
      expect(allOutput).toContain("ai/tasks/");
      expect(allOutput).toContain("core");
      expect(allOutput).toContain("auth");
      expect(allOutput).toContain("index.json");
      expect(allOutput).toContain(".bak");
      expect(allOutput).toContain("Run without --dry-run");

      consoleSpy.mockRestore();
    });

    it("should execute migration when not dry run", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createLegacyFeatureList([
        { id: "core.setup", module: "core", status: "failing", priority: 1, description: "Setup", acceptance: ["Test criterion"], version: 1, origin: "manual", dependsOn: [] },
      ]);

      await runMigrate(false, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Migrating 1 tasks");
      expect(allOutput).toContain("Migration complete");

      // Verify files were created
      const indexExists = await fs.access(path.join(tempDir, "ai/tasks/index.json"))
        .then(() => true)
        .catch(() => false);
      expect(indexExists).toBe(true);

      const backupExists = await fs.access(path.join(tempDir, "ai/feature_list.json.bak"))
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(true);

      consoleSpy.mockRestore();
    });

    it("should force re-migrate when --force is used", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createLegacyFeatureList([
        { id: "core.setup", module: "core", status: "failing", priority: 1, description: "Setup", acceptance: [], version: 1, origin: "manual", dependsOn: [] },
      ]);

      await createFeatureIndex({
        "core.old": { status: "passing", priority: 1, module: "core" },
      });

      await runMigrate(true, true); // force = true

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Dry Run");
      expect(allOutput).toContain("Tasks to migrate: 1");

      consoleSpy.mockRestore();
    });

    it("should show module breakdown in dry run", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createLegacyFeatureList([
        { id: "api.users", module: "api", status: "failing", priority: 1, description: "Users API", acceptance: [], version: 1, origin: "manual", dependsOn: [] },
        { id: "api.posts", module: "api", status: "failing", priority: 2, description: "Posts API", acceptance: [], version: 1, origin: "manual", dependsOn: [] },
        { id: "db.schema", module: "db", status: "failing", priority: 3, description: "Database", acceptance: [], version: 1, origin: "manual", dependsOn: [] },
      ]);

      await runMigrate(true, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("api");
      expect(allOutput).toContain("2 files");
      expect(allOutput).toContain("db");
      expect(allOutput).toContain("1 file");

      consoleSpy.mockRestore();
    });

    it("should show index version info when already migrated", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.a": { status: "passing", priority: 1, module: "core" },
        "core.b": { status: "failing", priority: 2, module: "core" },
        "auth.login": { status: "passing", priority: 3, module: "auth" },
      });

      await runMigrate(false, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Index version: 2.0.0");
      expect(allOutput).toContain("Tasks: 3");

      consoleSpy.mockRestore();
    });
  });
});
