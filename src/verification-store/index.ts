/**
 * Verification Store
 *
 * Persistence layer for verification results.
 * Stores verification data in per-feature subdirectories under ai/verification/
 *
 * New structure:
 *   ai/verification/
 *   ├── index.json              # Summary index for quick lookups
 *   ├── {featureId}/
 *   │   ├── 001.json            # Run 1 metadata (compact)
 *   │   ├── 001.md              # Run 1 detailed report
 *   │   ├── 002.json            # Run 2 metadata
 *   │   └── 002.md              # Run 2 detailed report
 *   └── ...
 *
 * Legacy structure (deprecated):
 *   ai/verification/results.json
 */

// Constants
export {
  VERIFICATION_STORE_DIR,
  VERIFICATION_STORE_FILE,
  VERIFICATION_STORE_PATH,
  VERIFICATION_INDEX_FILE,
  VERIFICATION_INDEX_PATH,
  STORE_VERSION,
  INDEX_VERSION,
} from "./constants.js";

// Legacy Store Operations (for backward compatibility)
export {
  createEmptyStore,
  loadVerificationStore,
} from "./legacy-store.js";

// Index Operations
export {
  createEmptyIndex,
  loadVerificationIndex,
  getNextRunNumber,
} from "./index-operations.js";

// Main Store Operations
export {
  saveVerificationResult,
  getLastVerification,
  getVerificationHistory,
  clearVerificationResult,
  getAllVerificationResults,
  hasVerification,
  getVerificationStats,
  getFeatureSummary,
} from "./store-operations.js";

// Migration Operations
export {
  needsMigration,
  migrateResultsJson,
  autoMigrateIfNeeded,
} from "./migration.js";
