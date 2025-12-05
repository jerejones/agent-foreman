/**
 * Global test setup and teardown
 * Ensures proper cleanup of resources between test files
 */
import { afterAll, beforeAll } from "vitest";

beforeAll(() => {
  // Ensure CI environment is set for consistent test behavior
  process.env.CI = "true";
});

afterAll(async () => {
  // Clear any pending timers that might keep the process alive
  // This helps prevent orphan processes from setTimeout/setInterval

  // Give a small delay for any pending I/O to complete
  await new Promise((resolve) => setTimeout(resolve, 50));
});
