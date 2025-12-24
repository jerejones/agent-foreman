/**
 * AI Strategy Prompts
 * Prompt building functions for AI verification
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

import type { Feature } from "../../types/index.js";

const execAsync = promisify(exec);

/**
 * Build prompt with custom template
 */
export function buildCustomPrompt(cwd: string, customPrompt: string, feature: Feature): string {
  // Replace placeholders in custom prompt
  return customPrompt
    .replace(/\{cwd\}/g, cwd)
    .replace(/\{featureId\}/g, feature.id)
    .replace(/\{featureDescription\}/g, feature.description)
    .replace(/\{featureModule\}/g, feature.module)
    .replace(/\{acceptanceCriteria\}/g, feature.acceptance.map((c, i) => `${i + 1}. ${c}`).join("\n"));
}

/**
 * Build prompt for diff-based verification
 */
export async function buildDiffPrompt(cwd: string, feature: Feature): Promise<string> {
  // Get git diff
  let diff = "";
  try {
    const { stdout } = await execAsync("git diff HEAD~1 --no-color", { cwd });
    diff = stdout.trim();
  } catch {
    // Fall back to staged changes
    try {
      const { stdout } = await execAsync("git diff --cached --no-color", { cwd });
      diff = stdout.trim();
    } catch {
      diff = "No diff available";
    }
  }

  const criteriaList = feature.acceptance.map((c, i) => `${i + 1}. ${c}`).join("\n");

  return `You are a code reviewer verifying if changes satisfy acceptance criteria.

## Feature Information

- **ID**: ${feature.id}
- **Description**: ${feature.description}
- **Module**: ${feature.module}

## Acceptance Criteria to Verify

${criteriaList}

## Git Diff

\`\`\`diff
${diff.slice(0, 10000)}${diff.length > 10000 ? "\n... (truncated)" : ""}
\`\`\`

## Your Task

Analyze the git diff and verify EACH acceptance criterion:

1. Check if the changes implement the required functionality
2. Verify the implementation matches the criterion requirements
3. Assess confidence based on evidence in the diff

## Output

Return ONLY a JSON object (no markdown, no explanation):

{
  "criteriaResults": [
    {
      "index": 0,
      "criterion": "exact text of criterion",
      "satisfied": true,
      "reasoning": "Explanation of how the diff satisfies this criterion",
      "evidence": ["file:line references from diff"],
      "confidence": 0.95
    }
  ],
  "verdict": "<VERDICT>",
  "overallReasoning": "Summary of verification findings"
}

**CRITICAL - Verdict Field Requirements**:

The "verdict" field MUST be EXACTLY ONE of these three string values (choose only one):
- \`"pass"\` - Use this if ALL criteria are satisfied with confidence > 0.7
- \`"fail"\` - Use this if ANY criterion is clearly NOT satisfied
- \`"needs_review"\` - Use this if evidence is insufficient or confidence too low

Replace \`<VERDICT>\` with your chosen value. Do NOT output the literal string "pass|fail|needs_review".

Analyze the diff now.`;
}
