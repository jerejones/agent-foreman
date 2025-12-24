/**
 * Tests for task-impact.ts
 * Task impact detection - maps changed files to affected tasks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getTaskImpact, buildFileTaskIndex } from "../../src/verifier/task-impact.js";
import type { Feature, FeatureList } from "../../src/types/index.js";

// Mock the features module
vi.mock("../../src/features/index.js", () => ({
  loadFeatureList: vi.fn(),
}));

import { loadFeatureList } from "../../src/features/index.js";

const mockedLoadFeatureList = vi.mocked(loadFeatureList);

// Helper to create a test feature
function createTestFeature(overrides: Partial<Feature> = {}): Feature {
  return {
    id: "test.feature",
    description: "Test feature",
    module: "test",
    priority: 1,
    status: "failing",
    acceptance: ["Test criterion"],
    dependsOn: [],
    supersedes: [],
    tags: [],
    notes: "",
    version: 1,
    origin: "manual",
    ...overrides,
  };
}

// Helper to create a test feature list
function createFeatureList(features: Feature[]): FeatureList {
  return {
    features,
    metadata: {
      projectGoal: "Test project",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
    },
  };
}

describe("Task Impact Detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getTaskImpact", () => {
    it("should return empty array when no feature list exists", async () => {
      mockedLoadFeatureList.mockResolvedValue(null);

      const result = await getTaskImpact("/test/dir", ["src/foo.ts"]);

      expect(result).toEqual([]);
    });

    it("should return empty array when feature list has no features", async () => {
      mockedLoadFeatureList.mockResolvedValue(createFeatureList([]));

      const result = await getTaskImpact("/test/dir", ["src/foo.ts"]);

      expect(result).toEqual([]);
    });

    it("should skip tasks with passing status", async () => {
      const features = [
        createTestFeature({ id: "auth.login", status: "passing", module: "auth" }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/auth/login.ts"]);

      expect(result).toEqual([]);
    });

    it("should skip tasks with deprecated status", async () => {
      const features = [
        createTestFeature({ id: "auth.login", status: "deprecated", module: "auth" }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/auth/login.ts"]);

      expect(result).toEqual([]);
    });

    it("should match tasks using affectedBy patterns (high confidence)", async () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          module: "auth",
          affectedBy: ["src/auth/**/*.ts"],
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/auth/login.ts"]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        taskId: "auth.login",
        reason: "matches affectedBy pattern: src/auth/**/*.ts",
        confidence: "high",
        matchedFiles: ["src/auth/login.ts"],
      });
    });

    it("should match tasks using test pattern (medium confidence)", async () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          module: "auth",
          testRequirements: {
            unit: {
              required: true,
              pattern: "tests/auth/**/*.test.ts",
            },
          },
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/auth/login.ts"]);

      expect(result).toHaveLength(1);
      expect(result[0].taskId).toBe("auth.login");
      expect(result[0].confidence).toBe("medium");
      expect(result[0].reason).toContain("matches test pattern");
    });

    it("should match tasks using module-based matching (low confidence)", async () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          module: "auth",
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/auth/login.ts"]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        taskId: "auth.login",
        reason: "file in module: auth",
        confidence: "low",
        matchedFiles: ["src/auth/login.ts"],
      });
    });

    it("should prioritize affectedBy over test pattern", async () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          module: "auth",
          affectedBy: ["src/auth/**/*.ts"],
          testRequirements: {
            unit: {
              required: true,
              pattern: "tests/auth/**/*.test.ts",
            },
          },
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/auth/login.ts"]);

      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe("high");
      expect(result[0].reason).toContain("affectedBy");
    });

    it("should sort results by confidence (high first)", async () => {
      const features = [
        createTestFeature({
          id: "low.conf",
          status: "failing",
          module: "low",
        }),
        createTestFeature({
          id: "high.conf",
          status: "failing",
          module: "high",
          affectedBy: ["src/high/**/*.ts"],
        }),
        createTestFeature({
          id: "medium.conf",
          status: "failing",
          module: "medium",
          testRequirements: {
            unit: {
              required: true,
              pattern: "tests/medium/**/*.test.ts",
            },
          },
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", [
        "src/low/file.ts",
        "src/high/file.ts",
        "src/medium/file.ts",
      ]);

      expect(result).toHaveLength(3);
      expect(result[0].confidence).toBe("high");
      expect(result[1].confidence).toBe("medium");
      expect(result[2].confidence).toBe("low");
    });

    it("should not duplicate tasks", async () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          module: "auth",
          affectedBy: ["src/auth/**/*.ts"],
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", [
        "src/auth/login.ts",
        "src/auth/logout.ts",
        "src/auth/utils.ts",
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].taskId).toBe("auth.login");
      expect(result[0].matchedFiles).toEqual(["src/auth/login.ts", "src/auth/logout.ts", "src/auth/utils.ts"]);
    });

    it("should match files with module path substring", async () => {
      const features = [
        createTestFeature({
          id: "api.users",
          status: "failing",
          module: "api",
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/api/users.ts"]);

      expect(result).toHaveLength(1);
      expect(result[0].taskId).toBe("api.users");
    });

    it("should handle tasks with needs_review status", async () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "needs_review",
          module: "auth",
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/auth/login.ts"]);

      expect(result).toHaveLength(1);
      expect(result[0].taskId).toBe("auth.login");
    });

    it("should handle tasks with blocked status", async () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "blocked",
          module: "auth",
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/auth/login.ts"]);

      expect(result).toHaveLength(1);
      expect(result[0].taskId).toBe("auth.login");
    });

    it("should handle tasks with failed status", async () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failed",
          module: "auth",
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/auth/login.ts"]);

      expect(result).toHaveLength(1);
      expect(result[0].taskId).toBe("auth.login");
    });
  });

  describe("buildFileTaskIndex", () => {
    it("should build empty index for empty task list", () => {
      const index = buildFileTaskIndex([]);

      expect(index.size).toBe(0);
    });

    it("should index affectedBy patterns", () => {
      const tasks = [
        createTestFeature({
          id: "auth.login",
          affectedBy: ["src/auth/**/*.ts"],
        }),
      ];

      const index = buildFileTaskIndex(tasks);

      expect(index.has("src/auth/**/*.ts")).toBe(true);
      expect(index.get("src/auth/**/*.ts")?.has("auth.login")).toBe(true);
    });

    it("should index test patterns as source patterns", () => {
      const tasks = [
        createTestFeature({
          id: "auth.login",
          testRequirements: {
            unit: {
              required: true,
              pattern: "tests/auth/**/*.test.ts",
            },
          },
        }),
      ];

      const index = buildFileTaskIndex(tasks);

      expect(index.has("src/auth/**/*.ts")).toBe(true);
      expect(index.get("src/auth/**/*.ts")?.has("auth.login")).toBe(true);
    });

    it("should index module patterns", () => {
      const tasks = [
        createTestFeature({
          id: "auth.login",
          module: "auth",
        }),
      ];

      const index = buildFileTaskIndex(tasks);

      expect(index.has("**/auth/**/*")).toBe(true);
      expect(index.get("**/auth/**/*")?.has("auth.login")).toBe(true);
    });

    it("should handle multiple patterns for same task", () => {
      const tasks = [
        createTestFeature({
          id: "auth.login",
          module: "auth",
          affectedBy: ["src/auth/**/*.ts", "src/utils/hash.ts"],
          testRequirements: {
            unit: {
              required: true,
              pattern: "tests/auth/**/*.test.ts",
            },
          },
        }),
      ];

      const index = buildFileTaskIndex(tasks);

      // affectedBy[0], affectedBy[1], test pattern -> src/auth/**/*.ts (same as affectedBy[0]), module
      // So we get 3 unique patterns: src/auth/**/*.ts, src/utils/hash.ts, **/auth/**/*
      expect(index.size).toBe(3);
      expect(index.get("src/auth/**/*.ts")?.has("auth.login")).toBe(true);
      expect(index.get("src/utils/hash.ts")?.has("auth.login")).toBe(true);
      expect(index.get("**/auth/**/*")?.has("auth.login")).toBe(true);
    });

    it("should handle multiple tasks with same pattern", () => {
      const tasks = [
        createTestFeature({
          id: "auth.login",
          module: "auth",
        }),
        createTestFeature({
          id: "auth.logout",
          module: "auth",
        }),
      ];

      const index = buildFileTaskIndex(tasks);

      const authTaskIds = index.get("**/auth/**/*");
      expect(authTaskIds?.has("auth.login")).toBe(true);
      expect(authTaskIds?.has("auth.logout")).toBe(true);
    });

    it("should handle tasks without any matching criteria", () => {
      const tasks = [
        createTestFeature({
          id: "empty.task",
          module: "",
          affectedBy: undefined,
          testRequirements: undefined,
        }),
      ];

      const index = buildFileTaskIndex(tasks);

      // When module is empty string, no patterns are added
      // (empty string is falsy in JavaScript)
      expect(index.size).toBe(0);
    });
  });

  describe("testPatternToSourcePath conversion", () => {
    it("should convert tests/ prefix to src/", async () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          testRequirements: {
            unit: {
              required: true,
              pattern: "tests/auth/login.test.ts",
            },
          },
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/auth/login.ts"]);

      expect(result).toHaveLength(1);
    });

    it("should convert test/ prefix to src/", async () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          testRequirements: {
            unit: {
              required: true,
              pattern: "test/auth/login.test.ts",
            },
          },
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/auth/login.ts"]);

      expect(result).toHaveLength(1);
    });

    it("should convert __tests__/ prefix to src/", async () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          testRequirements: {
            unit: {
              required: true,
              pattern: "__tests__/auth/login.test.ts",
            },
          },
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/auth/login.ts"]);

      expect(result).toHaveLength(1);
    });

    it("should convert spec/ prefix to src/", async () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          testRequirements: {
            unit: {
              required: true,
              pattern: "spec/auth/login.spec.ts",
            },
          },
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/auth/login.ts"]);

      expect(result).toHaveLength(1);
    });

    it("should handle .spec.ts suffix", async () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          testRequirements: {
            unit: {
              required: true,
              pattern: "tests/auth/login.spec.ts",
            },
          },
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/auth/login.ts"]);

      expect(result).toHaveLength(1);
    });

    it("should handle .test.tsx suffix", async () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          testRequirements: {
            unit: {
              required: true,
              pattern: "tests/auth/Login.test.tsx",
            },
          },
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/auth/Login.tsx"]);

      expect(result).toHaveLength(1);
    });

    it("should handle .spec.tsx suffix", async () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          testRequirements: {
            unit: {
              required: true,
              pattern: "tests/auth/Login.spec.tsx",
            },
          },
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/auth/Login.tsx"]);

      expect(result).toHaveLength(1);
    });

    it("should handle .test.js suffix", async () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          testRequirements: {
            unit: {
              required: true,
              pattern: "tests/auth/login.test.js",
            },
          },
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/auth/login.js"]);

      expect(result).toHaveLength(1);
    });

    it("should handle .spec.js suffix", async () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          testRequirements: {
            unit: {
              required: true,
              pattern: "tests/auth/login.spec.js",
            },
          },
        }),
      ];
      mockedLoadFeatureList.mockResolvedValue(createFeatureList(features));

      const result = await getTaskImpact("/test/dir", ["src/auth/login.js"]);

      expect(result).toHaveLength(1);
    });
  });
});
