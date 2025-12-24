/**
 * Guidance prompt templates
 * Templates for feature guidance, impact review, and session summaries
 */

/**
 * Generate task/feature step guidance
 */
export function generateFeatureGuidance(feature: {
  id: string;
  description: string;
  acceptance: string[];
  dependsOn: string[];
  notes: string;
}): string {
  const lines: string[] = [];

  lines.push(`## Task: ${feature.id}`);
  lines.push("");
  lines.push(`**Description:** ${feature.description}`);
  lines.push("");
  lines.push("### Acceptance Criteria");
  lines.push("");
  for (const [i, criteria] of feature.acceptance.entries()) {
    lines.push(`${i + 1}. [ ] ${criteria}`);
  }

  if (feature.dependsOn.length > 0) {
    lines.push("");
    lines.push("### Dependencies");
    lines.push("");
    lines.push("Ensure these tasks are passing first:");
    for (const dep of feature.dependsOn) {
      lines.push(`- ${dep}`);
    }
  }

  if (feature.notes) {
    lines.push("");
    lines.push("### Notes");
    lines.push("");
    lines.push(feature.notes);
  }

  lines.push("");
  lines.push("### Workflow");
  lines.push("");
  lines.push("1. Review acceptance criteria above");
  lines.push("2. Implement the task");
  lines.push(`3. Run \`agent-foreman done ${feature.id}\` (auto-verifies + commits)`);

  return lines.join("\n");
}

/**
 * Generate impact review guidance
 */
export function generateImpactGuidance(
  changedFeature: string,
  affectedFeatures: { id: string; reason: string }[]
): string {
  const lines: string[] = [];

  lines.push(`## Impact Review: ${changedFeature}`);
  lines.push("");

  if (affectedFeatures.length === 0) {
    lines.push("No other tasks are affected by this change.");
    return lines.join("\n");
  }

  lines.push("The following tasks may be affected by this change:");
  lines.push("");
  lines.push("| Task | Reason | Action |");
  lines.push("|------|--------|--------|");

  for (const f of affectedFeatures) {
    lines.push(`| ${f.id} | ${f.reason} | Review and update status |`);
  }

  lines.push("");
  lines.push("### Recommended Actions");
  lines.push("");
  lines.push("1. Review each affected task");
  lines.push("2. Run tests for affected modules");
  lines.push("3. Mark as `needs_review` if uncertain");
  lines.push("4. Update `notes` field with impact details");

  return lines.join("\n");
}

/**
 * Generate session summary
 */
export function generateSessionSummary(
  completed: { id: string; description: string }[],
  remaining: { id: string; priority: number }[],
  nextFeature: { id: string; description: string } | null
): string {
  const lines: string[] = [];

  lines.push("## Session Summary");
  lines.push("");

  if (completed.length > 0) {
    lines.push("### Completed This Session");
    for (const f of completed) {
      lines.push(`- ✅ ${f.id}: ${f.description}`);
    }
    lines.push("");
  }

  lines.push(`### Remaining: ${remaining.length} tasks`);
  lines.push("");

  if (nextFeature) {
    lines.push("### Next Up");
    lines.push(`**${nextFeature.id}**: ${nextFeature.description}`);
  } else {
    lines.push("All tasks are complete!");
  }

  return lines.join("\n");
}
