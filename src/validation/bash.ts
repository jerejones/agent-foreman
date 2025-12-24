/**
 * Bash script validation
 *
 * Validates merged bash scripts for common issues
 * without requiring a full bash parser.
 */

export interface BashValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a bash script for common issues
 *
 * @param script - The bash script content
 * @returns Validation result with errors and warnings
 */
export function validateBashScript(script: string): BashValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines = script.split("\n");

  // Check 1: Must have shebang
  if (!script.startsWith("#!/usr/bin/env bash") && !script.startsWith("#!/bin/bash")) {
    errors.push("Script must start with shebang (#!/usr/bin/env bash or #!/bin/bash)");
  }

  // Check 2: Balanced braces for functions
  let braceCount = 0;
  let inFunction = false;
  let functionName = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith("#")) continue;

    // Detect function definition
    const funcMatch = trimmed.match(/^(\w+)\s*\(\s*\)\s*\{?\s*$/);
    if (funcMatch) {
      inFunction = true;
      functionName = funcMatch[1];
    }

    // Count braces (simplified - doesn't handle braces in strings)
    for (const char of line) {
      if (char === "{") braceCount++;
      if (char === "}") braceCount--;
    }

    if (braceCount < 0) {
      errors.push(`Unbalanced closing brace at line ${i + 1}`);
      break;
    }
  }

  if (braceCount > 0) {
    errors.push(`Unclosed braces (${braceCount} unclosed)`);
  }

  // Check 3: Case statement balance (only count on non-comment lines)
  const nonCommentLinesForCounting = lines.filter(
    (l) => !l.trim().startsWith("#")
  );
  const scriptWithoutComments = nonCommentLinesForCounting.join("\n");

  const caseCount = (scriptWithoutComments.match(/\bcase\b/g) || []).length;
  const esacCount = (scriptWithoutComments.match(/\besac\b/g) || []).length;
  if (caseCount !== esacCount) {
    errors.push(`Unbalanced case/esac statements (${caseCount} case, ${esacCount} esac)`);
  }

  // Check 4: If statement balance (only count on non-comment lines)
  const ifCount = (scriptWithoutComments.match(/\bif\b/g) || []).length;
  const fiCount = (scriptWithoutComments.match(/\bfi\b/g) || []).length;
  if (ifCount !== fiCount) {
    errors.push(`Unbalanced if/fi statements (${ifCount} if, ${fiCount} fi)`);
  }

  // Check 5: Expected functions for init.sh
  const expectedFunctions = ["bootstrap", "dev", "check"];
  for (const func of expectedFunctions) {
    const funcPattern = new RegExp(`\\b${func}\\s*\\(\\s*\\)`);
    if (!funcPattern.test(script)) {
      warnings.push(`Missing expected function: ${func}()`);
    }
  }

  // Check 6: Has main entry point (case statement usually)
  if (!script.includes('case "$1"') && !script.includes("case \"$1\"")) {
    warnings.push("Missing main case statement for command dispatch");
  }

  // Check 7: Common syntax errors
  // Unquoted variables that might cause issues
  const dangerousPatterns = [
    { pattern: /\$\w+\s+&&/, message: "Unquoted variable before &&" },
    { pattern: /\[\s+\$\w+\s+[=!]/, message: "Unquoted variable in test expression" },
  ];

  for (const { pattern, message } of dangerousPatterns) {
    if (pattern.test(script)) {
      warnings.push(message);
    }
  }

  // Check 8: Empty script
  const nonCommentLines = lines.filter(
    (l) => l.trim().length > 0 && !l.trim().startsWith("#")
  );
  if (nonCommentLines.length < 5) {
    warnings.push("Script appears to be nearly empty");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Quick check if script looks like valid bash
 * Used for fast fail before more expensive validation
 * Note: Does NOT trim content - shebang must be at the very start
 */
export function isLikelyBashScript(content: string): boolean {
  return (
    content.startsWith("#!/usr/bin/env bash") ||
    content.startsWith("#!/bin/bash") ||
    content.startsWith("#!/bin/sh")
  );
}
