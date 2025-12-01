/**
 * Persistence layer for verification results
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

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
  VerificationStore,
  VerificationResult,
  VerificationIndex,
  FeatureSummary,
  VerificationMetadata,
} from "./verification-types.js";
import {
  generateVerificationReport,
  generateVerificationSummary,
} from "./verification-report.js";

// ============================================================================
// Constants
// ============================================================================

/** Path to verification store relative to project root */
export const VERIFICATION_STORE_DIR = "ai/verification";
export const VERIFICATION_STORE_FILE = "results.json";
export const VERIFICATION_STORE_PATH = `${VERIFICATION_STORE_DIR}/${VERIFICATION_STORE_FILE}`;
export const VERIFICATION_INDEX_FILE = "index.json";
export const VERIFICATION_INDEX_PATH = `${VERIFICATION_STORE_DIR}/${VERIFICATION_INDEX_FILE}`;

/** Current store schema version */
export const STORE_VERSION = "1.0.0";
/** Current index schema version */
export const INDEX_VERSION = "2.0.0";

// ============================================================================
// Legacy Store Operations (for backward compatibility)
// ============================================================================

/**
 * Create an empty verification store (legacy)
 * @deprecated Use createEmptyIndex instead
 */
export function createEmptyStore(): VerificationStore {
  return {
    results: {},
    updatedAt: new Date().toISOString(),
    version: STORE_VERSION,
  };
}

/**
 * Load verification store from ai/verification/results.json (legacy)
 * Returns null if file doesn't exist, empty store if corrupted
 * @deprecated Use loadVerificationIndex instead
 */
export async function loadVerificationStore(
  cwd: string
): Promise<VerificationStore | null> {
  const storePath = path.join(cwd, VERIFICATION_STORE_PATH);

  try {
    const content = await fs.readFile(storePath, "utf-8");
    const store = JSON.parse(content) as VerificationStore;

    // Validate basic structure
    if (!store.results || typeof store.results !== "object") {
      console.warn(
        `[verification-store] Corrupted store file, returning empty store`
      );
      return createEmptyStore();
    }

    return store;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // File doesn't exist - this is normal for new projects
      return null;
    }

    // Parse error or other issue - return empty store
    console.warn(
      `[verification-store] Error loading store: ${error}, returning empty store`
    );
    return createEmptyStore();
  }
}

// ============================================================================
// New Index Operations
// ============================================================================

/**
 * Create an empty verification index
 */
export function createEmptyIndex(): VerificationIndex {
  return {
    features: {},
    updatedAt: new Date().toISOString(),
    version: INDEX_VERSION,
  };
}

/**
 * Load verification index from ai/verification/index.json
 * Returns null if file doesn't exist
 * Triggers auto-migration from legacy results.json if needed
 */
export async function loadVerificationIndex(
  cwd: string
): Promise<VerificationIndex | null> {
  const indexPath = path.join(cwd, VERIFICATION_INDEX_PATH);

  try {
    const content = await fs.readFile(indexPath, "utf-8");
    const index = JSON.parse(content) as VerificationIndex;

    // Validate basic structure
    if (!index.features || typeof index.features !== "object") {
      console.warn(
        `[verification-store] Corrupted index file, returning empty index`
      );
      return createEmptyIndex();
    }

    return index;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // Index doesn't exist - check if we need to migrate from legacy
      await performAutoMigration(cwd);

      // Try loading again after migration
      try {
        const content = await fs.readFile(indexPath, "utf-8");
        const index = JSON.parse(content) as VerificationIndex;
        if (index.features && typeof index.features === "object") {
          return index;
        }
      } catch {
        // Still doesn't exist after migration attempt
      }

      return null;
    }

    console.warn(
      `[verification-store] Error loading index: ${error}, returning empty index`
    );
    return createEmptyIndex();
  }
}

/**
 * Internal auto-migration helper (called during loadVerificationIndex)
 * Performs migration if old results.json exists and index.json doesn't
 */
