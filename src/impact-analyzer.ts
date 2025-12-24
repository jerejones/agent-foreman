/**
 * Impact analyzer for feature changes
 * Identifies features affected by changes to a given feature
 */
import type { Feature, FeatureStatus, ImpactResult, ImpactRecommendation } from "./types/index.js";

/**
 * Analyze the impact of changes to a feature
 */
export function analyzeImpact(
  features: Feature[],
  changedFeatureId: string,
  changedModule: string
): ImpactResult {
  // Find directly dependent features (those that depend on the changed feature)
  const directlyAffected = features.filter(
    (f) => f.dependsOn.includes(changedFeatureId) && f.status !== "deprecated"
  );

  // Find features in the same module that might be affected
  const potentiallyAffected = features.filter(
    (f) =>
      f.module === changedModule &&
      f.id !== changedFeatureId &&
      f.status !== "deprecated" &&
      !directlyAffected.includes(f)
  );

  const recommendations: ImpactRecommendation[] = [];

  // Recommend marking directly affected features for review
  for (const feature of directlyAffected) {
    if (feature.status === "passing") {
      recommendations.push({
        featureId: feature.id,
        action: "mark_needs_review",
        reason: `Depends on changed feature ${changedFeatureId}`,
      });
    }
  }

  // For same-module features with passing status, suggest notes update
  for (const feature of potentiallyAffected) {
    if (feature.status === "passing") {
      recommendations.push({
        featureId: feature.id,
        action: "update_notes",
        reason: `Same module as changed feature ${changedFeatureId}`,
      });
    }
  }

  // Find and recommend deprecation for features superseded by the changed feature
  const supersededFeatures = features.filter(
    (f) =>
      f.supersedes?.includes(changedFeatureId) ||
      (f.id !== changedFeatureId &&
        f.supersedes?.length === 0 &&
        f.status !== "deprecated" &&
        features.some((other) => other.id === changedFeatureId && other.supersedes?.includes(f.id)))
  );

  for (const feature of supersededFeatures) {
    if (feature.status !== "deprecated") {
      recommendations.push({
        featureId: feature.id,
        action: "mark_deprecated",
        reason: `Superseded by ${changedFeatureId}`,
      });
    }
  }

  return {
    directlyAffected,
    potentiallyAffected,
    recommendations,
  };
}

/**
 * Apply impact recommendations to features
 */
export function applyImpactRecommendations(
  features: Feature[],
  recommendations: ImpactRecommendation[]
): Feature[] {
  return features.map((f) => {
    const rec = recommendations.find((r) => r.featureId === f.id);
    if (!rec) return f;

    switch (rec.action) {
      case "mark_needs_review":
        return {
          ...f,
          status: "needs_review" as FeatureStatus,
          notes: appendNote(f.notes, rec.reason),
        };
      case "mark_deprecated":
        return {
          ...f,
          status: "deprecated" as FeatureStatus,
          notes: appendNote(f.notes, rec.reason),
        };
      case "update_notes":
        return {
          ...f,
          notes: appendNote(f.notes, rec.reason),
        };
      default:
        return f;
    }
  });
}

/**
 * Append a note to existing notes
 */
function appendNote(existing: string, newNote: string): string {
  if (!existing) return newNote;
  return `${existing}; ${newNote}`;
}

/**
 * Build a dependency graph for all tasks
 * Returns a map of task ID -> IDs of tasks that depend on it
 */
export function buildDependencyGraph(features: Feature[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  // Initialize all nodes
  for (const feature of features) {
    if (!graph.has(feature.id)) {
      graph.set(feature.id, []);
    }

    // Add reverse dependencies (who depends on each feature)
    for (const depId of feature.dependsOn) {
      if (!graph.has(depId)) {
        graph.set(depId, []);
      }
      graph.get(depId)!.push(feature.id);
    }
  }

  return graph;
}

/**
 * Find all features in the chain of dependencies
 */
export function findAffectedChain(
  graph: Map<string, string[]>,
  startId: string,
  visited: Set<string> = new Set()
): string[] {
  if (visited.has(startId)) return [];
  visited.add(startId);

  const dependents = graph.get(startId) || [];
  const chain = [...dependents];

  for (const dep of dependents) {
    chain.push(...findAffectedChain(graph, dep, visited));
  }

  return chain;
}

/**
 * Get the full impact chain for a feature
 */
export function getFullImpactChain(features: Feature[], featureId: string): string[] {
  const graph = buildDependencyGraph(features);
  return findAffectedChain(graph, featureId);
}

/**
 * Check if changing a feature would create a circular dependency
 */
export function wouldCreateCircularDependency(
  features: Feature[],
  featureId: string,
  newDependency: string
): boolean {
  // Get all features that depend on featureId (directly or indirectly)
  const dependents = getFullImpactChain(features, featureId);

  // If the new dependency is in the chain, it would create a cycle
  return dependents.includes(newDependency);
}

/**
 * Get features that are blocking a given feature
 */
export function getBlockingFeatures(features: Feature[], featureId: string): Feature[] {
  const feature = features.find((f) => f.id === featureId);
  if (!feature) return [];

  return feature.dependsOn
    .map((depId) => features.find((f) => f.id === depId))
    .filter((f): f is Feature => f !== undefined && f.status !== "passing");
}

/**
 * Check if all dependencies of a feature are satisfied (passing)
 */
export function areDependenciesSatisfied(features: Feature[], featureId: string): boolean {
  const blocking = getBlockingFeatures(features, featureId);
  return blocking.length === 0;
}

/**
 * Get features ready to work on (all dependencies passing)
 */
export function getReadyFeatures(features: Feature[]): Feature[] {
  return features.filter(
    (f) =>
      f.status === "failing" &&
      areDependenciesSatisfied(features, f.id)
  );
}

/**
 * Sort features by dependency order (topological sort)
 * Features with no dependencies come first
 */
export function sortByDependencyOrder(features: Feature[]): Feature[] {
  const sorted: Feature[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const featureMap = new Map(features.map((f) => [f.id, f]));

  function visit(feature: Feature): void {
    if (visited.has(feature.id)) return;
    if (visiting.has(feature.id)) {
      // Circular dependency detected, skip
      return;
    }

    visiting.add(feature.id);

    // Visit dependencies first
    for (const depId of feature.dependsOn) {
      const dep = featureMap.get(depId);
      if (dep) visit(dep);
    }

    visiting.delete(feature.id);
    visited.add(feature.id);
    sorted.push(feature);
  }

  for (const feature of features) {
    visit(feature);
  }

  return sorted;
}

/**
 * Calculate the depth of a feature in the dependency tree
 */
export function getDependencyDepth(features: Feature[], featureId: string): number {
  const featureMap = new Map(features.map((f) => [f.id, f]));
  const cache = new Map<string, number>();

  function calculateDepth(id: string, visited: Set<string>): number {
    if (cache.has(id)) return cache.get(id)!;
    if (visited.has(id)) return 0; // Circular dependency

    const feature = featureMap.get(id);
    if (!feature || feature.dependsOn.length === 0) {
      cache.set(id, 0);
      return 0;
    }

    visited.add(id);
    const maxDepDepth = Math.max(
      ...feature.dependsOn.map((depId) => calculateDepth(depId, new Set(visited)))
    );
    const depth = maxDepDepth + 1;
    cache.set(id, depth);
    return depth;
  }

  return calculateDepth(featureId, new Set());
}
