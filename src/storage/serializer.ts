/**
 * Feature markdown serializer
 * Serializes Feature objects to markdown with YAML frontmatter
 *
 * KEY BEHAVIOR: When rawBody exists, updates sections in-place to preserve
 * custom content (Background, Implementation Details, etc.) that isn't
 * part of the standard Feature schema.
 */
import matter from "gray-matter";
import type { Feature } from "../types/index.js";
import {
  updateDescriptionHeading,
  updateAcceptanceSection,
  updateNotesSection,
} from "./helpers.js";

/**
 * Build frontmatter object from Feature
 * Excludes fields that go in the body (description, acceptance, notes, rawBody)
 */
export function buildFrontmatter(feature: Feature): Record<string, unknown> {
  // Use empty arrays as defaults to prevent YAML serialization errors with undefined
  const frontmatter: Record<string, unknown> = {
    id: feature.id,
    module: feature.module,
    priority: feature.priority,
    status: feature.status,
    version: feature.version,
    origin: feature.origin,
    dependsOn: feature.dependsOn || [],
    supersedes: feature.supersedes || [],
    tags: feature.tags || [],
  };

  // Add optional fields if present
  if (feature.e2eTags && feature.e2eTags.length > 0) {
    frontmatter.e2eTags = feature.e2eTags;
  }
  if (feature.testRequirements) {
    frontmatter.testRequirements = feature.testRequirements;
  }
  if (feature.testFiles && feature.testFiles.length > 0) {
    frontmatter.testFiles = feature.testFiles;
  }
  if (feature.verification) {
    frontmatter.verification = feature.verification;
  }
  if (feature.tddGuidance) {
    frontmatter.tddGuidance = feature.tddGuidance;
  }
  // UVS Phase 7 fields
  if (feature.taskType) {
    frontmatter.taskType = feature.taskType;
  }
  if (feature.verificationStrategies && feature.verificationStrategies.length > 0) {
    frontmatter.verificationStrategies = feature.verificationStrategies;
  }
  // affectedBy for task impact detection
  if (feature.affectedBy && feature.affectedBy.length > 0) {
    frontmatter.affectedBy = feature.affectedBy;
  }

  return frontmatter;
}

/**
 * Generate fresh markdown body for new features (no rawBody)
 */
function generateFreshBody(feature: Feature): string {
  const bodyParts: string[] = [];

  // H1 heading with description
  bodyParts.push(`# ${feature.description}`);
  bodyParts.push("");

  // Acceptance criteria section
  if (feature.acceptance.length > 0) {
    bodyParts.push("## Acceptance Criteria");
    bodyParts.push("");
    feature.acceptance.forEach((criterion, index) => {
      bodyParts.push(`${index + 1}. ${criterion}`);
    });
    bodyParts.push("");
  }

  // Notes section
  if (feature.notes && feature.notes.trim()) {
    bodyParts.push("## Notes");
    bodyParts.push("");
    bodyParts.push(feature.notes.trim());
    bodyParts.push("");
  }

  return bodyParts.join("\n");
}

/**
 * Serialize a Feature object to markdown format with YAML frontmatter
 *
 * When rawBody exists (loaded from existing file), updates sections in-place
 * to preserve custom content that isn't part of the Feature schema.
 *
 * When rawBody doesn't exist (new feature), generates fresh markdown.
 *
 * @param feature - The Feature object to serialize
 * @returns Markdown string with YAML frontmatter
 */
export function serializeFeatureMarkdown(feature: Feature): string {
  const frontmatter = buildFrontmatter(feature);

  let body: string;

  if (feature.rawBody) {
    // Update sections in-place to preserve custom content
    body = updateDescriptionHeading(feature.rawBody, feature.description);
    body = updateAcceptanceSection(body, feature.acceptance);
    body = updateNotesSection(body, feature.notes);
  } else {
    // Generate fresh markdown for new features
    body = generateFreshBody(feature);
  }

  // Use gray-matter to stringify with frontmatter
  return matter.stringify(body, frontmatter);
}
