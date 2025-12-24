/**
 * Tests for BREAKDOWN-first task enforcement
 */
import { describe, it, expect } from "vitest";
import {
  isBreakdownTask,
  selectNextFeatureWithBlocking,
  selectNextFeature,
} from "../../src/features/selection.js";
import type { Feature, FeatureStatus } from "../../src/types/index.js";

/**
 * Helper to create a test feature
 */
function createTestFeature(overrides: Partial<Feature> = {}): Feature {
  return {
    id: "test.feature",
    description: "Test feature",
    module: "test",
    priority: 1,
    status: "failing" as FeatureStatus,
    acceptance: ["Test criterion"],
    dependsOn: [],
    supersedes: [],
    tags: [],
    version: 1,
    origin: "manual",
    notes: "",
    ...overrides,
  };
}

describe("isBreakdownTask()", () => {
  describe("ID pattern detection", () => {
    it("should detect by ID pattern *.BREAKDOWN", () => {
      expect(isBreakdownTask("auth.BREAKDOWN")).toBe(true);
      expect(isBreakdownTask("devops.BREAKDOWN")).toBe(true);
      expect(isBreakdownTask("module.sub.BREAKDOWN")).toBe(true);
    });

    it("should be case-insensitive for ID pattern", () => {
      expect(isBreakdownTask("auth.breakdown")).toBe(true);
      expect(isBreakdownTask("auth.Breakdown")).toBe(true);
      expect(isBreakdownTask("auth.BREAKDOWN")).toBe(true);
    });

    it("should return false for regular tasks", () => {
      expect(isBreakdownTask("auth.login")).toBe(false);
      expect(isBreakdownTask("breakdown.auth")).toBe(false);
    });

    it("should return false for tasks with BREAKDOWN in middle", () => {
      expect(isBreakdownTask("auth.BREAKDOWN.impl")).toBe(false);
    });
  });

  describe("Tag detection on Feature object", () => {
    it("should detect by 'breakdown' tag", () => {
      const feature = createTestFeature({
        id: "auth.planning",
        tags: ["breakdown"],
      });
      expect(isBreakdownTask(feature)).toBe(true);
    });

    it("should be case-insensitive for tag detection", () => {
      const feature1 = createTestFeature({
        id: "auth.planning",
        tags: ["BREAKDOWN"],
      });
      const feature2 = createTestFeature({
        id: "auth.planning",
        tags: ["Breakdown"],
      });
      expect(isBreakdownTask(feature1)).toBe(true);
      expect(isBreakdownTask(feature2)).toBe(true);
    });

    it("should return false for feature without breakdown tag", () => {
      const feature = createTestFeature({
        id: "auth.login",
        tags: ["feature", "auth"],
      });
      expect(isBreakdownTask(feature)).toBe(false);
    });

    it("should detect by either ID or tag", () => {
      // ID match, no tag
      const feature1 = createTestFeature({
        id: "auth.BREAKDOWN",
        tags: [],
      });
      expect(isBreakdownTask(feature1)).toBe(true);

      // Tag match, no ID match
      const feature2 = createTestFeature({
        id: "auth.planning",
        tags: ["breakdown"],
      });
      expect(isBreakdownTask(feature2)).toBe(true);

      // Both match
      const feature3 = createTestFeature({
        id: "auth.BREAKDOWN",
        tags: ["breakdown"],
      });
      expect(isBreakdownTask(feature3)).toBe(true);
    });
  });
});

