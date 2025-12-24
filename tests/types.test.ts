/**
 * Tests for src/types.ts - Core type definitions
 * Tests for Universal Verification Strategy (UVS) type additions
 */
import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  TaskType,
  Feature,
  FeatureStatus,
  FeatureOrigin,
  FeatureVerificationSummary,
  Task,
  TaskStatus,
  TaskOrigin,
  TaskVerificationSummary,
} from "../src/types/index.js";

describe("TaskType", () => {
  it("should accept all valid task type values", () => {
    const validTypes: TaskType[] = ["code", "ops", "data", "infra", "manual"];
    expect(validTypes).toHaveLength(5);

    // Type check - each value should be assignable to TaskType
    const code: TaskType = "code";
    const ops: TaskType = "ops";
    const data: TaskType = "data";
    const infra: TaskType = "infra";
    const manual: TaskType = "manual";

    expect(code).toBe("code");
    expect(ops).toBe("ops");
    expect(data).toBe("data");
    expect(infra).toBe("infra");
    expect(manual).toBe("manual");
  });
});

describe("Feature with taskType", () => {
  const baseFeature: Omit<Feature, "taskType"> = {
    id: "test.feature",
    description: "Test feature",
    module: "test",
    priority: 1,
    status: "failing",
    acceptance: ["Acceptance criterion"],
    dependsOn: [],
    supersedes: [],
    tags: [],
    version: 1,
    origin: "manual",
    notes: "",
  };

  it("should accept feature without taskType (backward compatible)", () => {
    const feature: Feature = { ...baseFeature };
    expect(feature.taskType).toBeUndefined();
  });

  it("should accept feature with taskType set to 'code'", () => {
    const feature: Feature = { ...baseFeature, taskType: "code" };
    expect(feature.taskType).toBe("code");
  });

  it("should accept feature with taskType set to 'ops'", () => {
    const feature: Feature = { ...baseFeature, taskType: "ops" };
    expect(feature.taskType).toBe("ops");
  });

  it("should accept feature with taskType set to 'data'", () => {
    const feature: Feature = { ...baseFeature, taskType: "data" };
    expect(feature.taskType).toBe("data");
  });

  it("should accept feature with taskType set to 'infra'", () => {
    const feature: Feature = { ...baseFeature, taskType: "infra" };
    expect(feature.taskType).toBe("infra");
  });

  it("should accept feature with taskType set to 'manual'", () => {
    const feature: Feature = { ...baseFeature, taskType: "manual" };
    expect(feature.taskType).toBe("manual");
  });
});

describe("Task type aliases", () => {
  it("Task should be an alias for Feature", () => {
    // Type-level test - Task and Feature should be interchangeable
    const feature: Feature = {
      id: "test.feature",
      description: "Test feature",
      module: "test",
      priority: 1,
      status: "failing",
      acceptance: ["Acceptance criterion"],
      dependsOn: [],
      supersedes: [],
      tags: [],
      version: 1,
      origin: "manual",
      notes: "",
    };

    // Task should be assignable from Feature
    const task: Task = feature;
    expect(task.id).toBe("test.feature");

    // Feature should be assignable from Task
    const featureFromTask: Feature = task;
    expect(featureFromTask.id).toBe("test.feature");
  });

  it("TaskStatus should be an alias for FeatureStatus", () => {
    const statuses: TaskStatus[] = ["failing", "passing", "blocked", "needs_review", "failed", "deprecated"];

    // Each TaskStatus value should be valid as FeatureStatus
    for (const status of statuses) {
      const featureStatus: FeatureStatus = status;
      const taskStatus: TaskStatus = featureStatus;
      expect(taskStatus).toBe(status);
    }
  });

  it("TaskOrigin should be an alias for FeatureOrigin", () => {
    const origins: TaskOrigin[] = ["init-auto", "init-from-routes", "init-from-tests", "manual", "replan"];

    // Each TaskOrigin value should be valid as FeatureOrigin
    for (const origin of origins) {
      const featureOrigin: FeatureOrigin = origin;
      const taskOrigin: TaskOrigin = featureOrigin;
      expect(taskOrigin).toBe(origin);
    }
  });

  it("TaskVerificationSummary should be an alias for FeatureVerificationSummary", () => {
    const summary: TaskVerificationSummary = {
      verifiedAt: "2024-01-15T10:00:00Z",
      verdict: "pass",
      verifiedBy: "codex",
      summary: "All criteria met",
    };

    // Should be assignable to FeatureVerificationSummary
    const featureSummary: FeatureVerificationSummary = summary;
    expect(featureSummary.verdict).toBe("pass");

    // And vice versa
    const taskSummary: TaskVerificationSummary = featureSummary;
    expect(taskSummary.verifiedBy).toBe("codex");
  });
});

describe("Type compatibility", () => {
  it("should allow using Task where Feature is expected", () => {
    function processFeature(feature: Feature): string {
      return feature.id;
    }

    const task: Task = {
      id: "task.example",
      description: "Example task",
      module: "task",
      priority: 1,
      status: "failing",
      acceptance: ["Task acceptance"],
      dependsOn: [],
      supersedes: [],
      tags: [],
      version: 1,
      origin: "manual",
      notes: "",
      taskType: "ops",
    };

    // Task should work with functions expecting Feature
    const result = processFeature(task);
    expect(result).toBe("task.example");
  });

  it("should preserve taskType when using Task alias", () => {
    const task: Task = {
      id: "ops.deploy",
      description: "Deploy application",
      module: "ops",
      priority: 1,
      status: "failing",
      acceptance: ["Deployment succeeds"],
      dependsOn: [],
      supersedes: [],
      tags: ["deployment"],
      version: 1,
      origin: "manual",
      notes: "",
      taskType: "ops",
    };

    expect(task.taskType).toBe("ops");
  });
});
