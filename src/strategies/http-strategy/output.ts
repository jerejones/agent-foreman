/**
 * HTTP Strategy Output Formatting
 */

/**
 * Format output message
 */
export function formatOutput(
  statusCode: number,
  responseBody: string,
  statusFailed: boolean,
  patternFailed: boolean,
  jsonErrors: string[]
): string {
  const lines: string[] = [];

  lines.push(`HTTP Status: ${statusCode}`);

  if (statusFailed) {
    lines.push("Status code did not match expected value");
  }

  if (patternFailed) {
    lines.push("Response body did not match expected pattern");
  }

  if (jsonErrors.length > 0) {
    lines.push("JSON assertion failures:");
    jsonErrors.forEach((err) => lines.push(`  - ${err}`));
  }

  // Truncate response body if too long
  const maxBodyLength = 1000;
  const truncatedBody =
    responseBody.length > maxBodyLength
      ? responseBody.slice(0, maxBodyLength) + "..."
      : responseBody;

  lines.push("");
  lines.push("Response body:");
  lines.push(truncatedBody);

  return lines.join("\n");
}
