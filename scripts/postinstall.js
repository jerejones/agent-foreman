#!/usr/bin/env node
/**
 * Postinstall script to copy slash commands to ~/.claude/commands/
 *
 * This script runs automatically after npm install to make
 * foreman slash commands globally available in Claude Code.
 */

import { promises as fs } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COMMAND_FILES = [
  "foreman-survey.md",
  "foreman-init.md",
  "foreman-step.md",
];

async function main() {
  const claudeCommandsDir = join(homedir(), ".claude", "commands");
  const sourceDir = join(__dirname, "..", "commands");

  try {
    // Create ~/.claude/commands/ if it doesn't exist
    await fs.mkdir(claudeCommandsDir, { recursive: true });

    let installed = 0;
    let skipped = 0;

    for (const file of COMMAND_FILES) {
      const sourcePath = join(sourceDir, file);
      const destPath = join(claudeCommandsDir, file);

      try {
        // Check if source file exists
        await fs.access(sourcePath);

        // Check if destination already exists
        try {
          await fs.access(destPath);
          // File exists, skip it
          skipped++;
          continue;
        } catch {
          // File doesn't exist, copy it
        }

        await fs.copyFile(sourcePath, destPath);
        installed++;
      } catch (err) {
        // Source file doesn't exist, skip silently
        continue;
      }
    }

    if (installed > 0) {
      console.log(
        `\n✓ Installed ${installed} foreman command${installed > 1 ? "s" : ""} to ~/.claude/commands/`
      );
      console.log("  Available commands: /foreman-survey, /foreman-init, /foreman-step");
    }

    if (skipped > 0 && installed === 0) {
      console.log("\n✓ Foreman commands already installed");
      console.log("  Use 'agent-foreman install-commands --force' to reinstall");
    }
  } catch (err) {
    // Don't fail npm install on errors
    // Just log a warning and continue
    console.warn("\n⚠ Could not install foreman commands:", err.message);
    console.warn("  Run 'agent-foreman install-commands' to install manually");
  }
}

main();
