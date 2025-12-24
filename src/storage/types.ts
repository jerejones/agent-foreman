/**
 * Types specific to storage module
 */

/**
 * Result of a migration operation
 */
export interface MigrationResult {
  /** Number of features successfully migrated */
  migrated: number;
  /** Errors encountered during migration */
  errors: string[];
  /** Whether the migration was successful overall */
  success: boolean;
}
