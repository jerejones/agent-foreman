/**
 * AI Strategy Output Formatting
 * Functions to format AI verification results
 */

import type { CriterionResult, VerificationVerdict } from "../../verifier/types/index.js";
import type { ParsedAIResponse } from "./parser.js";

/**
 * Format output message from parsed AI response
 */
export function formatAIOutput(parsed: ParsedAIResponse, verdictOverride?: VerificationVerdict): string {
  const lines: string[] = [];
  const verdict = verdictOverride ?? parsed.verdict;

  lines.push(`AI Verification: ${verdict.toUpperCase()}`);
  lines.push("");

  lines.push("Criteria Results:");
  for (const result of parsed.criteriaResults) {
    const status = result.satisfied ? "[PASS]" : "[FAIL]";
    const confidence = `(${Math.round(result.confidence * 100)}%)`;
    lines.push(`  ${status} ${confidence} ${result.criterion}`);
    if (result.reasoning) {
      lines.push(`       ${result.reasoning.slice(0, 200)}${result.reasoning.length > 200 ? "..." : ""}`);
    }
  }

  if (parsed.overallReasoning) {
    lines.push("");
    lines.push("Overall: " + parsed.overallReasoning);
  }

  if (parsed.suggestions && parsed.suggestions.length > 0) {
    lines.push("");
    lines.push("Suggestions:");
    for (const suggestion of parsed.suggestions) {
      lines.push(`  - ${suggestion}`);
    }
  }

  return lines.join("\n");
}
