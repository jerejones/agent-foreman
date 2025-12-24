/**
 * Bundled gitignore templates for offline access
 * These templates are included in the compiled binary via embedded assets
 *
 * Dual-mode loading:
 * - Priority 1: Embedded templates (compiled binary mode)
 * - Priority 2: File system templates (development mode)
 */

import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Embedded templates loaded from generated assets (compiled binary mode)
 * This will be populated if running from compiled binary
 */
let EMBEDDED_TEMPLATES: Record<string, string> = {};

// Try to load embedded templates (only available in compiled binary mode)
try {
  // Dynamic import to handle case where file doesn't exist
  const embeddedPath = path.join(__dirname, "..", "embedded-assets.generated.js");
  if (fs.existsSync(embeddedPath)) {
    const embedded = await import("../embedded-assets.generated.js");
    EMBEDDED_TEMPLATES = embedded.EMBEDDED_GITIGNORE_TEMPLATES || {};
  }
} catch {
  // Embedded assets not available (development mode)
  EMBEDDED_TEMPLATES = {};
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

/**
 * Type for bundled template names
 */
export type BundledTemplateName = (typeof BUNDLED_TEMPLATES)[number];

/**
 * Type guard to check if a name is a bundled template
 */
export function isBundledTemplate(name: string): name is BundledTemplateName {
  return BUNDLED_TEMPLATES.includes(name as BundledTemplateName);
}

/**
 * Get the path to a bundled template file (for file system access)
 */
function getTemplatePath(name: string): string {
  return path.join(__dirname, "templates", `${name}.gitignore`);
}

/**
 * Get bundled template content synchronously
 * Priority 1: Embedded templates (compiled binary mode)
 * Priority 2: File system templates (development mode)
 *
 * @param name - Template name (e.g., "Node", "Python")
 * @returns Template content or null if not found
 */
export function getBundledTemplate(name: string): string | null {
  if (!isBundledTemplate(name)) return null;

  // Priority 1: Try embedded templates first (compiled binary mode)
  if (EMBEDDED_TEMPLATES[name]) {
    return EMBEDDED_TEMPLATES[name];
  }

  // Priority 2: Fall back to file system (development mode)
  const templatePath = getTemplatePath(name);
  try {
    return fs.readFileSync(templatePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Get bundled template content asynchronously
 * Priority 1: Embedded templates (compiled binary mode)
 * Priority 2: File system templates (development mode)
 *
 * @param name - Template name (e.g., "Node", "Python")
 * @returns Template content or null if not found
 */
export async function getBundledTemplateAsync(name: string): Promise<string | null> {
  if (!isBundledTemplate(name)) return null;

  // Priority 1: Try embedded templates first (compiled binary mode)
  if (EMBEDDED_TEMPLATES[name]) {
    return EMBEDDED_TEMPLATES[name];
  }

  // Priority 2: Fall back to file system (development mode)
  const templatePath = getTemplatePath(name);
  try {
    return await fsPromises.readFile(templatePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Get all bundled templates as a Map
 * @returns Map of template name to content
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
 * Verify which bundled templates are available
 * @returns Object with available and missing template names
 */
export function verifyBundledTemplates(): { available: string[]; missing: string[] } {
  const available: string[] = [];
  const missing: string[] = [];

  for (const name of BUNDLED_TEMPLATES) {
    if (getBundledTemplate(name)) {
      available.push(name);
    } else {
      missing.push(name);
    }
  }

  return { available, missing };
}

/**
 * Check if running in compiled binary mode (embedded assets available)
 * @returns true if embedded templates are loaded
 */
export function isCompiledMode(): boolean {
  return Object.keys(EMBEDDED_TEMPLATES).length > 0;
}
