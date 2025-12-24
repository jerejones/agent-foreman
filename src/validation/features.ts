/**
 * Feature validation for AI-generated content
 *
 * Validates that AI-generated features match the expected schema
 * before they are merged into the feature list.
 */

import type { DiscoveredFeature, Feature, FeatureStatus, FeatureOrigin } from "../types/index.js";

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  /** Sanitized/fixed data (if recoverable) */
  sanitized?: DiscoveredFeature[];
}

export interface ValidationError {
  index: number;
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationWarning {
  index: number;
  field: string;
  message: string;
  value?: unknown;
}

const VALID_STATUSES: FeatureStatus[] = [
  "failing",
  "passing",
  "blocked",
  "needs_review",
  "failed",
  "deprecated",
];

const VALID_ORIGINS: FeatureOrigin[] = [
  "init-auto",
  "init-from-routes",
  "init-from-tests",
  "manual",
  "replan",
];

const VALID_SOURCES = ["route", "test", "controller", "model", "inferred", "feature_list"] as const;

/**
 * Validate a single discovered feature
 */
export function validateDiscoveredFeature(
  feature: unknown,
  index: number
): { errors: ValidationError[]; warnings: ValidationWarning[]; sanitized?: DiscoveredFeature } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (typeof feature !== "object" || feature === null) {
    errors.push({
      index,
      field: "root",
      message: "Feature must be an object",
      value: feature,
    });
    return { errors, warnings };
  }

  const f = feature as Record<string, unknown>;
  const sanitized: Partial<DiscoveredFeature> = {};

  // Required: id (string, non-empty)
  if (typeof f.id !== "string" || f.id.trim().length === 0) {
    errors.push({
      index,
      field: "id",
      message: "Feature id must be a non-empty string",
      value: f.id,
    });
  } else {
    // Validate id format (should be dot-notation like "auth.login")
    // Must have at least one dot and use lowercase with alphanumeric segments
    const idPattern = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;
    if (!idPattern.test(f.id)) {
      warnings.push({
        index,
        field: "id",
        message: `Feature id "${f.id}" should use dot notation (e.g., "module.action")`,
        value: f.id,
      });
    }
    sanitized.id = f.id.trim();
  }

  // Required: description (string, non-empty)
  if (typeof f.description !== "string" || f.description.trim().length === 0) {
    errors.push({
      index,
      field: "description",
      message: "Feature description must be a non-empty string",
      value: f.description,
    });
  } else {
    sanitized.description = f.description.trim();
  }

  // Required: module (string, non-empty)
  if (typeof f.module !== "string" || f.module.trim().length === 0) {
    // Try to infer from id
    if (sanitized.id && sanitized.id.includes(".")) {
      sanitized.module = sanitized.id.split(".")[0];
      warnings.push({
        index,
        field: "module",
        message: `Module inferred from id: "${sanitized.module}"`,
        value: f.module,
      });
    } else {
      errors.push({
        index,
        field: "module",
        message: "Feature module must be a non-empty string",
        value: f.module,
      });
    }
  } else {
    sanitized.module = f.module.trim();
  }

  // Required: source (enum)
  if (typeof f.source !== "string" || !VALID_SOURCES.includes(f.source as typeof VALID_SOURCES[number])) {
    // Default to "inferred" for AI-generated features
    sanitized.source = "inferred";
    if (f.source !== undefined) {
      warnings.push({
        index,
        field: "source",
        message: `Invalid source "${f.source}", defaulting to "inferred"`,
        value: f.source,
      });
    }
  } else {
    sanitized.source = f.source as DiscoveredFeature["source"];
  }

  // Required: confidence (number 0-1)
  if (typeof f.confidence !== "number" || isNaN(f.confidence)) {
    // Default confidence for AI-generated
    sanitized.confidence = 0.7;
    if (f.confidence !== undefined) {
      warnings.push({
        index,
        field: "confidence",
        message: `Invalid confidence "${f.confidence}", defaulting to 0.7`,
        value: f.confidence,
      });
    }
  } else {
    // Clamp to valid range
    sanitized.confidence = Math.max(0, Math.min(1, f.confidence));
    if (f.confidence < 0 || f.confidence > 1) {
      warnings.push({
        index,
        field: "confidence",
        message: `Confidence ${f.confidence} clamped to range [0, 1]`,
        value: f.confidence,
      });
    }
  }

  // Optional: status (enum)
  if (f.status !== undefined) {
    if (typeof f.status !== "string" || !VALID_STATUSES.includes(f.status as FeatureStatus)) {
      warnings.push({
        index,
        field: "status",
        message: `Invalid status "${f.status}", ignoring`,
        value: f.status,
      });
    } else {
      sanitized.status = f.status as FeatureStatus;
    }
  }

  // Return sanitized if no critical errors
  if (errors.length === 0 && sanitized.id && sanitized.description && sanitized.module) {
    return {
      errors,
      warnings,
      sanitized: sanitized as DiscoveredFeature,
    };
  }

  return { errors, warnings };
}

/**
 * Validate an array of discovered features from AI
 *
 * @param features - The AI-generated features array
 * @returns Validation result with errors, warnings, and sanitized data
 */
export function validateDiscoveredFeatures(features: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const sanitized: DiscoveredFeature[] = [];

  // Must be an array
  if (!Array.isArray(features)) {
    errors.push({
      index: -1,
      field: "root",
      message: "Features must be an array",
      value: typeof features,
    });
    return { valid: false, errors, warnings };
  }

  // Validate each feature
  for (let i = 0; i < features.length; i++) {
    const result = validateDiscoveredFeature(features[i], i);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
    if (result.sanitized) {
      sanitized.push(result.sanitized);
    }
  }

  // Check for duplicate IDs
  const ids = new Set<string>();
  for (let i = 0; i < sanitized.length; i++) {
    const id = sanitized[i].id;
    if (ids.has(id)) {
      warnings.push({
        index: i,
        field: "id",
        message: `Duplicate feature id "${id}"`,
        value: id,
      });
    }
    ids.add(id);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitized: sanitized.length > 0 ? sanitized : undefined,
  };
}

/**
 * Validate a complete Feature object
 */
export function validateFeature(feature: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof feature !== "object" || feature === null) {
    return { valid: false, errors: ["Feature must be an object"] };
  }

  const f = feature as Record<string, unknown>;

  // Required string fields
  const requiredStrings = ["id", "description", "module", "notes"];
  for (const field of requiredStrings) {
    if (typeof f[field] !== "string") {
      errors.push(`${field} must be a string`);
    }
  }

  // Required number fields
  if (typeof f.priority !== "number" || !Number.isInteger(f.priority) || f.priority < 0) {
    errors.push("priority must be a non-negative integer");
  }
  if (typeof f.version !== "number" || !Number.isInteger(f.version) || f.version < 1) {
    errors.push("version must be a positive integer");
  }

  // Required enum fields
  if (!VALID_STATUSES.includes(f.status as FeatureStatus)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(", ")}`);
  }
  if (!VALID_ORIGINS.includes(f.origin as FeatureOrigin)) {
    errors.push(`origin must be one of: ${VALID_ORIGINS.join(", ")}`);
  }

  // Required array fields
  const requiredArrays = ["acceptance", "dependsOn", "supersedes", "tags"];
  for (const field of requiredArrays) {
    if (!Array.isArray(f[field])) {
      errors.push(`${field} must be an array`);
    }
  }

  return { valid: errors.length === 0, errors };
}
