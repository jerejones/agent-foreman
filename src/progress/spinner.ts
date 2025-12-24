/**
 * Spinner for showing activity during long operations
 */

import chalk from "chalk";
import { isTTY, SPINNER_FRAMES } from "./utils.js";

/**
 * Spinner for showing activity during long operations
 */
export class Spinner {
  private message: string;
  private startTime: number;
  private intervalId: NodeJS.Timeout | null = null;
  private frameIndex = 0;
  private stopped = false;

  constructor(message: string) {
    this.message = message;
    this.startTime = Date.now();
  }

  /**
   * Start the spinner
   */
  start(): void {
    if (this.stopped) return;
    this.startTime = Date.now();

    if (isTTY()) {
      // In TTY mode, show animated spinner
      this.intervalId = setInterval(() => {
        this.render();
      }, 80);
      this.render();
    } else {
      // In non-TTY mode, just print the message once
      console.log(`${this.message}...`);
    }
  }

  /**
   * Render current spinner frame (TTY only)
   */
  private render(): void {
    if (!isTTY() || this.stopped) return;

    const elapsed = this.getElapsedTime();
    const frame = SPINNER_FRAMES[this.frameIndex];
    const output = `\r${chalk.cyan(frame)} ${this.message} ${chalk.gray(`(${elapsed})`)}`;

    process.stdout.write(output);
    this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length;
  }

  /**
   * Update the spinner message
   */
  update(message: string): void {
    this.message = message;
    if (!isTTY()) {
      console.log(`${message}...`);
    }
  }

  /**
   * Get formatted elapsed time
   */
  private getElapsedTime(): string {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    if (elapsed < 60) {
      return `${elapsed}s`;
    }
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Stop the spinner with success message
   */
  succeed(message?: string): void {
    this.stop();
    const elapsed = this.getElapsedTime();
    const finalMessage = message || this.message;

    if (isTTY()) {
      process.stdout.write(`\r${chalk.green("✓")} ${finalMessage} ${chalk.gray(`(${elapsed})`)}\n`);
    } else {
      console.log(`✓ ${finalMessage} (${elapsed})`);
    }
  }

  /**
   * Stop the spinner with failure message
   */
  fail(message?: string): void {
    this.stop();
    const elapsed = this.getElapsedTime();
    const finalMessage = message || this.message;

    if (isTTY()) {
      process.stdout.write(`\r${chalk.red("✗")} ${finalMessage} ${chalk.gray(`(${elapsed})`)}\n`);
    } else {
      console.log(`✗ ${finalMessage} (${elapsed})`);
    }
  }

  /**
   * Stop the spinner with warning message
   */
  warn(message?: string): void {
    this.stop();
    const elapsed = this.getElapsedTime();
    const finalMessage = message || this.message;

    if (isTTY()) {
      process.stdout.write(`\r${chalk.yellow("⚠")} ${finalMessage} ${chalk.gray(`(${elapsed})`)}\n`);
    } else {
      console.log(`⚠ ${finalMessage} (${elapsed})`);
    }
  }

  /**
   * Stop the spinner without status message
   */
  stop(): void {
    this.stopped = true;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Clear the line in TTY mode
    if (isTTY()) {
      process.stdout.write("\r" + " ".repeat(80) + "\r");
    }
  }
}
