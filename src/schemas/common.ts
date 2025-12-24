/**
 * Common utilities for JSON schema validation
 */
import Ajv, { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Create a configured AJV instance
 */
export function createAjv(): Ajv {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv;
}

/**
 * Execute validation and format result
 */
export function executeValidation(validate: ValidateFunction, data: unknown): ValidationResult {
  const valid = validate(data);

  if (!valid && validate.errors) {
    return {
      valid: false,
      errors: validate.errors.map((e) => {
        const path = e.instancePath || "(root)";
        return `${path}: ${e.message}`;
      }),
    };
  }

  return { valid: true, errors: [] };
}
