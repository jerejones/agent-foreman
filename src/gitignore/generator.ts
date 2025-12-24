/**
 * Gitignore generator with auto-detection support
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { getBundledTemplate, isBundledTemplate } from "./bundled-templates.js";
import { fetchGitignoreTemplate } from "./github-api.js";

/**
 * Mapping from config files to template names
 * Comprehensive list covering major ecosystems and frameworks
 */
export const CONFIG_TO_TEMPLATE: Record<string, string> = {
  // Node.js / JavaScript ecosystem
  "package.json": "Node",
  "package-lock.json": "Node",
  "yarn.lock": "Node",
  "pnpm-lock.yaml": "Node",
  "bun.lockb": "Node",
  ".npmrc": "Node",
  "tsconfig.json": "Node",
  "vite.config.js": "Node",
  "vite.config.ts": "Node",
  "vite.config.mjs": "Node",
  "webpack.config.js": "Node",
  "rollup.config.js": "Node",
  "esbuild.config.js": "Node",

  // Next.js
  "next.config.js": "Nextjs",
  "next.config.ts": "Nextjs",
  "next.config.mjs": "Nextjs",

  // Nuxt.js
  "nuxt.config.js": "Node",
  "nuxt.config.ts": "Node",

  // Svelte
  "svelte.config.js": "Node",

  // Go
  "go.mod": "Go",
  "go.sum": "Go",
  "go.work": "Go",

  // Rust
  "Cargo.toml": "Rust",
  "Cargo.lock": "Rust",

  // Python
  "pyproject.toml": "Python",
  "requirements.txt": "Python",
  "setup.py": "Python",
  "setup.cfg": "Python",
  "Pipfile": "Python",
  "Pipfile.lock": "Python",
  "poetry.lock": "Python",
  "conda.yaml": "Python",
  "environment.yml": "Python",

  // Java / JVM
  "pom.xml": "Java",
  "build.gradle": "Java",
  "build.gradle.kts": "Java",
  "settings.gradle": "Java",
  "settings.gradle.kts": "Java",
  "gradlew": "Java",
  ".mvn": "Java",
};

/**
 * Mapping from language names to template names
 * Includes languages, frameworks, and common aliases
 */
export const LANGUAGE_TO_TEMPLATE: Record<string, string> = {
  // JavaScript / TypeScript ecosystem
  typescript: "Node",
  javascript: "Node",
  js: "Node",
  ts: "Node",
  nodejs: "Node",
  node: "Node",
  npm: "Node",
  yarn: "Node",
  pnpm: "Node",
  bun: "Node",

  // Frontend frameworks (Node-based)
  react: "Node",
  vue: "Node",
  angular: "Node",
  svelte: "Node",
  solid: "Node",
  preact: "Node",
  qwik: "Node",
  astro: "Node",

  // Next.js
  nextjs: "Nextjs",
  next: "Nextjs",
  "next.js": "Nextjs",

  // Nuxt.js
  nuxtjs: "Node",
  nuxt: "Node",
  "nuxt.js": "Node",

  // Python
  python: "Python",
  py: "Python",
  python3: "Python",
  pip: "Python",
  poetry: "Python",
  pipenv: "Python",
  conda: "Python",

  // Python frameworks
  django: "Python",
  flask: "Python",
  fastapi: "Python",
  tornado: "Python",
  pyramid: "Python",

  // Go
  go: "Go",
  golang: "Go",

  // Go frameworks
  gin: "Go",
  echo: "Go",
  fiber: "Go",

  // Rust
  rust: "Rust",
  rs: "Rust",
  cargo: "Rust",

  // Rust frameworks
  actix: "Rust",
  rocket: "Rust",
  axum: "Rust",

  // Java / JVM
  java: "Java",
  kotlin: "Java",
  kt: "Java",
  scala: "Java",
  groovy: "Java",
  maven: "Java",
  gradle: "Java",

  // Java frameworks
  spring: "Java",
  springboot: "Java",
  "spring-boot": "Java",
  quarkus: "Java",
  micronaut: "Java",
};

/**
 * Minimal gitignore content for quick setup
 */
export const MINIMAL_GITIGNORE = `# Essential patterns
.env
.env.local
.env*.local
node_modules/
dist/
.DS_Store
__pycache__/
.next/
target/
`;

/**
 * Result of gitignore generation operation
 */
export interface GitignoreResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Action taken */
  action: "created" | "updated" | "skipped" | "error";
  /** Reason for the action */
  reason?: string;
  /** Templates that were used */
  templates?: string[];
}

/**
 * Detect templates from config files in a directory
 * @param cwd - Directory to scan
 * @returns Array of unique template names
 */
