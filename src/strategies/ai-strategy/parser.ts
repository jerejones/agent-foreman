/**
 * AI Response Parser
 * Functions to parse AI verification responses
 */

import type { CriterionResult, VerificationVerdict } from "../../verifier/types/index.js";

/**
 * Parsed AI response structure
 */
export interface ParsedAIResponse {
  criteriaResults: CriterionResult[];
  verdict: VerificationVerdict;
  overallReasoning: string;
  suggestions: string[];
}

/**
 * Parse AI response into structured results
 */
export function parseAIResponse(response: string, acceptance: string[]): ParsedAIResponse {
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
      verdict: parsed.verdict ?? "needs_review",
      overallReasoning: parsed.overallReasoning ?? "",
      suggestions: parsed.suggestions ?? [],
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
    };
  }
}
