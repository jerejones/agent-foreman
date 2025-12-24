/**
 * Output formatting for file strategy
 */

import type { FileCheckResult } from "./types.js";

/**
 * Format output message from file check results
 */
export function formatOutput(results: FileCheckResult[], patterns: string[]): string {
  const lines: string[] = [];

  lines.push(`File verification for patterns: ${patterns.join(", ")}`);
  lines.push(`Files checked: ${results.length}`);
  lines.push("");

  const passed = results.filter((r) => r.success).length;
  const failed = results.length - passed;

  lines.push(`Results: ${passed} passed, ${failed} failed`);
  lines.push("");

  // Show failed files first
  const failedResults = results.filter((r) => !r.success);
  if (failedResults.length > 0) {
    lines.push("Failed:");
    for (const result of failedResults) {
      lines.push(`  ${result.path}`);
      for (const check of result.checks.filter((c) => !c.success)) {
        lines.push(`    ✗ ${check.type}: ${check.message ?? "failed"}`);
      }
    }
    lines.push("");
  }

  // Show passed files (abbreviated if many)
  const passedResults = results.filter((r) => r.success);
  if (passedResults.length > 0) {
    lines.push("Passed:");
    const showCount = Math.min(passedResults.length, 10);
    for (let i = 0; i < showCount; i++) {
      lines.push(`  ✓ ${passedResults[i].path}`);
    }
    if (passedResults.length > showCount) {
      lines.push(`  ... and ${passedResults.length - showCount} more`);
    }
  }

  return lines.join("\n");
}
