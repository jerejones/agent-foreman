/**
 * AI-powered project scanner module
 *
 * Uses autonomous AI agents (Claude/Gemini/Codex) to explore and analyze codebases.
 * Key principle: The agent explores the project itself using its own tools,
 * rather than us collecting context and passing it to the agent.
 */

// Types
export type { AIAnalysisResult, AIScanOptions } from "./types.js";

// Main scan function
export { aiScanProject } from "./scan.js";

// Feature generators
export { generateFeaturesFromSurvey, generateFeaturesFromGoal } from "./generators.js";

// Survey utilities
export { aiResultToSurvey, generateAISurveyMarkdown } from "./survey.js";
