/**
 * Step progress indicator for verification workflow
 */

import { isTTY } from "./utils.js";
import { Spinner } from "./spinner.js";

/**
 * Step progress indicator for verification workflow
 */
export class StepProgress {
  private steps: string[];
  private currentStep = 0;
  private stepSpinner: Spinner | null = null;

  constructor(steps: string[]) {
    this.steps = steps;
  }

  /**
   * Start showing progress
   */
  start(): void {
    this.showOverview();
    this.startStep(0);
  }

  /**
   * Show all steps overview
   */
  private showOverview(): void {
    if (!isTTY()) {
      console.log(`\n   Verification steps: ${this.steps.length}`);
      this.steps.forEach((step, i) => {
        console.log(`   ${i + 1}. ${step}`);
      });
      console.log("");
    }
  }

  /**
   * Start a specific step
   */
  startStep(index: number): void {
    if (index >= this.steps.length) return;

    this.currentStep = index;
    const stepLabel = `Step ${index + 1}/${this.steps.length}: ${this.steps[index]}`;

    if (isTTY()) {
      this.stepSpinner = new Spinner(stepLabel);
      this.stepSpinner.start();
    } else {
      console.log(`   [${index + 1}/${this.steps.length}] ${this.steps[index]}...`);
    }
  }

  /**
   * Complete current step and move to next
   */
  completeStep(success: boolean = true): void {
    if (this.stepSpinner) {
      if (success) {
        this.stepSpinner.succeed();
      } else {
        this.stepSpinner.fail();
      }
    }

    // Start next step if available
    if (this.currentStep + 1 < this.steps.length) {
      this.startStep(this.currentStep + 1);
    }
  }

  /**
   * Mark current step with a warning
   */
  warnStep(): void {
    if (this.stepSpinner) {
      this.stepSpinner.warn();
    }

    // Start next step if available
    if (this.currentStep + 1 < this.steps.length) {
      this.startStep(this.currentStep + 1);
    }
  }

  /**
   * Complete all remaining steps (for early termination)
   */
  complete(): void {
    if (this.stepSpinner) {
      this.stepSpinner.stop();
    }
  }

  /**
   * Get current step index
   */
  getCurrentStep(): number {
    return this.currentStep;
  }
}
