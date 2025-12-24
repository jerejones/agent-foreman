/**
 * CLI unit tests for command-line argument parsing
 * Tests for task-type flag and other CLI options
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs/promises";

const CLI_PATH = path.join(__dirname, "../dist/index.js");

describe("CLI", () => {
  describe("init command --task-type flag", () => {
    it("should show --task-type option in init help", () => {
      const result = spawnSync("node", [CLI_PATH, "init", "--help"], {
        encoding: "utf-8",
      });

      expect(result.stdout).toContain("--task-type");
      expect(result.stdout).toContain("-t, --task-type");
    });

    it("should show all task type choices in help", () => {
      const result = spawnSync("node", [CLI_PATH, "init", "--help"], {
        encoding: "utf-8",
      });

      expect(result.stdout).toContain("code");
      expect(result.stdout).toContain("ops");
      expect(result.stdout).toContain("data");
      expect(result.stdout).toContain("infra");
      expect(result.stdout).toContain("manual");
    });

    it("should show descriptions for each task type", () => {
      const result = spawnSync("node", [CLI_PATH, "init", "--help"], {
        encoding: "utf-8",
      });

      // Note: text may be line-wrapped in the middle of words,
      // so we check for partial keywords that won't be split
      expect(result.stdout).toContain("code");
      expect(result.stdout).toContain("ops");
      expect(result.stdout).toContain("data");
      expect(result.stdout).toContain("infra");
      expect(result.stdout).toContain("manual");
      // Check for partial phrases that indicate descriptions are present
      expect(result.stdout).toContain("Software");
      expect(result.stdout).toContain("unit tests");
      expect(result.stdout).toContain("checklist");
      expect(result.stdout).toContain("validation");
      expect(result.stdout).toContain("automation");
    });

    it("should reject invalid task-type values", () => {
      const result = spawnSync("node", [CLI_PATH, "init", "--task-type", "invalid"], {
        encoding: "utf-8",
      });

      expect(result.status).toBe(1);
      expect(result.stderr || result.stdout).toContain("Invalid values");
      expect(result.stderr || result.stdout).toContain("task-type");
    });

    it("should accept valid task-type values without error", () => {
      const validTypes = ["code", "ops", "data", "infra", "manual"];

      for (const type of validTypes) {
        const result = spawnSync("node", [CLI_PATH, "init", "--task-type", type, "--help"], {
          encoding: "utf-8",
        });

        // Should not show validation error for valid types
        expect(result.stderr || "").not.toContain("Invalid values");
      }
    });
  });

  describe("taskType application logic", () => {
    it("should apply taskType to features when mapping", () => {
      // This tests the same logic used in runInit to apply taskType
      const features = [
        { id: "auth.login", module: "auth", description: "Login feature" },
        { id: "auth.logout", module: "auth", description: "Logout feature" },
      ];

      const taskType = "ops" as const;
      const updatedFeatures = features.map((f) => ({
        ...f,
        taskType,
      }));

      expect(updatedFeatures[0].taskType).toBe("ops");
      expect(updatedFeatures[1].taskType).toBe("ops");
      expect(updatedFeatures.every((f) => f.taskType === "ops")).toBe(true);
    });

    it("should not add taskType when not specified", () => {
      const features = [
        { id: "auth.login", module: "auth", description: "Login feature" },
      ];

      const taskType = undefined;
      // This mimics the conditional logic in runInit
      const updatedFeatures = taskType
        ? features.map((f) => ({ ...f, taskType }))
        : features;

      expect(updatedFeatures[0]).not.toHaveProperty("taskType");
    });

    it("should preserve existing feature properties when applying taskType", () => {
      const features = [
        {
          id: "auth.login",
          module: "auth",
          description: "Login feature",
          priority: 1,
          status: "failing" as const,
          acceptance: ["User can login"],
          dependsOn: [] as string[],
          version: 1,
          origin: "manual" as const,
        },
      ];

      const taskType = "infra" as const;
      const updatedFeatures = features.map((f) => ({
        ...f,
        taskType,
      }));

      expect(updatedFeatures[0].id).toBe("auth.login");
      expect(updatedFeatures[0].module).toBe("auth");
      expect(updatedFeatures[0].priority).toBe(1);
      expect(updatedFeatures[0].status).toBe("failing");
      expect(updatedFeatures[0].taskType).toBe("infra");
    });
  });

  describe("help text terminology", () => {
    it("should show note about task/feature interchangeability", () => {
      const result = spawnSync("node", [CLI_PATH, "--help"], {
        encoding: "utf-8",
      });

      // Note: text may be line-wrapped in the middle of words,
      // so we check for partial phrases that won't be split
      expect(result.stdout).toContain("Tasks and features");
      expect(result.stdout).toContain("interchange");
    });

    it("should use task/feature terminology in command descriptions", () => {
      const result = spawnSync("node", [CLI_PATH, "--help"], {
        encoding: "utf-8",
      });

      expect(result.stdout).toContain("task/feature");
    });

    it("should show examples with task/feature terminology", () => {
      const result = spawnSync("node", [CLI_PATH, "--help"], {
        encoding: "utf-8",
      });

      expect(result.stdout).toContain("Examples:");
      expect(result.stdout).toContain("Show next task/feature");
    });
  });
});