export function detectTemplatesFromConfigFiles(cwd: string): string[] {
  const templates = new Set<string>();

  for (const [configFile, template] of Object.entries(CONFIG_TO_TEMPLATE)) {
    const configPath = path.join(cwd, configFile);
    if (fs.existsSync(configPath)) {
      templates.add(template);
    }
  }

  return Array.from(templates);
}

/**
 * Detect templates from language names
 * @param languages - Array of language names
 * @returns Array of unique template names
 */
export function detectTemplatesFromLanguages(languages: string[]): string[] {
  const templates = new Set<string>();

  for (const lang of languages) {
    const normalizedLang = lang.toLowerCase().trim();
    const template = LANGUAGE_TO_TEMPLATE[normalizedLang];
    if (template) {
      templates.add(template);
    }
  }

  return Array.from(templates);
}

/**
 * Get template content (bundled or from API)
 * @param name - Template name
 * @returns Template content or null
 */
export async function getTemplate(name: string): Promise<string | null> {
  // Try bundled first for speed
  if (isBundledTemplate(name)) {
    const bundled = getBundledTemplate(name);
    if (bundled) return bundled;
  }

  // Try API
  try {
    const result = await fetchGitignoreTemplate(name);
    return result.source;
  } catch {
    return null;
  }
}

/**
 * Generate gitignore content from multiple templates
 * @param templates - Array of template names
 * @returns Combined gitignore content with sections
 */
export async function generateGitignoreContent(templates: string[]): Promise<string> {
  if (templates.length === 0) {
    return MINIMAL_GITIGNORE;
  }

  const sections: string[] = [];

  // Add header
  sections.push("# Generated by agent-foreman");
  sections.push(`# Templates: ${templates.join(", ")}`);
  sections.push("");

  // Add each template as a section
  for (const templateName of templates) {
    const content = await getTemplate(templateName);
    if (content) {
      sections.push(`# ─── ${templateName} ───────────────────────────────────────────`);
      sections.push(content.trim());
      sections.push("");
    }
  }

  // Add agent-foreman specific patterns
  sections.push("# ─── Agent Foreman ───────────────────────────────────────────");
  sections.push("ai/verification/");
  sections.push(".agent-foreman/");
  sections.push("");

  return sections.join("\n");
}

/**
 * Generate gitignore for a project
 * @param cwd - Directory to generate gitignore for
 * @param options - Generation options
 * @returns Generation result
 */
export async function generateGitignore(
  cwd: string,
  options: {
    templates?: string[];
    autoDetect?: boolean;
    languages?: string[];
    overwrite?: boolean;
  } = {}
): Promise<GitignoreResult> {
  const {
    templates: explicitTemplates = [],
    autoDetect = true,
    languages = [],
    overwrite = false,
  } = options;

  const gitignorePath = path.join(cwd, ".gitignore");

  // Check if .gitignore exists
  if (fs.existsSync(gitignorePath) && !overwrite) {
    return {
      success: true,
      action: "skipped",
      reason: ".gitignore already exists",
    };
  }

  // Collect templates
  const templates = new Set<string>(explicitTemplates);

  // Auto-detect from config files
  if (autoDetect) {
    for (const t of detectTemplatesFromConfigFiles(cwd)) {
      templates.add(t);
    }
  }

  // Add language-based templates
  for (const t of detectTemplatesFromLanguages(languages)) {
    templates.add(t);
  }

  // Generate content
  const templateArray = Array.from(templates);
  const content = await generateGitignoreContent(templateArray);

  // Write file
  try {
    fs.writeFileSync(gitignorePath, content);
    return {
      success: true,
      action: fs.existsSync(gitignorePath) && overwrite ? "updated" : "created",
      templates: templateArray,
    };
  } catch (error) {
    return {
      success: false,
      action: "error",
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Ensure minimal gitignore exists (for git init)
 * @param cwd - Directory to check
 * @returns Result of the operation
 */
export function ensureMinimalGitignore(cwd: string): GitignoreResult {
  const gitignorePath = path.join(cwd, ".gitignore");

  if (fs.existsSync(gitignorePath)) {
    return { success: true, action: "skipped", reason: ".gitignore exists" };
  }

  try {
    fs.writeFileSync(gitignorePath, MINIMAL_GITIGNORE);
    return { success: true, action: "created" };
  } catch (error) {
    return {
      success: false,
      action: "error",
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Ensure comprehensive gitignore exists (for harness generation)
 * @param cwd - Directory to check
 * @returns Result of the operation
 */
export async function ensureComprehensiveGitignore(cwd: string): Promise<GitignoreResult> {
  const gitignorePath = path.join(cwd, ".gitignore");

  // If .gitignore exists and has content, skip
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8").trim();
    if (content.length > 50) {
      // Has substantial content
      return { success: true, action: "skipped", reason: ".gitignore already has content" };
    }
  }

  // Generate comprehensive gitignore with auto-detection
  return generateGitignore(cwd, {
    autoDetect: true,
    overwrite: true,
  });
}
