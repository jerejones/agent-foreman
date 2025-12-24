/**
 * Init script generation and merge
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import chalk from "chalk";

import type { InitMode } from "../types/index.js";
import type { ExtendedCapabilities } from "../verifier/types/index.js";
import { generateMinimalInitScript, generateInitScriptFromCapabilities } from "../init-script.js";
import { callAnyAvailableAgent } from "../agents.js";
import { debugInit } from "../debug.js";
import { getTimeout, type TimeoutKey } from "../timeout-config.js";
import type { aiResultToSurvey } from "../scanner/index.js";
import { validateBashScript, isLikelyBashScript } from "../validation/index.js";
import { createSpinner } from "../ui/index.js";

/**
 * Helper: Generate or merge init.sh script
 * In merge mode, uses AI to intelligently merge user customizations with new template
 *
 * @param cwd - Current working directory
 * @param capabilities - Detected capabilities (used for test/lint/build/typecheck commands)
 * @param survey - Survey results (used as fallback for install/dev commands)
 * @param mode - Init mode (new, merge, scan)
 * @param preloadedScript - Optional pre-loaded existing script content
 * @param preloadedExists - Optional flag indicating if pre-loaded script exists
 */
export async function generateOrMergeInitScript(
  cwd: string,
  capabilities: ExtendedCapabilities,
  survey: ReturnType<typeof aiResultToSurvey>,
  mode: InitMode,
  preloadedScript?: string,
  preloadedExists?: boolean
): Promise<void> {
  const initScriptPath = path.join(cwd, "ai/init.sh");

  // Generate new init.sh template using capabilities (primary) with survey fallback for install/dev
  const hasCapabilities = capabilities.testCommand || capabilities.lintCommand || capabilities.buildCommand;
  const hasSurveyCommands = survey.commands.install || survey.commands.dev || survey.commands.test;

  const newInitScript = hasCapabilities || hasSurveyCommands
    ? generateInitScriptFromCapabilities(capabilities, {
        install: survey.commands.install,
        dev: survey.commands.dev,
      })
    : generateMinimalInitScript();

  await fs.mkdir(path.join(cwd, "ai"), { recursive: true });

  // Use pre-loaded content or read from disk
  let existingScript = preloadedScript ?? "";
  let existingScriptExists = preloadedExists ?? false;

  if (preloadedScript === undefined) {
    try {
      existingScript = await fs.readFile(initScriptPath, "utf-8");
      existingScriptExists = existingScript.trim().length > 0;
    } catch {
      debugInit("ai/init.sh doesn't exist, will create new");
    }
  }

  // If merge mode and existing script exists, use AI to merge
  if (mode === "merge" && existingScriptExists && existingScript.trim().length > 0) {
    const spinner = createSpinner();
    const baseMessage = "Merging ai/init.sh with AI (preserving your customizations)";
    spinner.start(`${baseMessage}...`);

    const mergePrompt = `You are merging two bash scripts. The user has customized their ai/init.sh script, and we have a new template with potentially new features or commands.

## Existing ai/init.sh (USER'S CUSTOMIZED VERSION - PRESERVE THEIR CHANGES):
\`\`\`bash
${existingScript}
\`\`\`

## New template ai/init.sh (MAY CONTAIN NEW FEATURES):
\`\`\`bash
${newInitScript}
\`\`\`

## Merge Rules (CRITICAL - FOLLOW EXACTLY):
1. **PRESERVE all user customizations** in existing functions (bootstrap, dev, check, build, status, etc.)
2. **ADD new functions** from the template that don't exist in the user's version
3. **ADD new case statements** in the main entry point for any new functions
4. **PRESERVE user's custom commands** - if user changed "npm install" to "pnpm install", keep their change
5. **PRESERVE user's custom functions** - if user added their own functions, keep them
6. **UPDATE the help text** to include any new commands
7. **DO NOT replace** user's working commands with template defaults
8. **MAINTAIN bash script validity** - ensure the output is a valid executable bash script

## Merge Strategy:
- For each function in the existing script: KEEP the user's version
- For each function in the new template that's NOT in existing: ADD it
- For the case statement: MERGE (keep existing cases, add new ones)
- For show_help: UPDATE to list all available commands

## Output:
Return ONLY the merged bash script content. No explanations, no markdown code blocks, just the raw bash script starting with #!/usr/bin/env bash`;

    const result = await callAnyAvailableAgent(mergePrompt, {
      cwd,
      timeoutMs: getTimeout("AI_MERGE_INIT_SCRIPT" as TimeoutKey),
      showProgress: false,
      onAgentSelected: (name) => spinner.update(`${baseMessage}... (Using ${name})`),
    });

    if (result.success && result.output.trim().length > 0) {
      const mergedScript = result.output.trim();

      // Quick check: does it look like a bash script?
      if (!isLikelyBashScript(mergedScript)) {
        spinner.warn("AI merge output doesn't look like a valid bash script, falling back...");
        return;
      }

      spinner.update("Validating merged script...");

      // Full validation
      const validation = validateBashScript(mergedScript);

      // Log validation warnings
      if (validation.warnings.length > 0) {
        spinner.stop();
        console.log(chalk.yellow(`  ⚠ ${validation.warnings.length} warning(s) in merged init.sh:`));
        for (const warn of validation.warnings.slice(0, 3)) {
          console.log(chalk.gray(`    - ${warn}`));
        }
        if (validation.warnings.length > 3) {
          console.log(chalk.gray(`    ... and ${validation.warnings.length - 3} more`));
        }
      }

      // Check for errors
      if (!validation.valid) {
        spinner.fail("AI merge produced invalid script");
        for (const err of validation.errors) {
          console.log(chalk.red(`    - ${err}`));
        }
        console.log(chalk.yellow("  Keeping existing ai/init.sh unchanged"));
        console.log(chalk.gray("  (Run with --mode new to force regeneration)"));
        return; // Keep existing script unchanged
      }

      // Validation passed - write merged script
      await fs.writeFile(initScriptPath, mergedScript + "\n");
      await fs.chmod(initScriptPath, 0o755);
      spinner.succeed("Updated ai/init.sh (merged by AI - your customizations preserved)");
      return;
    } else {
      spinner.warn("AI merge failed, keeping your existing ai/init.sh unchanged");
      console.log(chalk.gray("  (Run with --mode new to force regeneration)"));
      return; // Keep existing script unchanged
    }
  }

  // New mode or no existing script: write new template
  await fs.writeFile(initScriptPath, newInitScript);
  await fs.chmod(initScriptPath, 0o755);
  console.log(chalk.green("✓ Generated ai/init.sh"));
}
