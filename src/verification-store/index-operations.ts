/**
 * Index Operations for verification store
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { VerificationIndex, VerificationResult } from "../verifier/types/index.js";
import {
  generateVerificationReport,
} from "../verification-report.js";
import {
  VERIFICATION_STORE_DIR,
  VERIFICATION_INDEX_PATH,
  INDEX_VERSION,
} from "./constants.js";
import { loadVerificationStore, createEmptyStore } from "./legacy-store.js";
import { ensureVerificationDir, formatRunNumber, toMetadata, saveIndex } from "./helpers.js";

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
  const storePath = path.join(cwd, `${VERIFICATION_STORE_DIR}/results.json`);

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
 * Get the next run number for a feature
 */
export async function getNextRunNumber(cwd: string, featureId: string): Promise<number> {
  const index = await loadVerificationIndex(cwd);
  if (index && index.features[featureId]) {
    return index.features[featureId].latestRun + 1;
  }
  return 1;
}
