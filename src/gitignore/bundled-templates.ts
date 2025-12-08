/**
 * Bundled gitignore templates from GitHub's official repository
 * These templates are bundled for offline/instant access
 *
 * Source: https://github.com/github/gitignore
 */

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to import embedded templates (available in compiled binary)
// Falls back to file system access in development mode
let EMBEDDED_TEMPLATES: Record<string, string> = {};
try {
  const embedded = await import("./embedded-templates.generated.js");
  EMBEDDED_TEMPLATES = embedded.EMBEDDED_TEMPLATES;
} catch {
  // Not in compiled mode or generated file doesn't exist
}

/**
 * List of bundled template names
 */
export const BUNDLED_TEMPLATES = [
  "Node",
  "Python",
  "Go",
  "Rust",
  "Java",
  "Nextjs",
] as const;

export type BundledTemplateName = (typeof BUNDLED_TEMPLATES)[number];

/**
 * Check if a template name is bundled
 */
export function isBundledTemplate(name: string): name is BundledTemplateName {
  return BUNDLED_TEMPLATES.includes(name as BundledTemplateName);
}

/**
 * Get the path to a bundled template file
 */
export function getBundledTemplatePath(name: BundledTemplateName): string {
  return join(__dirname, "templates", `${name}.gitignore`);
}

/**
 * Get a bundled template by name (synchronous)
 * Returns null if template doesn't exist
 *
 * Priority:
 * 1. Embedded templates (for compiled binary)
 * 2. File system (for development)
 */
export function getBundledTemplate(name: string): string | null {
  if (!isBundledTemplate(name)) {
    return null;
  }

  // Try embedded templates first (compiled binary mode)
  if (EMBEDDED_TEMPLATES[name]) {
    return EMBEDDED_TEMPLATES[name];
  }

  // Fall back to file system (development mode)
  const templatePath = getBundledTemplatePath(name);

  if (!existsSync(templatePath)) {
    return null;
  }

  return readFileSync(templatePath, "utf-8");
}

/**
 * Get a bundled template by name (async version for consistency with API)
 * Returns null if template doesn't exist
 */
export async function getBundledTemplateAsync(
  name: string
): Promise<string | null> {
  return getBundledTemplate(name);
}

/**
 * Get all bundled templates as a map
 */
export function getAllBundledTemplates(): Map<BundledTemplateName, string> {
  const templates = new Map<BundledTemplateName, string>();

  for (const name of BUNDLED_TEMPLATES) {
    const content = getBundledTemplate(name);
    if (content) {
      templates.set(name, content);
    }
  }

  return templates;
}

/**
 * Check if all bundled templates are available
 */
export function verifyBundledTemplates(): {
  available: BundledTemplateName[];
  missing: BundledTemplateName[];
} {
  const available: BundledTemplateName[] = [];
  const missing: BundledTemplateName[] = [];

  for (const name of BUNDLED_TEMPLATES) {
    // Check embedded first, then file system
    if (EMBEDDED_TEMPLATES[name]) {
      available.push(name);
    } else {
      const templatePath = getBundledTemplatePath(name);
      if (existsSync(templatePath)) {
        available.push(name);
      } else {
        missing.push(name);
      }
    }
  }

  return { available, missing };
}
