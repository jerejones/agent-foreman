/**
 * Git-related prompt templates
 */

/**
 * Generate a commit message template
 */
export function generateCommitMessage(
  featureId: string,
  description: string,
  summary: string
): string {
  return `feat(${featureId.split(".")[0]}): ${description}

${summary}

Feature: ${featureId}

🤖 Generated with agent-foreman`;
}
