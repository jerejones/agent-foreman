/**
 * Unit tests for tdd.ts
 * Tests TDD mode configuration command
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { runTDD } from "../../src/commands/tdd.js";

// Custom error for exit handling
class ExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.code = code;
    this.name = "ExitError";
  }
}

describe("commands/tdd", () => {
  describe("runTDD()", () => {
    let tempDir: string;
    let originalCwd: string;
    let mockExit: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      const rawTempDir = await fs.mkdtemp(path.join(os.tmpdir(), "foreman-tdd-test-"));
      tempDir = fsSync.realpathSync(rawTempDir); // Resolve symlinks (macOS /var -> /private/var)
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

    async function createFeatureList(metadata?: Record<string, unknown>) {
      await fs.writeFile(
        path.join(tempDir, "ai/feature_list.json"),
        JSON.stringify(
          {
            features: [],
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

    it("should show error when no task list exists", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        await runTDD();
      } catch {
        // Expected: process.exit called
      }

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("No task list found");
      expect(mockExit).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
    });

    it("should show current TDD mode when no argument provided", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList({ tddMode: "recommended" });

      await runTDD();

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("TDD Configuration");
      expect(allOutput).toContain("Current mode");
      expect(allOutput).toContain("Available modes");
      expect(allOutput).toContain("strict");
      expect(allOutput).toContain("recommended");
      expect(allOutput).toContain("disabled");
      expect(mockExit).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should default to recommended when no tddMode in metadata", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList(); // No tddMode specified

      await runTDD();

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Current mode");
      // The default is recommended
      expect(mockExit).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should show error for invalid TDD mode", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList();

      try {
        await runTDD("invalid");
      } catch {
        // Expected: process.exit called
      }

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Invalid TDD mode");
      expect(allOutput).toContain("invalid");
      expect(mockExit).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
    });

    it("should change TDD mode to strict", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList({ tddMode: "recommended" });

      await runTDD("strict");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("TDD mode changed");
      expect(allOutput).toContain("STRICT MODE ACTIVE");
      expect(allOutput).toContain("Tests are REQUIRED");
      expect(mockExit).not.toHaveBeenCalled();

      // Verify modular index was updated (auto-migration creates ai/tasks/index.json)
      const updatedContent = await fs.readFile(
        path.join(tempDir, "ai/tasks/index.json"),
        "utf-8"
      );
      const updated = JSON.parse(updatedContent);
      expect(updated.metadata.tddMode).toBe("strict");

      consoleSpy.mockRestore();
    });

    it("should change TDD mode to recommended", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList({ tddMode: "strict" });

      await runTDD("recommended");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("TDD mode changed");
      expect(allOutput).toContain("RECOMMENDED MODE");
      expect(allOutput).toContain("Tests are suggested");
      expect(mockExit).not.toHaveBeenCalled();

      // Verify modular index was updated (auto-migration creates ai/tasks/index.json)
      const updatedContent = await fs.readFile(
        path.join(tempDir, "ai/tasks/index.json"),
        "utf-8"
      );
      const updated = JSON.parse(updatedContent);
      expect(updated.metadata.tddMode).toBe("recommended");

      consoleSpy.mockRestore();
    });

    it("should change TDD mode to disabled", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList({ tddMode: "recommended" });

      await runTDD("disabled");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("TDD mode changed");
      expect(allOutput).toContain("TDD DISABLED");
      expect(allOutput).toContain("No TDD guidance shown");
      expect(mockExit).not.toHaveBeenCalled();

      // Verify modular index was updated (auto-migration creates ai/tasks/index.json)
      const updatedContent = await fs.readFile(
        path.join(tempDir, "ai/tasks/index.json"),
        "utf-8"
      );
      const updated = JSON.parse(updatedContent);
      expect(updated.metadata.tddMode).toBe("disabled");

      consoleSpy.mockRestore();
    });

    it("should show warning when mode is already set", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList({ tddMode: "strict" });

      await runTDD("strict");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("already 'strict'");
      expect(mockExit).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should update progress log when mode changes", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList({ tddMode: "recommended" });
      await fs.writeFile(path.join(tempDir, "ai/progress.log"), "");

      await runTDD("strict");

      expect(mockExit).not.toHaveBeenCalled();

      // Check that progress.log was updated
      const progressLog = await fs.readFile(
        path.join(tempDir, "ai/progress.log"),
        "utf-8"
      );
      expect(progressLog).toContain("CHANGE");
      expect(progressLog).toContain("tdd-mode");
      expect(progressLog).toContain("recommended");
      expect(progressLog).toContain("strict");

      consoleSpy.mockRestore();
    });

    it("should update updatedAt timestamp when mode changes", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const originalDate = "2024-01-15T12:00:00.000Z";
      await createFeatureList({ tddMode: "recommended", updatedAt: originalDate });

      await runTDD("strict");

      // Verify updatedAt was changed (auto-migration creates ai/tasks/index.json)
      const updatedContent = await fs.readFile(
        path.join(tempDir, "ai/tasks/index.json"),
        "utf-8"
      );
      const updated = JSON.parse(updatedContent);
      expect(updated.metadata.updatedAt).not.toBe(originalDate);

      consoleSpy.mockRestore();
    });
  });
});
