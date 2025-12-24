/**
 * JSON Schema validation for ai/tasks/index.json
 */
import { createAjv, executeValidation, type ValidationResult } from "./common.js";

/**
 * JSON Schema for FeatureIndexEntry
 */
const featureIndexEntrySchema = {
  type: "object",
  required: ["status", "priority", "module", "description"],
  properties: {
    status: {
      type: "string",
      enum: ["failing", "passing", "blocked", "needs_review", "failed", "deprecated"],
      description: "Current feature status",
    },
    priority: {
      type: "integer",
      minimum: 0,
      description: "Priority level (lower = higher priority, 0 is highest)",
    },
    module: {
      type: "string",
      minLength: 1,
      description: "Parent module or subsystem name",
    },
    description: {
      type: "string",
      minLength: 1,
      description: "Human-readable description of the feature",
    },
    filePath: {
      type: "string",
      description: "Optional explicit file path (relative to ai/tasks/) when filename doesn't follow ID convention",
    },
  },
  additionalProperties: false,
};

/**
 * JSON Schema for ai/tasks/index.json
 */
export const featureIndexSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["version", "updatedAt", "metadata", "features"],
  properties: {
    version: {
      type: "string",
      description: "Index format version (e.g., '2.0.0')",
    },
    updatedAt: {
      type: "string",
      format: "date-time",
      description: "ISO 8601 timestamp of last update",
    },
    metadata: {
      type: "object",
      required: ["projectGoal", "createdAt", "updatedAt", "version"],
      properties: {
        projectGoal: {
          type: "string",
          description: "Project goal description",
        },
        createdAt: {
          type: "string",
          format: "date-time",
          description: "ISO 8601 timestamp of creation",
        },
        updatedAt: {
          type: "string",
          format: "date-time",
          description: "ISO 8601 timestamp of last update",
        },
        version: {
          type: "string",
          description: "Schema version",
        },
        tddMode: {
          type: "string",
          enum: ["strict", "recommended", "disabled"],
          description: "TDD enforcement mode",
        },
      },
      additionalProperties: false,
    },
    features: {
      type: "object",
      additionalProperties: featureIndexEntrySchema,
      description: "Map of task IDs to index entries",
    },
  },
  additionalProperties: false,
};

/**
 * Create a feature index validator
 */
export function createIndexValidator() {
  const ajv = createAjv();
  return ajv.compile(featureIndexSchema);
}

// Cached index validator instance
let cachedIndexValidator: ReturnType<typeof createIndexValidator> | null = null;

/**
 * Get or create cached index validator
 */
function getIndexValidator() {
  if (!cachedIndexValidator) {
    cachedIndexValidator = createIndexValidator();
  }
  return cachedIndexValidator;
}

/**
 * Validate a feature index object
 */
export function validateFeatureIndex(data: unknown): ValidationResult {
  const validate = getIndexValidator();
  return executeValidation(validate, data);
}