async function performAutoMigration(cwd: string): Promise<void> {
  const storePath = path.join(cwd, VERIFICATION_STORE_PATH);

  try {
    // Check if old store exists
    await fs.access(storePath);

    // Old store exists - perform migration
    // We call the migration logic directly to avoid circular dependency
    const store = await loadVerificationStore(cwd);
    if (!store || Object.keys(store.results).length === 0) {
      return;
    }

    // Create new index
    const index = createEmptyIndex();
    let migratedCount = 0;

    for (const [featureId, result] of Object.entries(store.results)) {
      try {
        // Create feature directory
        const featureDir = path.join(cwd, VERIFICATION_STORE_DIR, featureId);
        await fs.mkdir(featureDir, { recursive: true });

        // Run number is 1 for migrated data
        const runNumber = 1;
        const runStr = String(runNumber).padStart(3, "0");

        // Write metadata JSON
        const metadata = {
          featureId: result.featureId,
          runNumber,
          timestamp: result.timestamp,
          commitHash: result.commitHash,
          changedFiles: result.changedFiles,
          diffSummary: result.diffSummary,
          automatedChecks: result.automatedChecks.map((c) => ({
            type: c.type,
            success: c.success,
            duration: c.duration,
            errorCount: c.errorCount,
          })),
          criteriaResults: result.criteriaResults.map((c) => ({
            criterion: c.criterion,
            index: c.index,
            satisfied: c.satisfied,
            confidence: c.confidence,
          })),
          verdict: result.verdict,
          verifiedBy: result.verifiedBy,
        };
        const jsonPath = path.join(featureDir, `${runStr}.json`);
        await fs.writeFile(jsonPath, JSON.stringify(metadata, null, 2), "utf-8");

        // Write markdown report
        const report = generateVerificationReport(result, runNumber);
        const mdPath = path.join(featureDir, `${runStr}.md`);
        await fs.writeFile(mdPath, report, "utf-8");

        // Update index
        index.features[featureId] = {
          featureId,
          latestRun: runNumber,
          latestTimestamp: result.timestamp,
          latestVerdict: result.verdict,
          totalRuns: 1,
          passCount: result.verdict === "pass" ? 1 : 0,
          failCount: result.verdict === "fail" ? 1 : 0,
        };

        migratedCount++;
      } catch (err) {
        console.warn(
          `[verification-store] Auto-migration: Failed to migrate ${featureId}: ${err}`
        );
      }
    }

    // Save new index
    await ensureVerificationDir(cwd);
    const indexPath = path.join(cwd, VERIFICATION_INDEX_PATH);
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf-8");

    // Backup old results.json
    const backupPath = path.join(cwd, VERIFICATION_STORE_DIR, "results.json.bak");
    try {
      await fs.copyFile(storePath, backupPath);
    } catch {
      // Ignore backup errors
    }

    if (migratedCount > 0) {
      console.log(
        `[verification-store] Auto-migrated ${migratedCount} verification results to new format`
      );
    }
  } catch {
    // Old store doesn't exist, nothing to migrate
  }
}

/**
 * Ensure the verification directory exists
 */
