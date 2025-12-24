/**
 * Progress indicators for long-running operations
 * Supports both TTY and non-TTY environments
 *
 * This file re-exports from the progress/ directory for backward compatibility.
 */

// Re-export everything from the module
export {
  isTTY,
  Spinner,
  ProgressBar,
  StepProgress,
  createSpinner,
  createProgressBar,
  createStepProgress,
} from "./progress/index.js";