describe("selectNextFeatureWithBlocking()", () => {
  describe("BREAKDOWN-first enforcement", () => {
    it("should select BREAKDOWN task over implementation task (ignoring priority)", () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          priority: 1, // Higher priority (lower number)
        }),
        createTestFeature({
          id: "auth.BREAKDOWN",
          status: "failing",
          priority: 10, // Lower priority (higher number)
        }),
      ];
      const result = selectNextFeatureWithBlocking(features);

      expect(result.feature?.id).toBe("auth.BREAKDOWN");
      expect(result.blockedBy).toBeDefined();
      expect(result.blockedBy?.count).toBe(1);
      expect(result.blockedBy?.ids).toContain("auth.BREAKDOWN");
    });

    it("should block implementation tasks until ALL breakdown complete", () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          priority: 1,
        }),
        createTestFeature({
          id: "auth.BREAKDOWN",
          status: "failing",
          priority: 5,
        }),
        createTestFeature({
          id: "devops.BREAKDOWN",
          status: "failing",
          priority: 10,
        }),
      ];
      const result = selectNextFeatureWithBlocking(features);

      // Should select the BREAKDOWN with lowest priority
      expect(result.feature?.id).toBe("auth.BREAKDOWN");
      expect(result.blockedBy?.count).toBe(2);
      expect(result.blockedBy?.ids).toContain("auth.BREAKDOWN");
      expect(result.blockedBy?.ids).toContain("devops.BREAKDOWN");
    });

    it("should return implementation task when no BREAKDOWN pending", () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          priority: 1,
        }),
        createTestFeature({
          id: "auth.BREAKDOWN",
          status: "passing", // Already complete
          priority: 1,
        }),
      ];
      const result = selectNextFeatureWithBlocking(features);

      expect(result.feature?.id).toBe("auth.login");
      expect(result.blockedBy).toBeUndefined();
    });

    it("should not include blockedBy when no implementation tasks waiting", () => {
      const features = [
        createTestFeature({
          id: "auth.BREAKDOWN",
          status: "failing",
          priority: 1,
        }),
        createTestFeature({
          id: "devops.BREAKDOWN",
          status: "failing",
          priority: 2,
        }),
      ];
      const result = selectNextFeatureWithBlocking(features);

      expect(result.feature?.id).toBe("auth.BREAKDOWN");
      expect(result.blockedBy).toBeUndefined(); // No implementation tasks waiting
    });
  });

  describe("Status priority within BREAKDOWN tasks", () => {
    it("should prioritize needs_review BREAKDOWN over failing BREAKDOWN", () => {
      const features = [
        createTestFeature({
          id: "auth.BREAKDOWN",
          status: "failing",
          priority: 1, // Higher priority number
        }),
        createTestFeature({
          id: "devops.BREAKDOWN",
          status: "needs_review", // Higher status priority
          priority: 10, // Lower priority number
        }),
      ];
      const result = selectNextFeatureWithBlocking(features);

      expect(result.feature?.id).toBe("devops.BREAKDOWN");
    });
  });

  describe("Edge cases", () => {
    it("should return null feature when all tasks done", () => {
      const features = [
        createTestFeature({
          id: "auth.BREAKDOWN",
          status: "passing",
        }),
        createTestFeature({
          id: "auth.login",
          status: "passing",
        }),
      ];
      const result = selectNextFeatureWithBlocking(features);

      expect(result.feature).toBeNull();
      expect(result.blockedBy).toBeUndefined();
    });

    it("should return null feature with empty array", () => {
      const result = selectNextFeatureWithBlocking([]);

      expect(result.feature).toBeNull();
      expect(result.blockedBy).toBeUndefined();
    });

    it("should work with tag-based breakdown detection", () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          priority: 1,
        }),
        createTestFeature({
          id: "auth.planning", // Not a BREAKDOWN ID
          status: "failing",
          priority: 10,
          tags: ["breakdown"], // But has breakdown tag
        }),
      ];
      const result = selectNextFeatureWithBlocking(features);

      expect(result.feature?.id).toBe("auth.planning");
      expect(result.blockedBy).toBeDefined();
    });

    it("should exclude blocked, failed, and deprecated tasks", () => {
      const features = [
        createTestFeature({
          id: "auth.BREAKDOWN",
          status: "blocked",
        }),
        createTestFeature({
          id: "devops.BREAKDOWN",
          status: "failed",
        }),
        createTestFeature({
          id: "old.BREAKDOWN",
          status: "deprecated",
        }),
        createTestFeature({
          id: "auth.login",
          status: "failing",
          priority: 1,
        }),
      ];
      const result = selectNextFeatureWithBlocking(features);

      // Should skip all blocked/failed/deprecated BREAKDOWN tasks
      // and select the implementation task
      expect(result.feature?.id).toBe("auth.login");
      expect(result.blockedBy).toBeUndefined();
    });
  });

  describe("Backward compatibility", () => {
    it("selectNextFeature should still return Feature | null", () => {
      const features = [
        createTestFeature({
          id: "auth.BREAKDOWN",
          status: "failing",
        }),
      ];
      const result = selectNextFeature(features);

      // Old function doesn't enforce BREAKDOWN-first
      expect(result?.id).toBe("auth.BREAKDOWN");
    });

    it("projects without BREAKDOWN tasks should work normally", () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          priority: 2,
        }),
        createTestFeature({
          id: "auth.logout",
          status: "failing",
          priority: 1,
        }),
      ];
      const result = selectNextFeatureWithBlocking(features);

      // Should select by priority as usual
      expect(result.feature?.id).toBe("auth.logout");
      expect(result.blockedBy).toBeUndefined();
    });
  });

  describe("Status priority for implementation tasks", () => {
    it("should prioritize needs_review over failing for implementation tasks", () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          priority: 1, // Higher priority
        }),
        createTestFeature({
          id: "auth.logout",
          status: "needs_review", // Higher status priority
          priority: 10, // Lower priority
        }),
      ];
      const result = selectNextFeatureWithBlocking(features);

      // needs_review should be selected first despite lower priority
      expect(result.feature?.id).toBe("auth.logout");
    });

    it("should sort by priority when statuses are the same", () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "needs_review",
          priority: 5,
        }),
        createTestFeature({
          id: "auth.logout",
          status: "needs_review",
          priority: 2,
        }),
        createTestFeature({
          id: "auth.register",
          status: "needs_review",
          priority: 8,
        }),
      ];
      const result = selectNextFeatureWithBlocking(features);

      // Lowest priority number should be selected
      expect(result.feature?.id).toBe("auth.logout");
    });

    it("should handle mixed statuses and priorities correctly", () => {
      const features = [
        createTestFeature({
          id: "auth.login",
          status: "failing",
          priority: 1,
        }),
        createTestFeature({
          id: "auth.logout",
          status: "needs_review",
          priority: 100,
        }),
        createTestFeature({
          id: "auth.register",
          status: "failing",
          priority: 2,
        }),
      ];
      const result = selectNextFeatureWithBlocking(features);

      // needs_review wins even with high priority number
      expect(result.feature?.id).toBe("auth.logout");
    });
  });
});
