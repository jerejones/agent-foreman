/**
 * Feature factory functions for creating new features
 */
import type {
  Feature,
  FeatureList,
  DiscoveredFeature,
  TDDMode,
} from "../types/index.js";

/**
 * Generate test pattern based on feature module
 *
 * Strategy:
 * Use module name to create glob pattern: tests/{module}/**\/*.test.*
 *
 * @param module - Feature module name (e.g., "auth", "verification")
 * @returns Glob pattern for related tests
 */
export function generateTestPattern(module: string): string {
  const sanitizedModule = module.replace(/[^a-zA-Z0-9_-]/g, "");
  return `tests/${sanitizedModule}/**/*.test.*`;
}

/**
 * Generate default testRequirements for a feature
 *
 * @param module - Feature module name
 * @returns Default TestRequirements with pattern
 */
export function generateTestRequirements(module: string): { unit: { required: boolean; pattern: string } } {
  return {
    unit: {
      required: false,
      pattern: generateTestPattern(module),
    },
  };
}

/**
 * Convert discovered feature to full Feature object
 */
export function discoveredToFeature(
  discovered: DiscoveredFeature,
  index: number
): Feature {
  return {
    id: discovered.id,
    description: discovered.description,
    module: discovered.module,
    priority: 10 + index, // Default priority
    status: "failing",
    acceptance: [`${discovered.description} works as expected`],
    dependsOn: [],
    supersedes: [],
    tags: [discovered.source],
    version: 1,
    origin:
      discovered.source === "route"
        ? "init-from-routes"
        : discovered.source === "test"
          ? "init-from-tests"
          : "init-auto",
    notes: "",
    testRequirements: generateTestRequirements(discovered.module),
  };
}

/**
 * Create an empty feature list with metadata
 *
 * @param goal - Project goal description
 * @param tddMode - Optional TDD enforcement mode
 */
export function createEmptyFeatureList(goal: string, tddMode?: TDDMode): FeatureList {
  const now = new Date().toISOString();
  return {
    $schema: "./feature_list.schema.json",
    features: [],
    metadata: {
      projectGoal: goal,
      createdAt: now,
      updatedAt: now,
      version: "1.0.0",
      ...(tddMode && { tddMode }),
    },
  };
}

/**
 * Migrate a feature list to strict TDD mode
 * In strict mode, all features require unit tests
 *
 * @param list - Feature list to migrate
 * @returns Migrated list and count of features migrated
 */
export function migrateToStrictTDD(list: FeatureList): { list: FeatureList; migratedCount: number } {
  if (list.metadata.tddMode !== "strict") {
    return { list, migratedCount: 0 };
  }

  let migratedCount = 0;
  const features = list.features.map((feature) => {
    // Skip if already has required tests
    if (feature.testRequirements?.unit?.required) {
      return feature;
    }

    migratedCount++;
    return {
      ...feature,
      testRequirements: {
        ...feature.testRequirements,
        unit: {
          ...feature.testRequirements?.unit,
          required: true,
          pattern: feature.testRequirements?.unit?.pattern || generateTestPattern(feature.module),
        },
      },
    };
  });

  return {
    list: {
      ...list,
      features,
      metadata: {
        ...list.metadata,
        updatedAt: new Date().toISOString(),
      },
    },
    migratedCount,
  };
}


/**
 * Create a new feature from user input
 */
export function createFeature(
  id: string,
  description: string,
  module: string,
  acceptance: string[],
  options: Partial<Omit<Feature, "id" | "description" | "module" | "acceptance">> = {}
): Feature {
  return {
    id,
    description,
    module,
    acceptance,
    priority: options.priority ?? 10,
    status: options.status ?? "failing",
    dependsOn: options.dependsOn ?? [],
    supersedes: options.supersedes ?? [],
    tags: options.tags ?? [],
    version: options.version ?? 1,
    origin: options.origin ?? "manual",
    notes: options.notes ?? "",
    testRequirements: options.testRequirements ?? generateTestRequirements(module),
  };
}

/** Alias for createEmptyFeatureList - creates empty task list */
export const createEmptyTaskList = createEmptyFeatureList;

/** Alias for createFeature - creates task */
export const createTask = createFeature;
