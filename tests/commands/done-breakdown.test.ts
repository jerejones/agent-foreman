/**
 * Unit tests for done-breakdown.ts
 * Tests BREAKDOWN task completion verification
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import {
  verifyBreakdownCompletion,
  displayBreakdownResult,
  type BreakdownVerificationResult,
} from "../../src/commands/done-breakdown.js";
import type { Feature, FeatureList } from "../../src/types/index.js";

describe("commands/done-breakdown", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "foreman-breakdown-test-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Initialize basic structure
    await fs.mkdir(path.join(tempDir, "ai/tasks"), { recursive: true });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  const createBreakdownFeature = (): Feature => ({
    id: "auth.BREAKDOWN",
    module: "auth",
    priority: 1,
    status: "failing",
    description: "Break down auth module into tasks",
    acceptance: ["Create 4-8 tasks", "Update index.json"],
    dependsOn: [],
    version: 1,
    origin: "spec-workflow" as const,
  });

  const createFeatureList = (features: Feature[]): FeatureList => ({
    version: "2.0.0",
    features,
    metadata: {
      projectGoal: "Test project",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      version: "1.0.0",
    },
  });

  describe("verifyBreakdownCompletion()", () => {
    it("should fail when module directory does not exist", async () => {
      const feature = createBreakdownFeature();
      const featureList = createFeatureList([feature]);

      const result = await verifyBreakdownCompletion(tempDir, feature, featureList);

      expect(result.passed).toBe(false);
      expect(result.issues).toContain("Module directory not found: ai/tasks/auth/");
    });

    it("should fail when no task files are created", async () => {
      const feature = createBreakdownFeature();
      const featureList = createFeatureList([feature]);

      // Create module directory but no task files
      await fs.mkdir(path.join(tempDir, "ai/tasks/auth"), { recursive: true });

      const result = await verifyBreakdownCompletion(tempDir, feature, featureList);

      expect(result.passed).toBe(false);
      expect(result.issues).toContain("No task files created. Expected 4-8 implementation tasks.");
    });

    it("should warn when fewer than 3 tasks are created", async () => {
      const feature = createBreakdownFeature();

      // Create module directory with 2 task files
      const moduleDir = path.join(tempDir, "ai/tasks/auth");
      await fs.mkdir(moduleDir, { recursive: true });
      await fs.writeFile(path.join(moduleDir, "login.md"), "# Login\n\n## Acceptance Criteria\n1. Test");
      await fs.writeFile(path.join(moduleDir, "logout.md"), "# Logout\n\n## Acceptance Criteria\n1. Test");

      // Add tasks to feature list
      const featureList = createFeatureList([
        feature,
        {
          id: "auth.login",
          module: "auth",
          priority: 2,
          status: "failing",
          description: "Login",
          acceptance: ["Test"],
          dependsOn: [],
          version: 1,
          origin: "manual" as const,
        },
        {
          id: "auth.logout",
          module: "auth",
          priority: 2,
          status: "failing",
          description: "Logout",
          acceptance: ["Test"],
          dependsOn: [],
          version: 1,
          origin: "manual" as const,
        },
      ]);

      const result = await verifyBreakdownCompletion(tempDir, feature, featureList);

      expect(result.warnings.some(w => w.includes("Only 2 tasks created"))).toBe(true);
    });

    it("should auto-register tasks when not in index.json", async () => {
      const feature = createBreakdownFeature();

      // Create module directory with task files (with frontmatter)
      const moduleDir = path.join(tempDir, "ai/tasks/auth");
      await fs.mkdir(moduleDir, { recursive: true });
      await fs.writeFile(path.join(moduleDir, "login.md"), "---\nid: auth.login\npriority: 10\nstatus: failing\n---\n# Login\n\n## Acceptance Criteria\n1. Test");
      await fs.writeFile(path.join(moduleDir, "logout.md"), "---\nid: auth.logout\npriority: 11\nstatus: failing\n---\n# Logout\n\n## Acceptance Criteria\n1. Test");
      await fs.writeFile(path.join(moduleDir, "oauth.md"), "---\nid: auth.oauth\npriority: 12\nstatus: failing\n---\n# OAuth\n\n## Acceptance Criteria\n1. Test");

      // Create index.json for auto-registration
      await fs.writeFile(
        path.join(tempDir, "ai/tasks/index.json"),
        JSON.stringify({
          version: "2.0.0",
          updatedAt: new Date().toISOString(),
          features: {
            "auth.BREAKDOWN": { status: "failing", priority: 1, module: "auth", description: "Breakdown" }
          }
        }, null, 2)
      );

      // Feature list without the created tasks
      const featureList = createFeatureList([feature]);

      const result = await verifyBreakdownCompletion(tempDir, feature, featureList);

      // Should pass and auto-register tasks
      expect(result.passed).toBe(true);
      expect(result.autoRegistered).toContain("auth.login");
      expect(result.autoRegistered).toContain("auth.logout");
      expect(result.autoRegistered).toContain("auth.oauth");
    });

    it("should pass when tasks are properly created and indexed", async () => {
      const feature = createBreakdownFeature();

      // Create module directory with task files
      const moduleDir = path.join(tempDir, "ai/tasks/auth");
      await fs.mkdir(moduleDir, { recursive: true });
      await fs.writeFile(path.join(moduleDir, "login.md"), "# Login\n\n## Acceptance Criteria\n1. Test");
      await fs.writeFile(path.join(moduleDir, "logout.md"), "# Logout\n\n## Acceptance Criteria\n1. Test");
      await fs.writeFile(path.join(moduleDir, "oauth.md"), "# OAuth\n\n## Acceptance Criteria\n1. Test");
      await fs.writeFile(path.join(moduleDir, "session.md"), "# Session\n\n## Acceptance Criteria\n1. Test");

      // Feature list with the created tasks
      const featureList = createFeatureList([
        feature,
        { id: "auth.login", module: "auth", priority: 2, status: "failing", description: "Login", acceptance: ["Test"], dependsOn: [], version: 1, origin: "manual" as const },
        { id: "auth.logout", module: "auth", priority: 2, status: "failing", description: "Logout", acceptance: ["Test"], dependsOn: [], version: 1, origin: "manual" as const },
        { id: "auth.oauth", module: "auth", priority: 2, status: "failing", description: "OAuth", acceptance: ["Test"], dependsOn: [], version: 1, origin: "manual" as const },
        { id: "auth.session", module: "auth", priority: 2, status: "failing", description: "Session", acceptance: ["Test"], dependsOn: [], version: 1, origin: "manual" as const },
      ]);

      const result = await verifyBreakdownCompletion(tempDir, feature, featureList);

      expect(result.passed).toBe(true);
      expect(result.tasksCreated).toBe(4);
      expect(result.taskIds).toContain("auth.login");
      expect(result.taskIds).toContain("auth.logout");
      expect(result.taskIds).toContain("auth.oauth");
      expect(result.taskIds).toContain("auth.session");
    });

    it("should exclude BREAKDOWN.md from task count", async () => {
      const feature = createBreakdownFeature();

      // Create module directory with task files including BREAKDOWN.md
      const moduleDir = path.join(tempDir, "ai/tasks/auth");
      await fs.mkdir(moduleDir, { recursive: true });
      await fs.writeFile(path.join(moduleDir, "BREAKDOWN.md"), "# BREAKDOWN");
      await fs.writeFile(path.join(moduleDir, "login.md"), "# Login\n\n## Acceptance Criteria\n1. Test");
      await fs.writeFile(path.join(moduleDir, "logout.md"), "# Logout\n\n## Acceptance Criteria\n1. Test");
      await fs.writeFile(path.join(moduleDir, "oauth.md"), "# OAuth\n\n## Acceptance Criteria\n1. Test");

      const featureList = createFeatureList([
        feature,
        { id: "auth.login", module: "auth", priority: 2, status: "failing", description: "Login", acceptance: ["Test"], dependsOn: [], version: 1, origin: "manual" as const },
        { id: "auth.logout", module: "auth", priority: 2, status: "failing", description: "Logout", acceptance: ["Test"], dependsOn: [], version: 1, origin: "manual" as const },
        { id: "auth.oauth", module: "auth", priority: 2, status: "failing", description: "OAuth", acceptance: ["Test"], dependsOn: [], version: 1, origin: "manual" as const },
      ]);

      const result = await verifyBreakdownCompletion(tempDir, feature, featureList);

      // Should count 3 tasks, not 4 (BREAKDOWN.md excluded)
      expect(result.tasksCreated).toBe(3);
      expect(result.taskIds).not.toContain("auth.BREAKDOWN");
    });

    it("should warn when task is missing acceptance criteria", async () => {
      const feature = createBreakdownFeature();

      const moduleDir = path.join(tempDir, "ai/tasks/auth");
      await fs.mkdir(moduleDir, { recursive: true });
      await fs.writeFile(path.join(moduleDir, "login.md"), "# Login\n\n## Description\nJust description, no criteria");
      await fs.writeFile(path.join(moduleDir, "logout.md"), "# Logout\n\n## Acceptance Criteria\n1. Test");
      await fs.writeFile(path.join(moduleDir, "oauth.md"), "# OAuth\n\n## Acceptance Criteria\n1. Test");

      const featureList = createFeatureList([
        feature,
        { id: "auth.login", module: "auth", priority: 2, status: "failing", description: "Login", acceptance: ["Test"], dependsOn: [], version: 1, origin: "manual" as const },
        { id: "auth.logout", module: "auth", priority: 2, status: "failing", description: "Logout", acceptance: ["Test"], dependsOn: [], version: 1, origin: "manual" as const },
        { id: "auth.oauth", module: "auth", priority: 2, status: "failing", description: "OAuth", acceptance: ["Test"], dependsOn: [], version: 1, origin: "manual" as const },
      ]);

      const result = await verifyBreakdownCompletion(tempDir, feature, featureList);

      expect(result.warnings.some(w => w.includes("auth.login") && w.includes("acceptance criteria"))).toBe(true);
    });

    it("should check spec coverage when spec directory exists", async () => {
      const feature = createBreakdownFeature();

      // Create spec directory
      const specDir = path.join(tempDir, "ai/tasks/spec");
      await fs.mkdir(specDir, { recursive: true });
      await fs.writeFile(path.join(specDir, "UX.md"), "# UX Design\n\n**Screen: Login**\n**Screen: Dashboard**");
      await fs.writeFile(path.join(specDir, "OVERVIEW.md"), "# Overview\n\n**POST /api/auth**\n**GET /api/user**");

      const moduleDir = path.join(tempDir, "ai/tasks/auth");
      await fs.mkdir(moduleDir, { recursive: true });
      await fs.writeFile(path.join(moduleDir, "login.md"), "# Login UI\n\n## Acceptance Criteria\n1. Screen displays");
      await fs.writeFile(path.join(moduleDir, "api.md"), "# API endpoint\n\n## Acceptance Criteria\n1. API returns");
      await fs.writeFile(path.join(moduleDir, "session.md"), "# Session\n\n## Acceptance Criteria\n1. Works");

      const featureList = createFeatureList([
        feature,
        { id: "auth.login", module: "auth", priority: 2, status: "failing", description: "Login UI", acceptance: ["Screen"], dependsOn: [], version: 1, origin: "manual" as const },
        { id: "auth.api", module: "auth", priority: 2, status: "failing", description: "API endpoint", acceptance: ["API"], dependsOn: [], version: 1, origin: "manual" as const },
        { id: "auth.session", module: "auth", priority: 2, status: "failing", description: "Session", acceptance: ["Works"], dependsOn: [], version: 1, origin: "manual" as const },
      ]);

      const result = await verifyBreakdownCompletion(tempDir, feature, featureList);

      expect(result.coverageCheck.hasSpecDir).toBe(true);
      expect(result.coverageCheck.screensFound).toBe(2);
      expect(result.coverageCheck.apisFound).toBe(2);
    });
  });

  describe("displayBreakdownResult()", () => {
    it("should display passing result correctly", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: BreakdownVerificationResult = {
        passed: true,
        moduleName: "auth",
        tasksCreated: 4,
        taskIds: ["auth.login", "auth.logout", "auth.oauth", "auth.session"],
        autoRegistered: [],
        coverageCheck: {
          hasSpecDir: false,
          screensFound: 0,
          screensCovered: 0,
          apisFound: 0,
          apisCovered: 0,
        },
        issues: [],
        warnings: [],
      };

      displayBreakdownResult(result);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("BREAKDOWN COMPLETION CHECK");
      expect(allOutput).toContain("Module: auth");
      expect(allOutput).toContain("Tasks Created: 4");
      expect(allOutput).toContain("PASS");

      consoleSpy.mockRestore();
    });

    it("should display failing result with issues", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: BreakdownVerificationResult = {
        passed: false,
        moduleName: "auth",
        tasksCreated: 0,
        taskIds: [],
        autoRegistered: [],
        coverageCheck: {
          hasSpecDir: false,
          screensFound: 0,
          screensCovered: 0,
          apisFound: 0,
          apisCovered: 0,
        },
        issues: ["Module directory not found: ai/tasks/auth/"],
        warnings: [],
      };

      displayBreakdownResult(result);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("FAIL");
      expect(allOutput).toContain("Issues:");
      expect(allOutput).toContain("Module directory not found");

      consoleSpy.mockRestore();
    });

    it("should display warnings when present", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: BreakdownVerificationResult = {
        passed: true,
        moduleName: "auth",
        tasksCreated: 2,
        taskIds: ["auth.login", "auth.logout"],
        autoRegistered: [],
        coverageCheck: {
          hasSpecDir: false,
          screensFound: 0,
          screensCovered: 0,
          apisFound: 0,
          apisCovered: 0,
        },
        issues: [],
        warnings: ["Only 2 tasks created. Consider breaking down further."],
      };

      displayBreakdownResult(result);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Warnings:");
      expect(allOutput).toContain("Only 2 tasks created");

      consoleSpy.mockRestore();
    });

    it("should display coverage check when spec exists", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: BreakdownVerificationResult = {
        passed: true,
        moduleName: "auth",
        tasksCreated: 4,
        taskIds: ["auth.login", "auth.logout", "auth.oauth", "auth.session"],
        autoRegistered: [],
        coverageCheck: {
          hasSpecDir: true,
          screensFound: 3,
          screensCovered: 2,
          apisFound: 5,
          apisCovered: 3,
        },
        issues: [],
        warnings: [],
      };

      displayBreakdownResult(result);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Coverage Check:");
      expect(allOutput).toContain("UX Screens:");
      expect(allOutput).toContain("APIs:");

      consoleSpy.mockRestore();
    });

    it("should list all task files", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: BreakdownVerificationResult = {
        passed: true,
        moduleName: "auth",
        tasksCreated: 3,
        taskIds: ["auth.login", "auth.logout", "auth.oauth"],
        autoRegistered: [],
        coverageCheck: {
          hasSpecDir: false,
          screensFound: 0,
          screensCovered: 0,
          apisFound: 0,
          apisCovered: 0,
        },
        issues: [],
        warnings: [],
      };

      displayBreakdownResult(result);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Task Files:");
      expect(allOutput).toContain("auth.login");
      expect(allOutput).toContain("auth.logout");
      expect(allOutput).toContain("auth.oauth");

      consoleSpy.mockRestore();
    });
  });
});
