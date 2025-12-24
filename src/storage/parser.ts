/**
 * Feature markdown parser
 * Parses markdown files with YAML frontmatter into Feature objects
 */
import matter from "gray-matter";
import type {
  Feature,
  FeatureStatus,
  FeatureOrigin,
  FeatureVerificationSummary,
  TestRequirements,
  CachedTDDGuidance,
  TaskType,
} from "../types/index.js";
import type { VerificationStrategy, VerificationStrategyType } from "../verifier/types/index.js";
import { extractAcceptanceCriteria, extractNotesSection, extractModuleFromId } from "./helpers.js";

/**
 * Parse and validate verification strategies from frontmatter
 * Returns valid strategies, logs warnings for invalid entries
 */
function parseVerificationStrategies(raw: unknown, featureId: string): VerificationStrategy[] {
  if (!Array.isArray(raw)) {
    console.warn(`[parseFeatureMarkdown] verificationStrategies must be an array in ${featureId}`);
    return [];
  }

  const validTypes: VerificationStrategyType[] = [
    "test", "e2e", "script", "http", "file", "command", "manual", "ai", "composite"
  ];

  const strategies: VerificationStrategy[] = [];

  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];

    // Check if entry is an object
    if (typeof entry !== "object" || entry === null) {
      console.warn(`[parseFeatureMarkdown] Invalid strategy entry at index ${i} in ${featureId}: not an object`);
      continue;
    }

    const strategyObj = entry as Record<string, unknown>;

    // Check required "type" field
    if (!strategyObj.type || typeof strategyObj.type !== "string") {
      console.warn(`[parseFeatureMarkdown] Invalid strategy entry at index ${i} in ${featureId}: missing or invalid type`);
      continue;
    }

    // Validate type value
    if (!validTypes.includes(strategyObj.type as VerificationStrategyType)) {
      console.warn(`[parseFeatureMarkdown] Invalid strategy type "${strategyObj.type}" at index ${i} in ${featureId}`);
      continue;
    }

    // Valid strategy, add to result (cast as valid VerificationStrategy)
    strategies.push(entry as VerificationStrategy);
  }

  return strategies;
}

/**
 * Parse a feature markdown file content into a Feature object
 *
 * Expected markdown format:
 * ```markdown
 * ---
 * id: module.task
 * version: 1
 * origin: manual
 * dependsOn: []
 * supersedes: []
 * tags: [tag1, tag2]
 * testRequirements: {...}
 * verification: {...}
 * ---
 *
 * # Feature Description
 *
 * ## Acceptance Criteria
 *
 * 1. First criterion
 * 2. Second criterion
 *
 * ## Notes
 *
 * Additional notes here.
 * ```
 *
 * @param content - The markdown file content
 * @returns Parsed Feature object
 */
export function parseFeatureMarkdown(content: string): Feature {
  const { data: frontmatter, content: body } = matter(content);

  // Extract description from H1 heading
  const descriptionMatch = body.match(/^#\s+(.+)$/m);
  const description = descriptionMatch
    ? descriptionMatch[1].trim()
    : frontmatter.description || "";

  // Extract acceptance criteria from numbered list after "## Acceptance Criteria"
  const acceptance = extractAcceptanceCriteria(body);

  // Extract notes from "## Notes" section
  const notes = extractNotesSection(body);

  // Build Feature object from frontmatter and extracted content
  const feature: Feature = {
    id: frontmatter.id || "",
    description,
    module: frontmatter.module || extractModuleFromId(frontmatter.id || ""),
    priority: typeof frontmatter.priority === "number" ? frontmatter.priority : 0,
    status: (frontmatter.status as FeatureStatus) || "failing",
    acceptance,
    dependsOn: frontmatter.dependsOn || [],
    supersedes: frontmatter.supersedes || [],
    tags: frontmatter.tags || [],
    version: typeof frontmatter.version === "number" ? frontmatter.version : 1,
    origin: (frontmatter.origin as FeatureOrigin) || "manual",
    notes,
    // Preserve raw body to maintain custom sections during save
    rawBody: body,
  };

  // Optional fields
  if (frontmatter.verification) {
    feature.verification = frontmatter.verification as FeatureVerificationSummary;
  }
  if (frontmatter.e2eTags) {
    feature.e2eTags = frontmatter.e2eTags;
  }
  if (frontmatter.testRequirements) {
    feature.testRequirements = frontmatter.testRequirements as TestRequirements;
  }
  if (frontmatter.testFiles) {
    feature.testFiles = frontmatter.testFiles;
  }
  if (frontmatter.tddGuidance) {
    feature.tddGuidance = frontmatter.tddGuidance as CachedTDDGuidance;
  }

  // Parse taskType (UVS Phase 7)
  if (frontmatter.taskType) {
    const validTaskTypes: TaskType[] = ["code", "ops", "data", "infra", "manual"];
    if (validTaskTypes.includes(frontmatter.taskType as TaskType)) {
      feature.taskType = frontmatter.taskType as TaskType;
    } else {
      console.warn(`[parseFeatureMarkdown] Invalid taskType "${frontmatter.taskType}" in ${frontmatter.id}, using default`);
    }
  }

  // Parse verificationStrategies (UVS Phase 7)
  if (frontmatter.verificationStrategies) {
    const strategies = parseVerificationStrategies(frontmatter.verificationStrategies, frontmatter.id || "unknown");
    if (strategies.length > 0) {
      feature.verificationStrategies = strategies;
    }
  }

  return feature;
}