async function ensureVerificationDir(cwd: string): Promise<void> {
  const dirPath = path.join(cwd, VERIFICATION_STORE_DIR);
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Ensure a feature subdirectory exists
 */
async function ensureFeatureDir(cwd: string, featureId: string): Promise<string> {
  const featureDir = path.join(cwd, VERIFICATION_STORE_DIR, featureId);
  await fs.mkdir(featureDir, { recursive: true });
  return featureDir;
}

/**
 * Save the index to disk
 */
async function saveIndex(cwd: string, index: VerificationIndex): Promise<void> {
  await ensureVerificationDir(cwd);
  const indexPath = path.join(cwd, VERIFICATION_INDEX_PATH);
  const content = JSON.stringify(index, null, 2);
  await fs.writeFile(indexPath, content, "utf-8");
}

/**
 * Get the next run number for a feature
 */
async function getNextRunNumber(cwd: string, featureId: string): Promise<number> {
  const index = await loadVerificationIndex(cwd);
  if (index && index.features[featureId]) {
    return index.features[featureId].latestRun + 1;
  }
  return 1;
}

/**
 * Format run number to padded string (001, 002, etc.)
 */
function formatRunNumber(num: number): string {
  return String(num).padStart(3, "0");
}

/**
 * Convert VerificationResult to compact VerificationMetadata
 */
function toMetadata(result: VerificationResult, runNumber: number): VerificationMetadata {
  return {
    featureId: result.featureId,
    runNumber,
    timestamp: result.timestamp,
    commitHash: result.commitHash,
    changedFiles: result.changedFiles,
    diffSummary: result.diffSummary,
    automatedChecks: result.automatedChecks.map((c) => ({
      type: c.type,
      success: c.success,
      duration: c.duration,
      errorCount: c.errorCount,
      // Note: output excluded
    })),
    criteriaResults: result.criteriaResults.map((c) => ({
      criterion: c.criterion,
      index: c.index,
      satisfied: c.satisfied,
      confidence: c.confidence,
      // Note: reasoning and evidence excluded
    })),
    verdict: result.verdict,
    verifiedBy: result.verifiedBy,
  };
}

/**
 * Update the feature summary in the index
 */
function updateFeatureSummary(
  index: VerificationIndex,
  result: VerificationResult,
  runNumber: number
): void {
  const existing = index.features[result.featureId];

  if (existing) {
    // Update existing summary
    existing.latestRun = runNumber;
    existing.latestTimestamp = result.timestamp;
    existing.latestVerdict = result.verdict;
    existing.totalRuns = runNumber;
    if (result.verdict === "pass") {
      existing.passCount++;
    } else if (result.verdict === "fail") {
      existing.failCount++;
    }
  } else {
    // Create new summary
    index.features[result.featureId] = {
      featureId: result.featureId,
      latestRun: runNumber,
      latestTimestamp: result.timestamp,
      latestVerdict: result.verdict,
      totalRuns: 1,
      passCount: result.verdict === "pass" ? 1 : 0,
      failCount: result.verdict === "fail" ? 1 : 0,
    };
  }

  index.updatedAt = new Date().toISOString();
}

// ============================================================================
// Main Store Operations
// ============================================================================

/**
 * Save a verification result to the store
 * Creates per-feature subdirectory with JSON metadata and MD report
 */
export async function saveVerificationResult(
  cwd: string,
  result: VerificationResult
): Promise<void> {
  // Get next run number
  const runNumber = await getNextRunNumber(cwd, result.featureId);
  const runStr = formatRunNumber(runNumber);

  // Ensure feature directory exists
  const featureDir = await ensureFeatureDir(cwd, result.featureId);

  // Write metadata JSON (compact)
  const metadata = toMetadata(result, runNumber);
  const jsonPath = path.join(featureDir, `${runStr}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(metadata, null, 2), "utf-8");

  // Write markdown report (detailed)
  const report = generateVerificationReport(result, runNumber);
  const mdPath = path.join(featureDir, `${runStr}.md`);
  await fs.writeFile(mdPath, report, "utf-8");

  // Update index
  let index = await loadVerificationIndex(cwd);
  if (!index) {
    index = createEmptyIndex();
  }
  updateFeatureSummary(index, result, runNumber);
  await saveIndex(cwd, index);

  // Also save to legacy results.json for backward compatibility
  await saveLegacyResult(cwd, result);
}

/**
 * Save to legacy results.json for backward compatibility
 */
async function saveLegacyResult(
  cwd: string,
  result: VerificationResult
): Promise<void> {
  let store = await loadVerificationStore(cwd);
  if (!store) {
    store = createEmptyStore();
  }
  store.results[result.featureId] = result;
  store.updatedAt = new Date().toISOString();

  await ensureVerificationDir(cwd);
  const storePath = path.join(cwd, VERIFICATION_STORE_PATH);
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Get the last verification result for a feature
 * Tries new index first, falls back to legacy store
 */
export async function getLastVerification(
  cwd: string,
  featureId: string
): Promise<VerificationResult | null> {
  // Try new index structure first
  const index = await loadVerificationIndex(cwd);
  if (index && index.features[featureId]) {
    const summary = index.features[featureId];
    const runStr = formatRunNumber(summary.latestRun);
    const jsonPath = path.join(
      cwd,
      VERIFICATION_STORE_DIR,
      featureId,
      `${runStr}.json`
    );

    try {
      const content = await fs.readFile(jsonPath, "utf-8");
      const metadata = JSON.parse(content) as VerificationMetadata;

      // For full result, we need to read from legacy store or reconstruct
      // For now, return from legacy store which has full data
      const store = await loadVerificationStore(cwd);
      if (store && store.results[featureId]) {
        return store.results[featureId];
      }

      // If legacy doesn't have it, return minimal result from metadata
      return {
        featureId: metadata.featureId,
        timestamp: metadata.timestamp,
        commitHash: metadata.commitHash,
        changedFiles: metadata.changedFiles,
        diffSummary: metadata.diffSummary,
        automatedChecks: metadata.automatedChecks.map((c) => ({
          type: c.type,
          success: c.success,
          duration: c.duration,
          errorCount: c.errorCount,
        })),
        criteriaResults: metadata.criteriaResults.map((c) => ({
          criterion: c.criterion,
          index: c.index,
          satisfied: c.satisfied,
          confidence: c.confidence,
          reasoning: "", // Not stored in metadata
        })),
        verdict: metadata.verdict,
        verifiedBy: metadata.verifiedBy,
        overallReasoning: "", // Not stored in metadata
      };
    } catch {
      // Fall back to legacy store
    }
  }

  // Fall back to legacy store
  const store = await loadVerificationStore(cwd);
  if (!store) {
    return null;
  }
  return store.results[featureId] || null;
}

/**
 * Get all verification runs for a feature (history)
 */
export async function getVerificationHistory(
  cwd: string,
  featureId: string
): Promise<VerificationMetadata[]> {
  const featureDir = path.join(cwd, VERIFICATION_STORE_DIR, featureId);
  const results: VerificationMetadata[] = [];

  try {
    const files = await fs.readdir(featureDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();

    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(featureDir, file), "utf-8");
        const metadata = JSON.parse(content) as VerificationMetadata;
        results.push(metadata);
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Directory doesn't exist - no history
  }

  return results;
}

/**
 * Clear a verification result from the store
 */
export async function clearVerificationResult(
  cwd: string,
  featureId: string
): Promise<void> {
  // Clear from legacy store
  const store = await loadVerificationStore(cwd);
  if (store && store.results[featureId]) {
    delete store.results[featureId];
    store.updatedAt = new Date().toISOString();
    await ensureVerificationDir(cwd);
    const storePath = path.join(cwd, VERIFICATION_STORE_PATH);
    await fs.writeFile(storePath, JSON.stringify(store, null, 2), "utf-8");
  }

  // Clear from index
  const index = await loadVerificationIndex(cwd);
  if (index && index.features[featureId]) {
    delete index.features[featureId];
    index.updatedAt = new Date().toISOString();
    await saveIndex(cwd, index);
  }

  // Note: We don't delete the feature subdirectory to preserve history
}

/**
 * Get all verification results (summaries from index)
 */
export async function getAllVerificationResults(
  cwd: string
): Promise<Record<string, VerificationResult>> {
  // Return from legacy store for full results
  const store = await loadVerificationStore(cwd);
  return store?.results || {};
}

/**
 * Check if a feature has been verified
 */
export async function hasVerification(
  cwd: string,
  featureId: string
): Promise<boolean> {
  // Check index first
  const index = await loadVerificationIndex(cwd);
  if (index && index.features[featureId]) {
    return true;
  }

  // Fall back to legacy
  const result = await getLastVerification(cwd, featureId);
  return result !== null;
}

/**
 * Get verification summary statistics
 */
export async function getVerificationStats(cwd: string): Promise<{
  total: number;
  passing: number;
  failing: number;
  needsReview: number;
}> {
  // Try index first
  const index = await loadVerificationIndex(cwd);
  if (index && Object.keys(index.features).length > 0) {
    const summaries = Object.values(index.features);
    return {
      total: summaries.length,
      passing: summaries.filter((s) => s.latestVerdict === "pass").length,
      failing: summaries.filter((s) => s.latestVerdict === "fail").length,
      needsReview: summaries.filter((s) => s.latestVerdict === "needs_review").length,
    };
  }

  // Fall back to legacy
  const results = await getAllVerificationResults(cwd);
  const values = Object.values(results);

  return {
    total: values.length,
    passing: values.filter((r) => r.verdict === "pass").length,
    failing: values.filter((r) => r.verdict === "fail").length,
    needsReview: values.filter((r) => r.verdict === "needs_review").length,
  };
}

/**
 * Get feature summary from index
 */
export async function getFeatureSummary(
  cwd: string,
  featureId: string
): Promise<FeatureSummary | null> {
  const index = await loadVerificationIndex(cwd);
  if (!index) {
    return null;
  }
  return index.features[featureId] || null;
}

// ============================================================================
// Migration Operations
// ============================================================================

/**
 * Check if migration is needed
 * Returns true if old results.json exists but index.json doesn't
 */
export async function needsMigration(cwd: string): Promise<boolean> {
  const storePath = path.join(cwd, VERIFICATION_STORE_PATH);
  const indexPath = path.join(cwd, VERIFICATION_INDEX_PATH);

  try {
    // Check if old store exists
    await fs.access(storePath);
    // Check if new index doesn't exist
    try {
      await fs.access(indexPath);
      return false; // Both exist, no migration needed
    } catch {
      return true; // Old exists, new doesn't - migration needed
    }
  } catch {
    return false; // Old store doesn't exist, no migration needed
  }
}

/**
 * Migrate old results.json to new per-feature structure
 * Creates subdirectories, JSON/MD files, and index.json
 *
 * @param cwd - Project root directory
 * @returns Number of features migrated, or -1 if migration not needed
 */
export async function migrateResultsJson(cwd: string): Promise<number> {
  // Check if migration is needed
  if (!(await needsMigration(cwd))) {
    return -1;
  }

  // Load old store
  const store = await loadVerificationStore(cwd);
  if (!store || Object.keys(store.results).length === 0) {
    return 0;
  }

  // Create new index
  const index = createEmptyIndex();
  let migratedCount = 0;

  // Migrate each feature result
  for (const [featureId, result] of Object.entries(store.results)) {
    try {
      // Create feature directory
      const featureDir = await ensureFeatureDir(cwd, featureId);

      // Run number is 1 for migrated data
      const runNumber = 1;
      const runStr = formatRunNumber(runNumber);

      // Write metadata JSON
      const metadata = toMetadata(result, runNumber);
      const jsonPath = path.join(featureDir, `${runStr}.json`);
      await fs.writeFile(jsonPath, JSON.stringify(metadata, null, 2), "utf-8");

      // Write markdown report
      const report = generateVerificationReport(result, runNumber);
      const mdPath = path.join(featureDir, `${runStr}.md`);
      await fs.writeFile(mdPath, report, "utf-8");

      // Update index
      index.features[featureId] = {
        featureId,
        latestRun: runNumber,
        latestTimestamp: result.timestamp,
        latestVerdict: result.verdict,
        totalRuns: 1,
        passCount: result.verdict === "pass" ? 1 : 0,
        failCount: result.verdict === "fail" ? 1 : 0,
      };

      migratedCount++;
    } catch (error) {
      console.warn(
        `[verification-store] Failed to migrate feature ${featureId}: ${error}`
      );
    }
  }

  // Save new index
  await saveIndex(cwd, index);

  // Backup old results.json
  const storePath = path.join(cwd, VERIFICATION_STORE_PATH);
  const backupPath = path.join(cwd, VERIFICATION_STORE_DIR, "results.json.bak");
  try {
    await fs.copyFile(storePath, backupPath);
  } catch (error) {
    console.warn(
      `[verification-store] Failed to backup results.json: ${error}`
    );
  }

  return migratedCount;
}

/**
 * Auto-migrate if needed (called on first access)
 * Silent migration - logs but doesn't throw on errors
 */
export async function autoMigrateIfNeeded(cwd: string): Promise<void> {
  try {
    if (await needsMigration(cwd)) {
      const count = await migrateResultsJson(cwd);
      if (count > 0) {
        console.log(
          `[verification-store] Migrated ${count} verification results to new format`
        );
      }
    }
  } catch (error) {
    console.warn(
      `[verification-store] Auto-migration failed: ${error}`
    );
  }
}

// Note: toMetadata, formatRunNumber, ensureFeatureDir, and saveIndex are
// defined earlier in this file and reused by the migration functions above.
