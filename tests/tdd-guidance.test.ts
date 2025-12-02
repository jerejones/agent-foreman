/**
 * Tests for TDD Guidance Generator
 */

import { describe, it, expect } from "vitest";
import {
  criterionToTestCase,
  criterionToE2EScenario,
  generateTDDGuidance,
  type TDDGuidance,
} from "../src/tdd-guidance.js";
import type { Feature } from "../src/types.js";
import type { ExtendedCapabilities } from "../src/verification-types.js";

describe("criterionToTestCase", () => {
  it("should handle 'X can Y' pattern", () => {
    expect(criterionToTestCase("User can submit the form")).toBe(
      "should allow user to submit the form"
    );
    expect(criterionToTestCase("Admin can delete users")).toBe(
      "should allow admin to delete users"
    );
  });

  it("should handle 'X should Y' pattern", () => {
    expect(criterionToTestCase("System should validate input")).toBe(
      "should validate input"
    );
    expect(criterionToTestCase("API should return 200")).toBe(
      "should return 200"
    );
  });

  it("should handle verb patterns", () => {
    expect(criterionToTestCase("API returns 201 status")).toBe(
      "should return 201 status"
    );
    expect(criterionToTestCase("Form displays error message")).toBe(
      "should display error message"
    );
    expect(criterionToTestCase("System validates email format")).toBe(
      "should validate email format"
    );
    expect(criterionToTestCase("Handler creates new record")).toBe(
      "should create new record"
    );
    expect(criterionToTestCase("Service updates user profile")).toBe(
      "should update user profile"
    );
    expect(criterionToTestCase("Controller deletes the item")).toBe(
      "should delete the item"
    );
    expect(criterionToTestCase("Module sends notification")).toBe(
      "should send notification"
    );
    expect(criterionToTestCase("System receives webhook")).toBe(
      "should receive webhook"
    );
    expect(criterionToTestCase("App handles errors gracefully")).toBe(
      "should handle errors gracefully"
    );
    expect(criterionToTestCase("Feature supports pagination")).toBe(
      "should support pagination"
    );
    expect(criterionToTestCase("Result is sorted")).toBe("should be sorted");
    expect(criterionToTestCase("Items are visible")).toBe("should be visible");
    expect(criterionToTestCase("User has access")).toBe("should have access");
    expect(criterionToTestCase("Users have permissions")).toBe(
      "should have permissions"
    );
  });

  it("should handle imperative patterns", () => {
    expect(criterionToTestCase("Verify email is valid")).toBe(
      "should verify email is valid"
    );
    expect(criterionToTestCase("Check user authentication")).toBe(
      "should check user authentication"
    );
    expect(criterionToTestCase("Ensure data integrity")).toBe(
      "should ensure data integrity"
    );
    expect(criterionToTestCase("Test login flow")).toBe("should login flow");
  });

  it("should remove common prefixes", () => {
    expect(criterionToTestCase("The user can login")).toBe(
      "should allow user to login"
    );
    expect(criterionToTestCase("A form displays errors")).toBe(
      "should display errors"
    );
    expect(criterionToTestCase("An error is shown")).toBe("should be shown");
  });

  it("should handle plain text with should prefix", () => {
    expect(criterionToTestCase("loading spinner appears")).toBe(
      "should loading spinner appears"
    );
    expect(criterionToTestCase("should work correctly")).toBe(
      "should work correctly"
    );
  });

  it("should handle shows pattern", () => {
    expect(criterionToTestCase("Dialog shows confirmation")).toBe(
      "should show confirmation"
    );
  });
});

describe("criterionToE2EScenario", () => {
  it("should handle 'X can Y' pattern", () => {
    expect(criterionToE2EScenario("User can submit the form")).toBe(
      "user submits the form"
    );
    expect(criterionToE2EScenario("User can see the dashboard")).toBe(
      "user sees the dashboard"
    );
    expect(criterionToE2EScenario("Admin can delete a user")).toBe(
      "admin deletes a user"
    );
  });

  it("should handle 'X should Y' pattern", () => {
    expect(criterionToE2EScenario("Page should display welcome message")).toBe(
      "page display welcome message"
    );
  });

  it("should convert verbs to present tense", () => {
    expect(criterionToE2EScenario("User can login")).toBe("user logs in");
    expect(criterionToE2EScenario("User can logout")).toBe("user logs out");
    expect(criterionToE2EScenario("User can enter credentials")).toBe(
      "user enters credentials"
    );
    expect(criterionToE2EScenario("User can click button")).toBe(
      "user clicks button"
    );
    expect(criterionToE2EScenario("User can navigate to page")).toBe(
      "user navigates to page"
    );
    expect(criterionToE2EScenario("User can view profile")).toBe(
      "user views profile"
    );
    expect(criterionToE2EScenario("User can edit settings")).toBe(
      "user edits settings"
    );
    expect(criterionToE2EScenario("User can create post")).toBe(
      "user creates post"
    );
    expect(criterionToE2EScenario("User can save changes")).toBe(
      "user saves changes"
    );
    expect(criterionToE2EScenario("User can upload file")).toBe(
      "user uploads file"
    );
    expect(criterionToE2EScenario("User can download report")).toBe(
      "user downloads report"
    );
  });

  it("should remove common prefixes", () => {
    expect(criterionToE2EScenario("The user can login")).toBe("user logs in");
    expect(criterionToE2EScenario("A visitor can view page")).toBe(
      "visitor views page"
    );
  });

  it("should handle plain text", () => {
    expect(criterionToE2EScenario("should display error")).toBe("display error");
    expect(criterionToE2EScenario("form is submitted")).toBe("form is submitted");
  });
});

