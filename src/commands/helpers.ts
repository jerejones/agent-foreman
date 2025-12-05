/**
 * Helper functions for CLI commands
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import chalk from "chalk";

/**
 * Auto-detect project goal from README or package.json
 */
export async function detectProjectGoal(cwd: string): Promise<string> {
  // Try package.json description first
  try {
    const pkgPath = path.join(cwd, "package.json");
    const pkgContent = await fs.readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(pkgContent);
    if (pkg.description && pkg.description.length > 10) {
      console.log(chalk.gray(`  Auto-detected goal from package.json`));
      return pkg.description;
    }
  } catch {
    // No package.json or no description
  }

  // Try README first line (usually project title/description)
  try {
    const readmeNames = ["README.md", "README", "readme.md", "Readme.md"];
    for (const name of readmeNames) {
      try {
        const readmePath = path.join(cwd, name);
        const content = await fs.readFile(readmePath, "utf-8");
        const lines = content.split("\n").filter((l) => l.trim());
        // Skip markdown headers, get first meaningful line
        for (const line of lines.slice(0, 5)) {
          const clean = line.replace(/^#+\s*/, "").trim();
          if (clean.length > 10 && !clean.startsWith("!") && !clean.startsWith("[")) {
            console.log(chalk.gray(`  Auto-detected goal from ${name}`));
            return clean;
          }
        }
      } catch {
        // Try next README variant
      }
    }
  } catch {
    // No README found
  }

  // Fallback: use directory name
  const dirName = path.basename(cwd);
  console.log(chalk.yellow(`  No description found, using directory name: ${dirName}`));
  return `Development of ${dirName}`;
}

/**
 * Prompt user for yes/no confirmation
 */
export async function promptConfirmation(message: string): Promise<boolean> {
  const readline = await import("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}
