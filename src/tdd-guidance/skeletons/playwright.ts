/**
 * Playwright E2E test skeleton generator
 */

import type { Feature } from "../../types/index.js";

/**
 * Generate a Playwright E2E test skeleton for a feature
 *
 * @param feature - The feature to generate E2E tests for
 * @param scenarios - Array of E2E scenario names
 * @param tags - Array of Playwright tags (e.g., ["@smoke", "@feature-auth"])
 * @returns String containing the Playwright test file skeleton
 */
export function generateE2ETestSkeleton(
  feature: Feature,
  scenarios: string[],
  tags: string[] = []
): string {
  const featureName = feature.id.split(".").pop() || feature.id;
  const className = featureName
    .split(/[-_.]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

  const tagAnnotations = tags.length > 0 ? ` ${tags.join(" ")}` : "";

  const pageObjectClass = `/**
 * Page Object for ${featureName}
 * Encapsulates page interactions and locators
 */
class ${className}Page {
  readonly page: Page;

  // Locators
  // TODO: Add your locators here
  // readonly submitButton: Locator;
  // readonly emailInput: Locator;

  constructor(page: Page) {
    this.page = page;
    // Initialize locators
    // this.submitButton = page.getByRole("button", { name: "Submit" });
    // this.emailInput = page.getByLabel("Email");
  }

  async goto() {
    // TODO: Navigate to the page
    await this.page.goto("/${feature.module}/${featureName}");
  }

  // Page actions
  // TODO: Add your page actions here
  // async fillEmail(email: string) {
  //   await this.emailInput.fill(email);
  // }
  //
  // async submit() {
  //   await this.submitButton.click();
  // }
}`;

  const testBlocks = scenarios
    .map(
      (scenario) => `  test("${scenario}",${tagAnnotations} async ({ page }) => {
    const ${featureName}Page = new ${className}Page(page);

    // Arrange
    await ${featureName}Page.goto();

    // Act
    // TODO: Perform user actions

    // Assert
    // TODO: Verify the expected UI state
    await expect(page).toHaveTitle(/.*/); // Replace with actual assertion
  });`
    )
    .join("\n\n");

  return `import { test, expect, type Page, type Locator } from "@playwright/test";

${pageObjectClass}

test.describe("${featureName}", () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Set up before each test (e.g., login, seed data)
  });

${testBlocks}
});
`;
}
