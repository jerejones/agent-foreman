/**
 * JSON Schema validation for YAML frontmatter in feature markdown files
 */
import { createAjv, executeValidation, type ValidationResult } from "./common.js";

/**
 * JSON Schema for YAML frontmatter in feature markdown files
 */
export const featureFrontmatterSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["id", "module", "priority", "status", "version", "origin"],
  properties: {
    id: {
      type: "string",
      minLength: 1,
      description: "Unique task identifier",
    },
    module: {
      type: "string",
      minLength: 1,
      description: "Parent module or subsystem name",
    },
    priority: {
      type: "integer",
      minimum: 0,
      description: "Priority level (lower = higher priority, 0 is highest)",
    },
    status: {
      type: "string",
      enum: ["failing", "passing", "blocked", "needs_review", "failed", "deprecated"],
      description: "Current feature status",
    },
    version: {
      type: "integer",
      minimum: 1,
      description: "Version number",
    },
    origin: {
      type: "string",
      enum: ["init-auto", "init-from-routes", "init-from-tests", "manual", "replan"],
      description: "How this feature was created",
    },
    dependsOn: {
      type: "array",
      items: { type: "string" },
      default: [],
      description: "Task IDs this task depends on",
    },
    supersedes: {
      type: "array",
      items: { type: "string" },
      default: [],
      description: "Task IDs this task replaces",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      default: [],
      description: "Categorization tags",
    },
    verification: {
      type: "object",
      properties: {
        verifiedAt: {
          type: "string",
          format: "date-time",
          description: "Last verification timestamp (ISO 8601)",
        },
        verdict: {
          type: "string",
          enum: ["pass", "fail", "needs_review"],
          description: "Verification verdict",
        },
        verifiedBy: {
          type: "string",
          description: "Agent that performed verification",
        },
        commitHash: {
          type: "string",
          description: "Git commit hash at verification time",
        },
        summary: {
          type: "string",
          description: "Brief summary of the verification result",
        },
      },
      required: ["verifiedAt", "verdict", "verifiedBy", "summary"],
      additionalProperties: false,
      description: "Last verification result",
    },
    testRequirements: {
      type: "object",
      properties: {
        unit: {
          type: "object",
          properties: {
            required: { type: "boolean" },
            pattern: { type: "string" },
            cases: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["required"],
          additionalProperties: false,
        },
        e2e: {
          type: "object",
          properties: {
            required: { type: "boolean" },
            pattern: { type: "string" },
            tags: {
              type: "array",
              items: { type: "string" },
            },
            scenarios: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["required"],
          additionalProperties: false,
        },
      },
      additionalProperties: false,
      description: "Test requirements for TDD workflow",
    },
    e2eTags: {
      type: "array",
      items: { type: "string" },
      description: "E2E test tags for selective Playwright test execution",
    },
  },
  additionalProperties: false,
};

/**
 * Create a frontmatter validator
 */
export function createFrontmatterValidator() {
  const ajv = createAjv();
  return ajv.compile(featureFrontmatterSchema);
}

// Cached frontmatter validator instance
let cachedFrontmatterValidator: ReturnType<typeof createFrontmatterValidator> | null = null;

/**
 * Get or create cached frontmatter validator
 */
function getFrontmatterValidator() {
  if (!cachedFrontmatterValidator) {
    cachedFrontmatterValidator = createFrontmatterValidator();
  }
  return cachedFrontmatterValidator;
}

/**
 * Validate YAML frontmatter from a feature markdown file
 */
export function validateFeatureFrontmatter(data: unknown): ValidationResult {
  const validate = getFrontmatterValidator();
  return executeValidation(validate, data);
}
