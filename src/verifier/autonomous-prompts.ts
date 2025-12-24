/**
 * Autonomous verification prompts
 * Prompt building and response parsing for autonomous AI exploration
 */

import type { Feature } from "../types/index.js";
import type {
  AutomatedCheckResult,
  CriterionResult,
  VerificationVerdict,
} from "./types/index.js";

/**
 * Build autonomous verification prompt
 * The AI explores the codebase itself to verify acceptance criteria
 */
export function buildAutonomousVerificationPrompt(
  cwd: string,
  feature: Feature,
  automatedResults: AutomatedCheckResult[]
): string {
  const criteriaList = feature.acceptance
    .map((c, i) => `${i + 1}. ${c}`)
    .join("\n");

  const automatedSummary = automatedResults.length > 0
    ? automatedResults.map(r =>
        `- ${r.type.toUpperCase()}: ${r.success ? "PASSED" : "FAILED"}${r.duration ? ` (${r.duration}ms)` : ""}`
      ).join("\n")
    : "No automated checks were run.";

  return `You are a software verification expert. Verify if a feature's acceptance criteria are satisfied.

## Working Directory

${cwd}

You are currently working in this directory. Explore it using your available tools.

## Feature Information

- **ID**: ${feature.id}
- **Description**: ${feature.description}
- **Module**: ${feature.module}

## Acceptance Criteria to Verify

${criteriaList}

## Automated Check Results

${automatedSummary}

## Your Task

Perform autonomous exploration to verify EACH acceptance criterion:

1. **Explore the codebase**: Read source files, tests, and configs as needed
2. **Find evidence**: Look for code that implements each criterion
3. **Check tests**: Verify that tests exist and cover the functionality
4. **Assess completeness**: Determine if each criterion is fully satisfied

For each criterion, you must:
- Read the relevant source files
- Check for test coverage
- Verify the implementation matches the requirement

## Output

After your exploration, return ONLY a JSON object (no markdown, no explanation):

{
  "criteriaResults": [
    {
      "index": 0,
      "criterion": "exact text of criterion",
      "satisfied": true,
      "reasoning": "Detailed explanation with file:line references",
      "evidence": ["src/file.ts:45", "tests/file.test.ts:100"],
      "confidence": 0.95
    }
  ],
  "verdict": "<VERDICT>",
  "overallReasoning": "Summary of verification findings",
  "suggestions": ["Improvement suggestions if any"],
  "codeQualityNotes": ["Quality observations if any"]
}

**CRITICAL - Verdict Field Requirements**:

The "verdict" field MUST be EXACTLY ONE of these three string values (choose only one):
- \`"pass"\` - Use this if ALL criteria are satisfied with confidence > 0.7
- \`"fail"\` - Use this if ANY criterion is clearly NOT satisfied
- \`"needs_review"\` - Use this if evidence is insufficient or confidence too low

Replace \`<VERDICT>\` with your chosen value. Do NOT output the literal string "pass|fail|needs_review".

Begin exploration now. Read files, search code, and verify each criterion.`;
}

/**
 * Parsed autonomous verification response
 */
export interface AutonomousVerificationResponse {
  criteriaResults: CriterionResult[];
  verdict: VerificationVerdict;
  overallReasoning: string;
  suggestions: string[];
  codeQualityNotes: string[];
}

/**
 * Parse autonomous verification response
 */
export function parseAutonomousVerificationResponse(
  response: string,
  acceptance: string[]
): AutonomousVerificationResponse {
  try {
    // Extract JSON from response
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Try to find JSON object
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    // Normalize and validate verdict value
    // Handle edge cases where model outputs literal "pass|fail|needs_review" or other invalid values
    let verdict: VerificationVerdict = "needs_review";
    if (parsed.verdict) {
      const v = String(parsed.verdict).toLowerCase().trim();
      if (v === "pass") {
        verdict = "pass";
      } else if (v === "fail") {
        verdict = "fail";
      } else if (v === "needs_review") {
        verdict = "needs_review";
      }
      // Invalid values like "pass|fail|needs_review" or "<VERDICT>" will default to "needs_review"
    }

    // Map criteria results
    const criteriaResults: CriterionResult[] = acceptance.map((criterion, index) => {
      const result = parsed.criteriaResults?.find((r: { index: number }) => r.index === index);
      if (result) {
        return {
          criterion,
          index,
          satisfied: result.satisfied ?? false,
          reasoning: result.reasoning ?? "No reasoning provided",
          evidence: result.evidence ?? [],
          confidence: result.confidence ?? 0.5,
        };
      }
      return {
        criterion,
        index,
        satisfied: false,
        reasoning: "Criterion not analyzed by AI",
        evidence: [],
        confidence: 0,
      };
    });

    return {
      criteriaResults,
      verdict,
      overallReasoning: parsed.overallReasoning ?? "",
      suggestions: parsed.suggestions ?? [],
      codeQualityNotes: parsed.codeQualityNotes ?? [],
    };
  } catch (error) {
    // Return failure result if parsing fails
    return {
      criteriaResults: acceptance.map((criterion, index) => ({
        criterion,
        index,
        satisfied: false,
        reasoning: `Failed to parse AI response: ${(error as Error).message}`,
        evidence: [],
        confidence: 0,
      })),
      verdict: "needs_review",
      overallReasoning: "AI response could not be parsed",
      suggestions: [],
      codeQualityNotes: [],
    };
  }
}
