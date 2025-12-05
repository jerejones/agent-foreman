/**
 * Pattern matching rules for criterion conversion
 */

/**
 * Patterns for removing common prefixes from criteria
 */
export const prefixPatterns = [
  /^the\s+/i,
  /^a\s+/i,
  /^an\s+/i,
];

/**
 * Patterns for imperative commands (Verify, Check, Ensure, Test)
 */
export const imperativePatterns = [
  { pattern: /^verify\s+(.+)$/i, format: "should verify $1" },
  { pattern: /^check\s+(.+)$/i, format: "should check $1" },
  { pattern: /^ensure\s+(.+)$/i, format: "should ensure $1" },
  { pattern: /^test\s+(.+)$/i, format: "should $1" },
];

/**
 * Patterns for verb-based criteria (returns, displays, shows, etc.)
 */
export const verbPatterns = [
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

/**
 * UI-related keywords that suggest E2E testing is needed
 */
export const uiKeywords = [
  "user",
  "display",
  "show",
  "click",
  "navigate",
  "redirect",
  "form",
  "page",
  "button",
  "input",
  "message",
  "modal",
  "dialog",
  "toast",
  "notification",
  "error",
  "success",
];

/**
 * Verb replacements for E2E scenario conversion (base form to third person)
 */
export const verbReplacements: Array<[RegExp, string]> = [
  [/\bsubmit\b/gi, "submits"],
  [/\blogin\b/gi, "logs in"],
  [/\blogout\b/gi, "logs out"],
  [/\bsee\b/gi, "sees"],
  [/\benter\b/gi, "enters"],
  [/\bclick\b/gi, "clicks"],
  [/\bnavigate\b/gi, "navigates"],
  [/\bview\b/gi, "views"],
  [/\bedit\b/gi, "edits"],
  [/\bdelete\b/gi, "deletes"],
  [/\bcreate\b/gi, "creates"],
  [/\bsave\b/gi, "saves"],
  [/\bupload\b/gi, "uploads"],
  [/\bdownload\b/gi, "downloads"],
];
