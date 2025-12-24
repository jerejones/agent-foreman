/**
 * Integration tests for quick-operations BREAKDOWN-first enforcement
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { selectNextFeatureQuickWithBlocking } from "../../src/features/quick-operations.js";
import type { FeatureIndex } from "../../src/types/index.js";

describe("selectNextFeatureQuickWithBlocking()", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "foreman-quick-breakdown-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create index.json with given features
   */
  async function createIndex(
    features: Record<string, { status: string; priority: number; module: string; description: string }>
  ): Promise<void> {
    const tasksDir = path.join(tempDir, "ai", "tasks");
    await fs.mkdir(tasksDir, { recursive: true });

    const index: FeatureIndex = {
      version: "2.0.0",
      updatedAt: new Date().toISOString(),
      metadata: {
        projectGoal: "Test project",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: "1.0.0",
      },
      features: features as FeatureIndex["features"],
    };

    await fs.writeFile(
      path.join(tasksDir, "index.json"),
      JSON.stringify(index, null, 2)
    );
  }

  /**
   * Helper to create a task markdown file
   */
  async function createTaskFile(
    module: string,
    taskName: string,
    content: {
      id: string;
      status: string;
      priority: number;
      description: string;
    }
  ): Promise<void> {
    const moduleDir = path.join(tempDir, "ai", "tasks", module);
    await fs.mkdir(moduleDir, { recursive: true });

    const markdown = `---
id: ${content.id}
module: ${module}
priority: ${content.priority}
status: ${content.status}
version: 1
origin: manual
dependsOn: []
supersedes: []
tags: []
---
# ${content.description}

## Acceptance Criteria

1. Test criterion
`;

    await fs.writeFile(path.join(moduleDir, `${taskName}.md`), markdown);
  }

  describe("BREAKDOWN-first enforcement", () => {
    it("should select BREAKDOWN task over implementation task", async () => {
      await createIndex({
        "auth.login": {
          status: "failing",
          priority: 1,
          module: "auth",
          description: "User login",
        },
        "auth.BREAKDOWN": {
          status: "failing",
          priority: 10,
          module: "auth",
          description: "Auth module breakdown",
        },
      });

      await createTaskFile("auth", "BREAKDOWN", {
        id: "auth.BREAKDOWN",
        status: "failing",
        priority: 10,
        description: "Auth module breakdown",
      });

      const result = await selectNextFeatureQuickWithBlocking(tempDir);

      expect(result.feature?.id).toBe("auth.BREAKDOWN");
      expect(result.blockedBy).toBeDefined();
      expect(result.blockedBy?.count).toBe(1);
    });

    it("should return implementation task when no BREAKDOWN pending", async () => {
      await createIndex({
        "auth.login": {
          status: "failing",
          priority: 1,
          module: "auth",
          description: "User login",
        },
        "auth.BREAKDOWN": {
          status: "passing",
          priority: 1,
          module: "auth",
          description: "Auth module breakdown",
        },
      });

      await createTaskFile("auth", "login", {
        id: "auth.login",
        status: "failing",
        priority: 1,
        description: "User login",
      });

      const result = await selectNextFeatureQuickWithBlocking(tempDir);

      expect(result.feature?.id).toBe("auth.login");
      expect(result.blockedBy).toBeUndefined();
    });

    it("should include multiple BREAKDOWN tasks in blockedBy", async () => {
      await createIndex({
        "auth.login": {
          status: "failing",
          priority: 1,
          module: "auth",
          description: "User login",
        },
        "auth.BREAKDOWN": {
          status: "failing",
          priority: 5,
          module: "auth",
          description: "Auth breakdown",
        },
        "devops.BREAKDOWN": {
          status: "failing",
          priority: 10,
          module: "devops",
          description: "DevOps breakdown",
        },
      });

      await createTaskFile("auth", "BREAKDOWN", {
        id: "auth.BREAKDOWN",
        status: "failing",
        priority: 5,
        description: "Auth breakdown",
      });

      const result = await selectNextFeatureQuickWithBlocking(tempDir);

      expect(result.feature?.id).toBe("auth.BREAKDOWN");
      expect(result.blockedBy?.count).toBe(2);
      expect(result.blockedBy?.ids).toContain("auth.BREAKDOWN");
      expect(result.blockedBy?.ids).toContain("devops.BREAKDOWN");
    });
  });

  describe("Edge cases", () => {
    it("should return null when no tasks available", async () => {
      await createIndex({
        "auth.login": {
          status: "passing",
          priority: 1,
          module: "auth",
          description: "User login",
        },
      });

      const result = await selectNextFeatureQuickWithBlocking(tempDir);

      expect(result.feature).toBeNull();
      expect(result.blockedBy).toBeUndefined();
    });

    it("should throw error when index not found", async () => {
      await expect(selectNextFeatureQuickWithBlocking(tempDir)).rejects.toThrow(
        "Feature index not found"
      );
    });

    it("should fall back to minimal feature when file is missing", async () => {
      await createIndex({
        "auth.BREAKDOWN": {
          status: "failing",
          priority: 1,
          module: "auth",
          description: "Auth breakdown",
        },
      });

      // Don't create the task file - should fall back to index data

      const result = await selectNextFeatureQuickWithBlocking(tempDir);

      expect(result.feature).not.toBeNull();
      expect(result.feature?.id).toBe("auth.BREAKDOWN");
      expect(result.feature?.description).toBe("Auth breakdown");
      expect(result.feature?.acceptance).toEqual([]);
    });

    it("should not include blockedBy when only BREAKDOWN tasks exist", async () => {
      await createIndex({
        "auth.BREAKDOWN": {
          status: "failing",
          priority: 1,
          module: "auth",
          description: "Auth breakdown",
        },
        "devops.BREAKDOWN": {
          status: "failing",
          priority: 2,
          module: "devops",
          description: "DevOps breakdown",
        },
      });

      await createTaskFile("auth", "BREAKDOWN", {
        id: "auth.BREAKDOWN",
        status: "failing",
        priority: 1,
        description: "Auth breakdown",
      });

      const result = await selectNextFeatureQuickWithBlocking(tempDir);

      expect(result.feature?.id).toBe("auth.BREAKDOWN");
      expect(result.blockedBy).toBeUndefined(); // No implementation tasks waiting
    });
  });

  describe("Status and priority sorting", () => {
    it("should prioritize needs_review BREAKDOWN over failing BREAKDOWN", async () => {
      await createIndex({
        "auth.BREAKDOWN": {
          status: "failing",
          priority: 1,
          module: "auth",
          description: "Auth breakdown",
        },
        "devops.BREAKDOWN": {
          status: "needs_review",
          priority: 10,
          module: "devops",
          description: "DevOps breakdown",
        },
      });

      await createTaskFile("devops", "BREAKDOWN", {
        id: "devops.BREAKDOWN",
        status: "needs_review",
        priority: 10,
        description: "DevOps breakdown",
      });

      const result = await selectNextFeatureQuickWithBlocking(tempDir);

      // needs_review should win over failing despite higher priority number
      expect(result.feature?.id).toBe("devops.BREAKDOWN");
    });

    it("should sort implementation tasks by status then priority", async () => {
      await createIndex({
        "auth.login": {
          status: "failing",
          priority: 1,
          module: "auth",
          description: "User login",
        },
        "auth.logout": {
          status: "needs_review",
          priority: 10,
          module: "auth",
          description: "User logout",
        },
      });

      await createTaskFile("auth", "logout", {
        id: "auth.logout",
        status: "needs_review",
        priority: 10,
        description: "User logout",
      });

      const result = await selectNextFeatureQuickWithBlocking(tempDir);

      // needs_review should be selected first
      expect(result.feature?.id).toBe("auth.logout");
    });
  });

  describe("Case insensitivity", () => {
    it("should detect lowercase .breakdown in ID", async () => {
      await createIndex({
        "auth.login": {
          status: "failing",
          priority: 1,
          module: "auth",
          description: "User login",
        },
        "auth.breakdown": {
          status: "failing",
          priority: 10,
          module: "auth",
          description: "Auth breakdown",
        },
      });

      await createTaskFile("auth", "breakdown", {
        id: "auth.breakdown",
        status: "failing",
        priority: 10,
        description: "Auth breakdown",
      });

      const result = await selectNextFeatureQuickWithBlocking(tempDir);

      expect(result.feature?.id).toBe("auth.breakdown");
      expect(result.blockedBy).toBeDefined();
    });
  });
});
