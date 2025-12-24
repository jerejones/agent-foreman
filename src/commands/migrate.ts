/**
 * 'migrate' command implementation
 * Migrate legacy feature_list.json to ai/tasks/ format
 */
import chalk from "chalk";

import { loadFeatureList } from "../features/index.js";
import { needsMigration, migrateToMarkdown, loadFeatureIndex } from "../storage/index.js";

/**
 * Run the migrate command
 */
export async function runMigrate(dryRun: boolean, force: boolean): Promise<void> {
  const cwd = process.cwd();

  console.log(chalk.blue.bold("\n═══════════════════════════════════════════════════════════════"));
  console.log(chalk.blue.bold("                    FEATURE LIST MIGRATION"));
  console.log(chalk.blue.bold("═══════════════════════════════════════════════════════════════\n"));

  // Check if migration is needed
  const needsIt = await needsMigration(cwd);
  const existingIndex = await loadFeatureIndex(cwd);

  if (existingIndex && !force) {
    console.log(chalk.yellow("⚠ Already migrated to modular format."));
    console.log(chalk.gray(`  Index version: ${existingIndex.version}`));
    console.log(chalk.gray(`  Tasks: ${Object.keys(existingIndex.features).length}`));
    console.log(chalk.gray("\n  Use --force to re-migrate from legacy JSON."));
    return;
  }

  if (!needsIt && !force) {
    console.log(chalk.yellow("⚠ No legacy feature_list.json found."));
    console.log(chalk.gray("  Nothing to migrate."));
    return;
  }

  // Load legacy task list
  const legacyList = await loadFeatureList(cwd);
  if (!legacyList) {
    console.log(chalk.red("✗ Could not load task list."));
    process.exit(1);
  }

  const featureCount = legacyList.features.length;

  if (dryRun) {
    console.log(chalk.cyan("📋 Dry Run - Preview of Migration:\n"));
    console.log(chalk.gray(`  Tasks to migrate: ${featureCount}`));
    console.log(chalk.gray(`  Target directory: ai/tasks/`));
    console.log("");

    // Group by module
    const modules = new Map<string, number>();
    for (const feature of legacyList.features) {
      const count = modules.get(feature.module) || 0;
      modules.set(feature.module, count + 1);
    }

    console.log(chalk.gray("  Files to create:"));
    for (const [module, count] of modules) {
      console.log(chalk.gray(`    ai/tasks/${module}/*.md (${count} files)`));
    }
    console.log(chalk.gray(`    ai/tasks/index.json`));
    console.log(chalk.gray(`    ai/feature_list.json.bak (backup)`));

    console.log(chalk.cyan("\n  Run without --dry-run to execute migration."));
    return;
  }

  // Execute migration
  console.log(chalk.cyan(`📦 Migrating ${featureCount} tasks to modular format...\n`));

  try {
    const result = await migrateToMarkdown(cwd);

    console.log(chalk.green(`\n✓ Migration complete!`));
    console.log(chalk.gray(`  Tasks migrated: ${result.migrated}`));
    console.log(chalk.gray(`  Index created: ai/tasks/index.json`));
    console.log(chalk.gray(`  Backup saved: ai/feature_list.json.bak`));

    if (result.errors.length > 0) {
      console.log(chalk.yellow(`\n⚠ Warnings during migration:`));
      for (const error of result.errors) {
        console.log(chalk.yellow(`  - ${error}`));
      }
    }
  } catch (error) {
    console.log(chalk.red(`\n✗ Migration failed: ${(error as Error).message}`));
    process.exit(1);
  }
}
