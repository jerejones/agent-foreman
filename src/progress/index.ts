/**
 * Progress Module
 * Exports all progress indicator components
 */

// Utilities
export { isTTY } from "./utils.js";

// Classes
export { Spinner } from "./spinner.js";
export { ProgressBar } from "./progress-bar.js";
export { StepProgress } from "./step-progress.js";

// Factory functions
import { Spinner } from "./spinner.js";
import { ProgressBar } from "./progress-bar.js";
import { StepProgress } from "./step-progress.js";

/**
 * Create and start a spinner
 */
export function createSpinner(message: string): Spinner {
  const spinner = new Spinner(message);
  spinner.start();
  return spinner;
}

/**
 * Create a progress bar
 */
export function createProgressBar(
  message: string,
  total: number,
  width?: number
): ProgressBar {
  return new ProgressBar(message, total, width);
}

/**
 * Create step progress for verification
 */
export function createStepProgress(steps: string[]): StepProgress {
  return new StepProgress(steps);
}