describe("generateTDDGuidance", () => {
  const mockFeature: Feature = {
    id: "auth.login",
    description: "User login functionality",
    module: "auth",
    priority: 1,
    status: "failing",
    acceptance: [
      "User can enter email and password",
      "Invalid credentials show error message",
      "Successful login redirects to dashboard",
      "API returns 401 for invalid credentials",
    ],
    dependsOn: [],
    supersedes: [],
    tags: [],
    version: 1,
    origin: "manual",
    notes: "",
  };

  const mockCapabilities: ExtendedCapabilities = {
    hasTests: true,
    testCommand: "npm test",
    testFramework: "vitest",
    hasTypeCheck: true,
    typeCheckCommand: "tsc --noEmit",
    hasLint: true,
    lintCommand: "eslint .",
    hasBuild: true,
    buildCommand: "npm run build",
    source: "preset",
    confidence: 0.9,
    languages: ["typescript"],
    detectedAt: new Date().toISOString(),
  };

  it("should generate guidance with all required fields", () => {
    const guidance = generateTDDGuidance(mockFeature, mockCapabilities, "/project");

    expect(guidance.featureId).toBe("auth.login");
    expect(guidance.suggestedTestFiles).toBeDefined();
    expect(guidance.suggestedTestFiles.unit).toBeInstanceOf(Array);
    expect(guidance.suggestedTestFiles.e2e).toBeInstanceOf(Array);
    expect(guidance.testCaseStubs).toBeDefined();
    expect(guidance.testCaseStubs.unit).toBeInstanceOf(Array);
    expect(guidance.testCaseStubs.e2e).toBeInstanceOf(Array);
    expect(guidance.acceptanceMapping).toBeInstanceOf(Array);
  });

  it("should suggest appropriate test file paths", () => {
    const guidance = generateTDDGuidance(mockFeature, mockCapabilities, "/project");

    expect(guidance.suggestedTestFiles.unit).toContain("tests/auth/login.test.ts");
    expect(guidance.suggestedTestFiles.e2e).toContain("e2e/auth/login.spec.ts");
  });

  it("should map acceptance criteria to test cases", () => {
    const guidance = generateTDDGuidance(mockFeature, mockCapabilities, "/project");

    expect(guidance.acceptanceMapping).toHaveLength(4);

    // Check first criterion mapping
    const firstMapping = guidance.acceptanceMapping[0];
    expect(firstMapping.criterion).toBe("User can enter email and password");
    expect(firstMapping.unitTestCase).toBe(
      "should allow user to enter email and password"
    );
    expect(firstMapping.e2eScenario).toBe("user enters email and password");
  });

  it("should identify UI-related criteria for E2E tests", () => {
    const guidance = generateTDDGuidance(mockFeature, mockCapabilities, "/project");

    // First three criteria have UI keywords
    expect(guidance.acceptanceMapping[0].e2eScenario).toBeDefined();
    expect(guidance.acceptanceMapping[1].e2eScenario).toBeDefined();
    expect(guidance.acceptanceMapping[2].e2eScenario).toBeDefined();

    // Fourth criterion is API-only (no UI keywords)
    expect(guidance.acceptanceMapping[3].e2eScenario).toBeUndefined();
  });

  it("should generate test case stubs", () => {
    const guidance = generateTDDGuidance(mockFeature, mockCapabilities, "/project");

    expect(guidance.testCaseStubs.unit).toHaveLength(4);
    expect(guidance.testCaseStubs.e2e).toHaveLength(3); // Only UI-related ones
  });

  it("should handle feature without capabilities", () => {
    const guidance = generateTDDGuidance(mockFeature, null, "/project");

    expect(guidance.featureId).toBe("auth.login");
    expect(guidance.suggestedTestFiles.unit).toBeDefined();
    expect(guidance.suggestedTestFiles.unit.length).toBeGreaterThan(0);
  });

  it("should sanitize module names for file paths", () => {
    const featureWithSpecialModule: Feature = {
      ...mockFeature,
      id: "user-auth.login",
      module: "User Auth Module",
    };

    const guidance = generateTDDGuidance(
      featureWithSpecialModule,
      mockCapabilities,
      "/project"
    );

    // Should sanitize to lowercase with hyphens
    expect(guidance.suggestedTestFiles.unit[0]).toContain("user-auth-module");
  });

  it("should handle different test frameworks", () => {
    const pytestCapabilities: ExtendedCapabilities = {
      ...mockCapabilities,
      testFramework: "pytest",
    };

    const guidance = generateTDDGuidance(mockFeature, pytestCapabilities, "/project");

    expect(guidance.suggestedTestFiles.unit[0]).toContain(".py");
  });

  it("should handle go test framework", () => {
    const goCapabilities: ExtendedCapabilities = {
      ...mockCapabilities,
      testFramework: "go",
    };

    const guidance = generateTDDGuidance(mockFeature, goCapabilities, "/project");

    expect(guidance.suggestedTestFiles.unit[0]).toContain("_test.go");
  });

  it("should handle cargo test framework", () => {
    const cargoCapabilities: ExtendedCapabilities = {
      ...mockCapabilities,
      testFramework: "cargo",
    };

    const guidance = generateTDDGuidance(mockFeature, cargoCapabilities, "/project");

    expect(guidance.suggestedTestFiles.unit[0]).toContain(".rs");
  });
});
