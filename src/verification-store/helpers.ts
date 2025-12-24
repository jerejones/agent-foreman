/**
 * Internal helper functions for verification store
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
  VerificationResult,
  VerificationIndex,
  VerificationMetadata,
} from "../verifier/types/index.js";
import { VERIFICATION_STORE_DIR, VERIFICATION_INDEX_PATH } from "./constants.js";

/**
 * Ensure the verification directory exists
 */
export async function ensureVerificationDir(cwd: string): Promise<void> {
  const dirPath = path.join(cwd, VERIFICATION_STORE_DIR);
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Ensure a feature subdirectory exists
 */
export async function ensureFeatureDir(cwd: string, featureId: string): Promise<string> {
  const featureDir = path.join(cwd, VERIFICATION_STORE_DIR, featureId);
  await fs.mkdir(featureDir, { recursive: true });
  return featureDir;
}

/**
 * Save the index to disk
 */
export async function saveIndex(cwd: string, index: VerificationIndex): Promise<void> {
  await ensureVerificationDir(cwd);
  const indexPath = path.join(cwd, VERIFICATION_INDEX_PATH);
  const content = JSON.stringify(index, null, 2);
  await fs.writeFile(indexPath, content, "utf-8");
}

/**
 * Format run number to padded string (001, 002, etc.)
 */
export function formatRunNumber(num: number): string {
  return String(num).padStart(3, "0");
}

/**
 * Convert VerificationResult to compact VerificationMetadata
 */
export function toMetadata(result: VerificationResult, runNumber: number): VerificationMetadata {
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
export function updateFeatureSummary(
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
