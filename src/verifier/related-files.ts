/**
 * Related file reading for verification context
 */

import { isPathWithinRoot, safeReadFile } from "../file-utils.js";

/** Source file extensions for filtering */
const SOURCE_FILE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs"];

/**
 * Read related files for context
 * Uses parallel file reading for better performance
 * Validates paths to prevent path traversal attacks
 * Handles partial failures gracefully - continues if some files fail to read
 */
export async function readRelatedFiles(
  cwd: string,
  changedFiles: string[]
): Promise<Map<string, string>> {
  // Filter to source files only
  const sourceFiles = changedFiles.filter((f) =>
    SOURCE_FILE_EXTENSIONS.some((ext) => f.endsWith(ext))
  );

  // Validate paths before reading
  const validFiles = sourceFiles.filter((file) => isPathWithinRoot(cwd, file));

  // Read all files in parallel for better performance
  const readPromises = validFiles.map(async (file) => {
    const content = await safeReadFile(cwd, file);
    return { file, content };
  });

  const results = await Promise.all(readPromises);

  // Build Map from successful reads (gracefully handle failures)
  const relatedFiles = new Map<string, string>();
  for (const { file, content } of results) {
    if (content !== null) {
      relatedFiles.set(file, content);
    }
    // If content is null, file doesn't exist or can't be read - skip silently
  }

  return relatedFiles;
}
