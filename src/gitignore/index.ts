/**
 * Gitignore module - templates and generator
 */

// Re-export from bundled-templates
export {
  BUNDLED_TEMPLATES,
  type BundledTemplateName,
  isBundledTemplate,
  getBundledTemplate,
  getBundledTemplateAsync,
  getAllBundledTemplates,
  verifyBundledTemplates,
} from "./bundled-templates.js";

// Re-export from github-api
export {
  getCacheDir,
  getCacheTTL,
  fetchGitignoreTemplate,
  listGitignoreTemplates,
  clearCache,
  getCacheStats,
  type FetchResult,
} from "./github-api.js";

// Re-export from generator
export {
  CONFIG_TO_TEMPLATE,
  LANGUAGE_TO_TEMPLATE,
  MINIMAL_GITIGNORE,
  detectTemplatesFromConfigFiles,
  detectTemplatesFromLanguages,
  getTemplate,
  generateGitignoreContent,
  generateGitignore,
  ensureMinimalGitignore,
  ensureComprehensiveGitignore,
  type GitignoreResult,
} from "./generator.js";
