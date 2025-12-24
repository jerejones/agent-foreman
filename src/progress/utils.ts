/**
 * Shared utilities for progress indicators
 */

/**
 * Check if output is a TTY (interactive terminal)
 */
export function isTTY(): boolean {
  return process.stdout.isTTY === true;
}

/**
 * Spinner characters for TTY output
 */
export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
