/**
 * Tests for src/impact-analyzer.ts - Impact analysis
 */
import { describe, it, expect } from "vitest";
import {
  analyzeImpact,
  applyImpactRecommendations,
  buildDependencyGraph,
  findAffectedChain,
  getFullImpactChain,
  wouldCreateCircularDependency,
  getBlockingFeatures,
  areDependenciesSatisfied,
  getReadyFeatures,
  sortByDependencyOrder,
  getDependencyDepth,
} from "../src/impact-analyzer.js";
import type { Feature, ImpactRecommendation } from "../src/types.js";

describe("Impact Analyzer", () => {
  const createTestFeature = (overrides: Partial<Feature> = {}): Feature => ({
    id: "test.feature",
    description: "Test feature",
    module: "test",
    priority: 1,
    status: "failing",
    acceptance: ["Test criterion"],
    dependsOn: [],
    supersedes: [],
    tags: [],
    version: 1,
    origin: "manual",
    notes: "",
    ...overrides,
  });

  describe("analyzeImpact", () => {
    it("should find directly affected features", () => {
      const features = [
        createTestFeature({ id: "f1", module: "auth" }),
        createTestFeature({ id: "f2", module: "auth", dependsOn: ["f1"] }),
        createTestFeature({ id: "f3", module: "user", dependsOn: ["f1"] }),
      ];
      const result = analyzeImpact(features, "f1", "auth");

      expect(result.directlyAffected).toHaveLength(2);
      expect(result.directlyAffected.map((f) => f.id)).toContain("f2");
      expect(result.directlyAffected.map((f) => f.id)).toContain("f3");
    });

    it("should find potentially affected features in same module", () => {
      const features = [
        createTestFeature({ id: "f1", module: "auth" }),
        createTestFeature({ id: "f2", module: "auth" }),
        createTestFeature({ id: "f3", module: "auth" }),
        createTestFeature({ id: "f4", module: "user" }),
      ];
      const result = analyzeImpact(features, "f1", "auth");

      expect(result.potentiallyAffected).toHaveLength(2);
      expect(result.potentiallyAffected.map((f) => f.id)).not.toContain("f1");
      expect(result.potentiallyAffected.map((f) => f.id)).not.toContain("f4");
    });

    it("should exclude deprecated features", () => {
      const features = [
        createTestFeature({ id: "f1", module: "auth" }),
        createTestFeature({ id: "f2", module: "auth", status: "deprecated" }),
        createTestFeature({ id: "f3", module: "auth", dependsOn: ["f1"], status: "deprecated" }),
      ];
      const result = analyzeImpact(features, "f1", "auth");

      expect(result.directlyAffected).toHaveLength(0);
      expect(result.potentiallyAffected).toHaveLength(0);
    });

    it("should generate recommendations for passing features", () => {
      const features = [
        createTestFeature({ id: "f1", module: "auth", status: "passing" }),
        createTestFeature({ id: "f2", module: "auth", status: "passing", dependsOn: ["f1"] }),
        createTestFeature({ id: "f3", module: "auth", status: "passing" }),
      ];
      const result = analyzeImpact(features, "f1", "auth");

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(
        result.recommendations.some(
          (r) => r.featureId === "f2" && r.action === "mark_needs_review"
        )
      ).toBe(true);
    });

    it("should not recommend changes for non-passing features", () => {
      const features = [
        createTestFeature({ id: "f1", module: "auth", status: "passing" }),
        createTestFeature({ id: "f2", module: "auth", status: "failing", dependsOn: ["f1"] }),
      ];
      const result = analyzeImpact(features, "f1", "auth");

      expect(result.recommendations.filter((r) => r.featureId === "f2")).toHaveLength(0);
    });
  });

  describe("applyImpactRecommendations", () => {
    it("should apply mark_needs_review recommendation", () => {
      const features = [
        createTestFeature({ id: "f1", status: "passing", notes: "" }),
      ];
      const recommendations: ImpactRecommendation[] = [
        { featureId: "f1", action: "mark_needs_review", reason: "Impact from f2" },
      ];
      const updated = applyImpactRecommendations(features, recommendations);

      expect(updated[0].status).toBe("needs_review");
      expect(updated[0].notes).toContain("Impact from f2");
    });

    it("should apply mark_deprecated recommendation", () => {
      const features = [createTestFeature({ id: "f1", status: "passing" })];
      const recommendations: ImpactRecommendation[] = [
        { featureId: "f1", action: "mark_deprecated", reason: "Replaced by f2" },
      ];
      const updated = applyImpactRecommendations(features, recommendations);

      expect(updated[0].status).toBe("deprecated");
    });

    it("should apply update_notes recommendation", () => {
      const features = [
        createTestFeature({ id: "f1", status: "passing", notes: "Original" }),
      ];
      const recommendations: ImpactRecommendation[] = [
        { featureId: "f1", action: "update_notes", reason: "New note" },
      ];
      const updated = applyImpactRecommendations(features, recommendations);

      expect(updated[0].status).toBe("passing"); // unchanged
      expect(updated[0].notes).toContain("New note");
      expect(updated[0].notes).toContain("Original");
    });

    it("should not modify features without recommendations", () => {
      const features = [
        createTestFeature({ id: "f1", status: "passing" }),
        createTestFeature({ id: "f2", status: "passing" }),
      ];
      const recommendations: ImpactRecommendation[] = [
        { featureId: "f1", action: "mark_needs_review", reason: "Test" },
      ];
      const updated = applyImpactRecommendations(features, recommendations);

      expect(updated[1].status).toBe("passing");
    });
  });

  describe("buildDependencyGraph", () => {
    it("should build graph of reverse dependencies", () => {
      const features = [
        createTestFeature({ id: "f1", dependsOn: [] }),
        createTestFeature({ id: "f2", dependsOn: ["f1"] }),
        createTestFeature({ id: "f3", dependsOn: ["f1", "f2"] }),
      ];
      const graph = buildDependencyGraph(features);

      expect(graph.get("f1")).toContain("f2");
      expect(graph.get("f1")).toContain("f3");
      expect(graph.get("f2")).toContain("f3");
      expect(graph.get("f3")).toHaveLength(0);
    });

    it("should handle features with no dependencies", () => {
      const features = [
        createTestFeature({ id: "f1", dependsOn: [] }),
        createTestFeature({ id: "f2", dependsOn: [] }),
      ];
      const graph = buildDependencyGraph(features);

      expect(graph.get("f1")).toHaveLength(0);
      expect(graph.get("f2")).toHaveLength(0);
    });
  });

  describe("findAffectedChain", () => {
    it("should find all features in dependency chain", () => {
      const features = [
        createTestFeature({ id: "f1", dependsOn: [] }),
        createTestFeature({ id: "f2", dependsOn: ["f1"] }),
        createTestFeature({ id: "f3", dependsOn: ["f2"] }),
        createTestFeature({ id: "f4", dependsOn: ["f3"] }),
      ];
      const graph = buildDependencyGraph(features);
      const chain = findAffectedChain(graph, "f1");

      expect(chain).toContain("f2");
      expect(chain).toContain("f3");
      expect(chain).toContain("f4");
    });

    it("should handle circular dependencies without infinite loop", () => {
      const graph = new Map<string, string[]>();
      graph.set("f1", ["f2"]);
      graph.set("f2", ["f1"]); // circular

      const chain = findAffectedChain(graph, "f1");
      expect(chain).toContain("f2");
      // Should not throw or hang
    });
  });

  describe("getFullImpactChain", () => {
    it("should return all affected features", () => {
      const features = [
        createTestFeature({ id: "f1", dependsOn: [] }),
        createTestFeature({ id: "f2", dependsOn: ["f1"] }),
        createTestFeature({ id: "f3", dependsOn: ["f2"] }),
      ];
      const chain = getFullImpactChain(features, "f1");

      expect(chain).toContain("f2");
      expect(chain).toContain("f3");
    });
  });

  describe("wouldCreateCircularDependency", () => {
    it("should detect circular dependency", () => {
      const features = [
        createTestFeature({ id: "f1", dependsOn: [] }),
        createTestFeature({ id: "f2", dependsOn: ["f1"] }),
        createTestFeature({ id: "f3", dependsOn: ["f2"] }),
      ];

      // f1 depends on f3, and f3 depends on f2 which depends on f1
      expect(wouldCreateCircularDependency(features, "f1", "f3")).toBe(true);
    });

    it("should allow non-circular dependency", () => {
      const features = [
        createTestFeature({ id: "f1", dependsOn: [] }),
        createTestFeature({ id: "f2", dependsOn: ["f1"] }),
        createTestFeature({ id: "f3", dependsOn: [] }),
      ];

      expect(wouldCreateCircularDependency(features, "f3", "f1")).toBe(false);
    });
  });

  describe("getBlockingFeatures", () => {
    it("should return non-passing dependencies", () => {
      const features = [
        createTestFeature({ id: "f1", status: "failing" }),
        createTestFeature({ id: "f2", status: "passing" }),
        createTestFeature({ id: "f3", dependsOn: ["f1", "f2"] }),
      ];
      const blocking = getBlockingFeatures(features, "f3");

      expect(blocking).toHaveLength(1);
      expect(blocking[0].id).toBe("f1");
    });

    it("should return empty if all dependencies passing", () => {
      const features = [
        createTestFeature({ id: "f1", status: "passing" }),
        createTestFeature({ id: "f2", status: "passing" }),
        createTestFeature({ id: "f3", dependsOn: ["f1", "f2"] }),
      ];
      const blocking = getBlockingFeatures(features, "f3");

      expect(blocking).toHaveLength(0);
    });

    it("should return empty for feature without dependencies", () => {
      const features = [createTestFeature({ id: "f1", dependsOn: [] })];
      const blocking = getBlockingFeatures(features, "f1");

      expect(blocking).toHaveLength(0);
    });
  });

  describe("areDependenciesSatisfied", () => {
    it("should return true when all dependencies passing", () => {
      const features = [
        createTestFeature({ id: "f1", status: "passing" }),
        createTestFeature({ id: "f2", dependsOn: ["f1"] }),
      ];
      expect(areDependenciesSatisfied(features, "f2")).toBe(true);
    });

    it("should return false when any dependency not passing", () => {
      const features = [
        createTestFeature({ id: "f1", status: "failing" }),
        createTestFeature({ id: "f2", dependsOn: ["f1"] }),
      ];
      expect(areDependenciesSatisfied(features, "f2")).toBe(false);
    });

    it("should return true for feature without dependencies", () => {
      const features = [createTestFeature({ id: "f1", dependsOn: [] })];
      expect(areDependenciesSatisfied(features, "f1")).toBe(true);
    });
  });

  describe("getReadyFeatures", () => {
    it("should return failing features with satisfied dependencies", () => {
      const features = [
        createTestFeature({ id: "f1", status: "passing" }),
        createTestFeature({ id: "f2", status: "failing", dependsOn: ["f1"] }),
        createTestFeature({ id: "f3", status: "failing", dependsOn: [] }),
      ];
      const ready = getReadyFeatures(features);

      expect(ready).toHaveLength(2);
      expect(ready.map((f) => f.id)).toContain("f2");
      expect(ready.map((f) => f.id)).toContain("f3");
    });

    it("should exclude features with unsatisfied dependencies", () => {
      const features = [
        createTestFeature({ id: "f1", status: "failing" }),
        createTestFeature({ id: "f2", status: "failing", dependsOn: ["f1"] }),
      ];
      const ready = getReadyFeatures(features);

      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe("f1");
    });

    it("should exclude passing features", () => {
      const features = [
        createTestFeature({ id: "f1", status: "passing" }),
        createTestFeature({ id: "f2", status: "failing" }),
      ];
      const ready = getReadyFeatures(features);

      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe("f2");
    });
  });

  describe("sortByDependencyOrder", () => {
    it("should sort features with dependencies last", () => {
      const features = [
        createTestFeature({ id: "f3", dependsOn: ["f2"] }),
        createTestFeature({ id: "f1", dependsOn: [] }),
        createTestFeature({ id: "f2", dependsOn: ["f1"] }),
      ];
      const sorted = sortByDependencyOrder(features);

      const ids = sorted.map((f) => f.id);
      expect(ids.indexOf("f1")).toBeLessThan(ids.indexOf("f2"));
      expect(ids.indexOf("f2")).toBeLessThan(ids.indexOf("f3"));
    });

    it("should handle features without dependencies", () => {
      const features = [
        createTestFeature({ id: "f1", dependsOn: [] }),
        createTestFeature({ id: "f2", dependsOn: [] }),
      ];
      const sorted = sortByDependencyOrder(features);

      expect(sorted).toHaveLength(2);
    });

    it("should handle circular dependencies gracefully", () => {
      const features = [
        createTestFeature({ id: "f1", dependsOn: ["f2"] }),
        createTestFeature({ id: "f2", dependsOn: ["f1"] }),
      ];
      const sorted = sortByDependencyOrder(features);

      expect(sorted).toHaveLength(2);
      // Should not throw or hang
    });
  });

  describe("getDependencyDepth", () => {
    it("should return 0 for feature without dependencies", () => {
      const features = [createTestFeature({ id: "f1", dependsOn: [] })];
      const depth = getDependencyDepth(features, "f1");

      expect(depth).toBe(0);
    });

    it("should calculate depth correctly", () => {
      const features = [
        createTestFeature({ id: "f1", dependsOn: [] }),
        createTestFeature({ id: "f2", dependsOn: ["f1"] }),
        createTestFeature({ id: "f3", dependsOn: ["f2"] }),
        createTestFeature({ id: "f4", dependsOn: ["f3"] }),
      ];

      expect(getDependencyDepth(features, "f1")).toBe(0);
      expect(getDependencyDepth(features, "f2")).toBe(1);
      expect(getDependencyDepth(features, "f3")).toBe(2);
      expect(getDependencyDepth(features, "f4")).toBe(3);
    });

    it("should handle multiple dependencies", () => {
      const features = [
        createTestFeature({ id: "f1", dependsOn: [] }),
        createTestFeature({ id: "f2", dependsOn: [] }),
        createTestFeature({ id: "f3", dependsOn: ["f1", "f2"] }),
      ];
      const depth = getDependencyDepth(features, "f3");

      expect(depth).toBe(1);
    });
  });
});
