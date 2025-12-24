/**
 * Progress bar for showing completion of multi-step operations
 */

import chalk from "chalk";
import { isTTY } from "./utils.js";

/**
 * Progress bar for showing completion of multi-step operations
 */
export class ProgressBar {
  private total: number;
  private current = 0;
  private message: string;
  private width: number;

  constructor(message: string, total: number, width: number = 30) {
    this.message = message;
    this.total = total;
    this.width = width;
  }

  /**
   * Start the progress bar
   */
  start(): void {
    this.current = 0;
    this.render();
  }

  /**
   * Update progress
   */
  update(current: number, message?: string): void {
    this.current = current;
    if (message) {
      this.message = message;
    }
    this.render();
  }

  /**
   * Increment progress by 1
   */
  increment(message?: string): void {
    this.update(this.current + 1, message);
  }

  /**
   * Render the progress bar
   */
  private render(): void {
    const percent = Math.min(100, Math.round((this.current / this.total) * 100));
    const filledWidth = Math.min(this.width, Math.round((this.current / this.total) * this.width));
    const emptyWidth = Math.max(0, this.width - filledWidth);

    const filled = chalk.green("█".repeat(filledWidth));
    const empty = chalk.gray("░".repeat(emptyWidth));
    const bar = `[${filled}${empty}]`;

    const stepInfo = chalk.gray(`(${this.current}/${this.total})`);
    const percentInfo = chalk.cyan(`${percent}%`);

    if (isTTY()) {
      process.stdout.write(`\r   ${bar} ${percentInfo} ${stepInfo} ${this.message}`);
    } else {
      console.log(`   [${this.current}/${this.total}] ${percent}% - ${this.message}`);
    }
  }

  /**
   * Complete the progress bar
   */
  complete(message?: string): void {
    this.current = this.total;
    const finalMessage = message || this.message;

    if (isTTY()) {
      const filled = chalk.green("█".repeat(this.width));
      const bar = `[${filled}]`;
      process.stdout.write(`\r   ${bar} ${chalk.green("100%")} ${chalk.gray(`(${this.total}/${this.total})`)} ${finalMessage}\n`);
    } else {
      console.log(`   [${this.total}/${this.total}] 100% - ${finalMessage} ✓`);
    }
  }
}
