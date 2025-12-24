/**
 * Optimistic locking error types
 * Used to detect and handle concurrent modifications
 */

/**
 * Base class for optimistic locking conflicts
 */
export class OptimisticLockError extends Error {
  constructor(
    message: string,
    public readonly resourceType: "index" | "feature",
    public readonly resourceId: string
  ) {
    super(message);
    this.name = "OptimisticLockError";
  }
}

/**
 * Conflict detected when saving index.json
 * Thrown when updatedAt timestamp doesn't match expected value
 */
export class IndexConflictError extends OptimisticLockError {
  constructor(
    public readonly expectedUpdatedAt: string,
    public readonly actualUpdatedAt: string
  ) {
    super(
      `Index conflict: expected updatedAt=${expectedUpdatedAt}, found ${actualUpdatedAt}`,
      "index",
      "index.json"
    );
    this.name = "IndexConflictError";
  }
}

/**
 * Conflict detected when saving a feature .md file
 * Thrown when version number doesn't match expected value
 */
export class FeatureConflictError extends OptimisticLockError {
  constructor(
    featureId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number
  ) {
    super(
      `Feature conflict for ${featureId}: expected version=${expectedVersion}, found ${actualVersion}`,
      "feature",
      featureId
    );
    this.name = "FeatureConflictError";
  }
}
