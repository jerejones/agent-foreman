/**
 * Feature merge or create operations
 */

import chalk from "chalk";

import type { Feature, FeatureList, InitMode, TDDMode } from "../types/index.js";
import { loadFeatureList, createEmptyFeatureList, saveFeatureList, mergeFeatures, discoveredToFeature } from "../features/index.js";
import type { aiResultToSurvey } from "../scanner/index.js";

/**
 * Step 2-4: Merge or create features based on mode
 * - Loads existing feature list (if any)
 * - Converts discovered features to Feature objects
 * - Merges or replaces based on mode
 * - Sets TDD mode in metadata
 */
export async function mergeOrCreateFeatures(
  cwd: string,
  survey: ReturnType<typeof aiResultToSurvey>,
  goal: string,
  mode: InitMode,
  verbose: boolean,
  tddMode?: TDDMode
): Promise<FeatureList> {
  // Load existing feature list or create new
  let featureList = await loadFeatureList(cwd);

  if (mode === "new" || !featureList) {
    featureList = createEmptyFeatureList(goal, tddMode);
  } else {
    // Update goal if provided
    featureList.metadata.projectGoal = goal;
    // Update TDD mode if provided
    if (tddMode) {
      featureList.metadata.tddMode = tddMode;
    }
  }

  // Convert discovered features to Feature objects
  const discoveredFeatures: Feature[] = survey.features.map((df, idx) =>
    discoveredToFeature(df, idx)
  );

  // Merge or replace based on mode
  if (mode === "merge") {
    const beforeCount = featureList.features.length;
    featureList.features = mergeFeatures(featureList.features, discoveredFeatures);
    const addedCount = featureList.features.length - beforeCount;
    if (verbose && addedCount > 0) {
      console.log(chalk.gray(`  Added ${addedCount} new features`));
    }
  } else if (mode === "new") {
    featureList.features = discoveredFeatures;
  }
  // mode === "scan" doesn't modify the list

  // Save task list
  if (mode !== "scan") {
    await saveFeatureList(cwd, featureList);
    console.log(chalk.green(`✓ Task list saved with ${featureList.features.length} tasks`));
  } else {
    console.log(chalk.yellow(`ℹ Scan mode: ${discoveredFeatures.length} tasks discovered (not saved)`));
  }

  return featureList;
}
