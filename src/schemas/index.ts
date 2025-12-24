/**
 * Schema validation module
 *
 * Re-exports all schema validation utilities for feature storage
 */

// Common types
export type { ValidationResult } from "./common.js";

// Feature list schema (legacy JSON format)
export {
  featureListSchema,
  createValidator,
  validateFeatureList,
  parseFeatureList,
  isValidFeatureId,
  isValidStatus,
} from "./feature-list.js";

// Feature index schema (ai/tasks/index.json)
export {
  featureIndexSchema,
  createIndexValidator,
  validateFeatureIndex,
} from "./feature-index.js";

// Feature frontmatter schema (YAML in markdown files)
export {
  featureFrontmatterSchema,
  createFrontmatterValidator,
  validateFeatureFrontmatter,
} from "./feature-frontmatter.js";
