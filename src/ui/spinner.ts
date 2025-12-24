/**
 * Simple spinner for long-running operations
 *
 * Provides visual feedback during AI and other async operations
 */

import chalk from "chalk";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const FRAME_INTERVAL = 80; // ms

export interface Spinner {
  /** Start the spinner with a message */
  start(message: string): void;
  /** Update the spinner message */
  update(message: string): void;
  /** Stop with success message */
  succeed(message: string): void;
  /** Stop with failure message */
  fail(message: string): void;
  /** Stop with warning message */
  warn(message: string): void;
  /** Stop the spinner without changing message */
  stop(): void;
  /** Check if spinner is running */
  isSpinning(): boolean;
}

/**
 * Create a new spinner instance
 *
 * @param options - Spinner options
 * @returns Spinner instance
 */
export function createSpinner(options?: { indent?: number }): Spinner {
  const indent = " ".repeat(options?.indent ?? 2);
  let intervalId: NodeJS.Timeout | null = null;
  let frameIndex = 0;
  let currentMessage = "";
  let spinning = false;

  function clearLine() {
    if (process.stdout.isTTY) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    }
  }

  function render() {
    if (!spinning) return;
    clearLine();
    const frame = SPINNER_FRAMES[frameIndex];
    process.stdout.write(`${indent}${chalk.cyan(frame)} ${currentMessage}`);
    frameIndex = (frameIndex + 1) % SPINNER_FRAMES.length;
  }

  return {
    start(message: string) {
      if (spinning) this.stop();
      currentMessage = message;
      spinning = true;
      frameIndex = 0;

      if (process.stdout.isTTY) {
        render();
        intervalId = setInterval(render, FRAME_INTERVAL);
      } else {
        // Non-TTY: just print the message once
        console.log(`${indent}${chalk.cyan("...")} ${message}`);
      }
    },

    update(message: string) {
      currentMessage = message;
      if (!process.stdout.isTTY && spinning) {
        console.log(`${indent}${chalk.cyan("...")} ${message}`);
      }
    },

    succeed(message: string) {
      this.stop();
      console.log(`${indent}${chalk.green("✓")} ${message}`);
    },

    fail(message: string) {
      this.stop();
      console.log(`${indent}${chalk.red("✗")} ${message}`);
    },

    warn(message: string) {
      this.stop();
      console.log(`${indent}${chalk.yellow("⚠")} ${message}`);
    },

    stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (spinning && process.stdout.isTTY) {
        clearLine();
      }
      spinning = false;
    },

    isSpinning() {
      return spinning;
    },
  };
}

/**
 * Run an async operation with a spinner
 *
 * @param message - Message to display while running
 * @param fn - Async function to execute
 * @returns Result of the async function
 */
export async function withSpinner<T>(
  message: string,
  fn: () => Promise<T>,
  options?: { indent?: number; successMessage?: string | ((result: T) => string) }
): Promise<T> {
  const spinner = createSpinner({ indent: options?.indent });
  spinner.start(message);

  try {
    const result = await fn();
    const successMsg =
      typeof options?.successMessage === "function"
        ? options.successMessage(result)
        : options?.successMessage ?? message;
    spinner.succeed(successMsg);
    return result;
  } catch (error) {
    spinner.fail(`${message} failed`);
    throw error;
  }
}
