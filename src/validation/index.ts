/**
 * Validation module for AI-generated content
 *
 * Provides schema validation to ensure AI outputs match expected types
 * before they are used in the system.
 */

export { validateDiscoveredFeatures, validateFeature, type ValidationResult } from "./features.js";
export { validateBashScript, isLikelyBashScript, type BashValidationResult } from "./bash.js";
