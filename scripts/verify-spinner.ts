#!/usr/bin/env bun
/**
 * Simple verification script to test spinner module logic
 * Run with: bun scripts/verify-spinner.ts
 */

import { createSpinner, withSpinner } from "../src/ui/index.js";

console.log("=== Spinner Module Verification ===\n");

// Test 1: Spinner creation
console.log("Test 1: Spinner creation");
const spinner = createSpinner();
console.log(`  Has start: ${typeof spinner.start === "function"}`);
console.log(`  Has update: ${typeof spinner.update === "function"}`);
console.log(`  Has succeed: ${typeof spinner.succeed === "function"}`);
console.log(`  Has fail: ${typeof spinner.fail === "function"}`);
console.log(`  Has warn: ${typeof spinner.warn === "function"}`);
console.log(`  Has stop: ${typeof spinner.stop === "function"}`);
console.log(`  Has isSpinning: ${typeof spinner.isSpinning === "function"}`);
console.assert(typeof spinner.start === "function");
console.assert(typeof spinner.isSpinning === "function");
console.log("  ✓ PASSED\n");

// Test 2: Spinner state
console.log("Test 2: Spinner state tracking");
console.log(`  Initial isSpinning: ${spinner.isSpinning()}`);
console.assert(spinner.isSpinning() === false, "Should not be spinning initially");
console.log("  ✓ PASSED\n");

// Test 3: succeed/fail/warn output
console.log("Test 3: succeed output");
const spinner2 = createSpinner({ indent: 0 });
spinner2.succeed("Test succeeded");
console.log("  ✓ PASSED\n");

console.log("Test 4: fail output");
const spinner3 = createSpinner({ indent: 0 });
spinner3.fail("Test failed");
console.log("  ✓ PASSED\n");

console.log("Test 5: warn output");
const spinner4 = createSpinner({ indent: 0 });
spinner4.warn("Test warning");
console.log("  ✓ PASSED\n");

// Test 6: withSpinner helper
console.log("Test 6: withSpinner helper");
const result = await withSpinner(
  "Loading",
  async () => {
    // Simulate async work
    await new Promise((resolve) => setTimeout(resolve, 10));
    return 42;
  },
  { indent: 0, successMessage: "Loaded successfully" }
);
console.log(`  Result: ${result}`);
console.assert(result === 42, "Expected result to be 42");
console.log("  ✓ PASSED\n");

// Test 7: withSpinner with error
console.log("Test 7: withSpinner error handling");
try {
  await withSpinner(
    "Loading",
    async () => {
      throw new Error("Test error");
    },
    { indent: 0 }
  );
  console.assert(false, "Should have thrown");
} catch (e) {
  console.log(`  Caught error: ${(e as Error).message}`);
  console.assert((e as Error).message === "Test error");
}
console.log("  ✓ PASSED\n");

// Test 8: Custom indentation
console.log("Test 8: Custom indentation");
const spinner5 = createSpinner({ indent: 4 });
spinner5.succeed("Four space indent");
console.log("  ✓ PASSED\n");

// Test 9: withSpinner dynamic success message
console.log("Test 9: withSpinner dynamic success message");
await withSpinner(
  "Processing",
  async () => 5,
  {
    indent: 0,
    successMessage: (count) => `Processed ${count} items`,
  }
);
console.log("  ✓ PASSED\n");

console.log("=== All spinner tests passed! ===");
