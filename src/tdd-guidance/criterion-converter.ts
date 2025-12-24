/**
 * Functions to convert acceptance criteria to test case names
 */

/**
 * Convert an acceptance criterion to a unit test case name
 * Uses "should" prefix for standard test naming convention
 *
 * @example
 * criterionToTestCase("User can submit the form")
 * // Returns: "should allow user to submit the form"
 *
 * criterionToTestCase("API returns 201 status with created resource")
 * // Returns: "should return 201 status with created resource"
 */
export function criterionToTestCase(criterion: string): string {
  // Normalize the criterion
  let normalized = criterion.trim().toLowerCase();

  // Remove common prefixes
  const prefixPatterns = [
    /^the\s+/i,
    /^a\s+/i,
    /^an\s+/i,
  ];

  for (const pattern of prefixPatterns) {
    normalized = normalized.replace(pattern, "");
  }

  // Handle imperative patterns first (Verify, Check, Ensure, Test, etc.)
  // These should be matched before other patterns
  const imperativePatterns = [
    { pattern: /^verify\s+(.+)$/i, format: "should verify $1" },
    { pattern: /^check\s+(.+)$/i, format: "should check $1" },
    { pattern: /^ensure\s+(.+)$/i, format: "should ensure $1" },
    { pattern: /^test\s+(.+)$/i, format: "should $1" },
  ];

  for (const { pattern, format } of imperativePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      return format.replace("$1", match[1]);
    }
  }

  // Handle "X can Y" pattern -> "should allow X to Y"
  const canMatch = normalized.match(/^(.+?)\s+can\s+(.+)$/i);
  if (canMatch) {
    return `should allow ${canMatch[1]} to ${canMatch[2]}`;
  }

  // Handle "X should Y" pattern -> "should Y" (already in test format)
  const shouldMatch = normalized.match(/^.+?\s+should\s+(.+)$/i);
  if (shouldMatch) {
    return `should ${shouldMatch[1]}`;
  }

  // Handle verb patterns (returns, displays, shows, etc.)
  const verbPatterns = [
    { pattern: /^(.+?)\s+returns?\s+(.+)$/i, format: "should return $2" },
    { pattern: /^(.+?)\s+displays?\s+(.+)$/i, format: "should display $2" },
    { pattern: /^(.+?)\s+shows?\s+(.+)$/i, format: "should show $2" },
    { pattern: /^(.+?)\s+validates?\s+(.+)$/i, format: "should validate $2" },
    { pattern: /^(.+?)\s+creates?\s+(.+)$/i, format: "should create $2" },
    { pattern: /^(.+?)\s+updates?\s+(.+)$/i, format: "should update $2" },
    { pattern: /^(.+?)\s+deletes?\s+(.+)$/i, format: "should delete $2" },
    { pattern: /^(.+?)\s+sends?\s+(.+)$/i, format: "should send $2" },
    { pattern: /^(.+?)\s+receives?\s+(.+)$/i, format: "should receive $2" },
    { pattern: /^(.+?)\s+handles?\s+(.+)$/i, format: "should handle $2" },
    { pattern: /^(.+?)\s+supports?\s+(.+)$/i, format: "should support $2" },
    { pattern: /^(.+?)\s+is\s+(.+)$/i, format: "should be $2" },
    { pattern: /^(.+?)\s+are\s+(.+)$/i, format: "should be $2" },
    { pattern: /^(.+?)\s+has\s+(.+)$/i, format: "should have $2" },
    { pattern: /^(.+?)\s+have\s+(.+)$/i, format: "should have $2" },
  ];

  for (const { pattern, format } of verbPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      return format.replace("$2", match[2]);
    }
  }

  // Default: prefix with "should" if not already present
  if (normalized.startsWith("should ")) {
    return normalized;
  }

  return `should ${normalized}`;
}

/**
 * Convert an acceptance criterion to an E2E scenario name
 * Uses more user-focused language suitable for Playwright tests
 *
 * @example
 * criterionToE2EScenario("User can submit the form and see a success message")
 * // Returns: "user submits form and sees success message"
 */
export function criterionToE2EScenario(criterion: string): string {
  // Normalize the criterion
  let normalized = criterion.trim().toLowerCase();

  // Remove common prefixes
  const prefixPatterns = [
    /^the\s+/i,
    /^a\s+/i,
    /^an\s+/i,
  ];

  for (const pattern of prefixPatterns) {
    normalized = normalized.replace(pattern, "");
  }

  // Handle "X can Y" pattern -> "X does Y"
  const canMatch = normalized.match(/^(.+?)\s+can\s+(.+)$/i);
  if (canMatch) {
    // Convert "can verb" to just the verb in present tense
    const subject = canMatch[1];
    const action = canMatch[2];

    // Try to convert to present tense action
    const presentAction = action
      .replace(/\bsubmit\b/gi, "submits")
      .replace(/\blogin\b/gi, "logs in")
      .replace(/\blogout\b/gi, "logs out")
      .replace(/\bsee\b/gi, "sees")
      .replace(/\benter\b/gi, "enters")
      .replace(/\bclick\b/gi, "clicks")
      .replace(/\bnavigate\b/gi, "navigates")
      .replace(/\bview\b/gi, "views")
      .replace(/\bedit\b/gi, "edits")
      .replace(/\bdelete\b/gi, "deletes")
      .replace(/\bcreate\b/gi, "creates")
      .replace(/\bsave\b/gi, "saves")
      .replace(/\bupload\b/gi, "uploads")
      .replace(/\bdownload\b/gi, "downloads");

    return `${subject} ${presentAction}`;
  }

  // Handle "X should Y" pattern -> "X does Y"
  const shouldMatch = normalized.match(/^(.+?)\s+should\s+(.+)$/i);
  if (shouldMatch) {
    return `${shouldMatch[1]} ${shouldMatch[2]}`;
  }

  // Remove "should" prefix if present
  if (normalized.startsWith("should ")) {
    normalized = normalized.substring(7);
  }

  return normalized;
}
