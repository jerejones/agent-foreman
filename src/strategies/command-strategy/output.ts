/**
 * Command Strategy Output Formatting
 */

/**
 * Format output message
 */
export function formatOutput(
  stdout: string,
  stderr: string,
  exitCode: number,
  exitCodeFailed: boolean,
  stdoutPatternFailed: boolean,
  stderrPatternFailed: boolean,
  notPatternsFailed: boolean,
  failedNotPattern?: string
): string {
  const lines: string[] = [];

  lines.push(`Exit code: ${exitCode}`);

  if (exitCodeFailed) {
    lines.push("Exit code did not match expected value");
  }

  if (stdoutPatternFailed) {
    lines.push("Stdout did not match expected pattern");
  }

  if (stderrPatternFailed) {
    lines.push("Stderr did not match expected pattern");
  }

  if (notPatternsFailed && failedNotPattern) {
    lines.push(`Negative assertion failed: pattern '${failedNotPattern}' was found`);
  }

  // Truncate output if too long
  const maxLength = 2000;

  lines.push("");
  lines.push("STDOUT:");
  lines.push(stdout.length > maxLength ? stdout.slice(0, maxLength) + "..." : stdout);

  if (stderr) {
    lines.push("");
    lines.push("STDERR:");
    lines.push(stderr.length > maxLength ? stderr.slice(0, maxLength) + "..." : stderr);
  }

  return lines.join("\n");
}
