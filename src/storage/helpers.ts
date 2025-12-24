/**
 * Internal helper functions for feature parsing
 */

/**
 * Extract acceptance criteria from markdown body
 */
export function extractAcceptanceCriteria(body: string): string[] {
  const criteria: string[] = [];

  // Find the "## Acceptance Criteria" section
  const sectionMatch = body.match(
    /## Acceptance Criteria\s*\n([\s\S]*?)(?=\n## |\n# |$)/i
  );

  if (sectionMatch) {
    const section = sectionMatch[1];
    // Match numbered list items: 1. text, 2. text, etc.
    const itemRegex = /^\d+\.\s+(.+)$/gm;
    let match;
    while ((match = itemRegex.exec(section)) !== null) {
      criteria.push(match[1].trim());
    }
  }

  return criteria;
}

/**
 * Extract notes from the "## Notes" section
 */
export function extractNotesSection(body: string): string {
  // Find the "## Notes" section
  const sectionMatch = body.match(
    /## Notes\s*\n([\s\S]*?)(?=\n## |\n# |$)/i
  );

  if (sectionMatch) {
    return sectionMatch[1].trim();
  }

  return "";
}

/**
 * Extract module name from task ID (e.g., "cli.survey" -> "cli")
 */
export function extractModuleFromId(id: string): string {
  const parts = id.split(".");
  return parts.length > 1 ? parts[0] : id;
}

// ============================================================================
// Section Update Helpers (for preserving custom content)
// ============================================================================

/**
 * Update the H1 heading (description) in raw body
 */
export function updateDescriptionHeading(body: string, description: string): string {
  // Match the first H1 heading
  if (body.match(/^#\s+.+$/m)) {
    return body.replace(/^#\s+.+$/m, `# ${description}`);
  }
  // If no H1 exists, prepend it
  return `# ${description}\n\n${body}`;
}

/**
 * Update the Acceptance Criteria section in raw body
 * Preserves the section position, only replaces content
 */
export function updateAcceptanceSection(body: string, acceptance: string[]): string {
  const criteria = acceptance.map((c, i) => `${i + 1}. ${c}`).join("\n");
  const newSection = `## Acceptance Criteria\n\n${criteria}\n`;

  // Check if section exists
  const sectionRegex = /## Acceptance Criteria\s*\n[\s\S]*?(?=\n## |\n# |$)/i;
  if (body.match(sectionRegex)) {
    return body.replace(sectionRegex, newSection.trimEnd());
  }

  // If section doesn't exist, add after H1 heading
  const h1Match = body.match(/^#\s+.+\n/m);
  if (h1Match) {
    const insertPos = (h1Match.index ?? 0) + h1Match[0].length;
    return body.slice(0, insertPos) + "\n" + newSection + body.slice(insertPos);
  }

  // Fallback: prepend
  return newSection + "\n" + body;
}

/**
 * Update the Notes section in raw body
 * Preserves the section position, only replaces content
 */
export function updateNotesSection(body: string, notes?: string): string {
  const notesContent = notes?.trim() ?? "";

  // Check if section exists
  const sectionRegex = /## Notes\s*\n[\s\S]*?(?=\n## |\n# |$)/i;

  if (notesContent) {
    const newSection = `## Notes\n\n${notesContent}\n`;
    if (body.match(sectionRegex)) {
      return body.replace(sectionRegex, newSection.trimEnd());
    }
    // If no notes section but notes exist, append at end
    return body.trimEnd() + "\n\n" + newSection;
  } else {
    // If notes are empty, remove the section entirely
    if (body.match(sectionRegex)) {
      return body.replace(sectionRegex, "").replace(/\n{3,}/g, "\n\n");
    }
    return body;
  }
}
