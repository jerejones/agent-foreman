/**
 * Tests for src/prompts.ts - Prompt templates for CLAUDE.md and documentation
 */
import { describe, it, expect } from "vitest";
import {
  generateMinimalClaudeMd,
  generateCommitMessage,
  generateFeatureGuidance,
  generateImpactGuidance,
  generateSessionSummary,
} from "../src/prompts.js";

describe("Prompts", () => {
  describe("generateMinimalClaudeMd", () => {
    it("should generate minimal CLAUDE.md with project goal", () => {
      const content = generateMinimalClaudeMd("My project goal");

      expect(content).toContain("# Project Instructions");
      expect(content).toContain("## Project Goal");
      expect(content).toContain("My project goal");
    });

    it("should reference rules directory", () => {
      const content = generateMinimalClaudeMd("Test goal");

      expect(content).toContain(".claude/rules/");
      expect(content).toContain("loaded automatically by Claude Code");
    });

    it("should handle empty goal", () => {
      const content = generateMinimalClaudeMd("");

      expect(content).toContain("# Project Instructions");
      expect(content).toContain("## Project Goal");
    });

    it("should handle goal with special characters", () => {
      const goal = "Build a *special* app with `code` and <html>";
      const content = generateMinimalClaudeMd(goal);

      expect(content).toContain(goal);
    });
  });

  describe("generateCommitMessage", () => {
    it("should generate commit message with feature info", () => {
      const message = generateCommitMessage(
        "auth.login",
        "Add user login",
        "Implemented login form with validation"
      );

      expect(message).toContain("feat(auth): Add user login");
      expect(message).toContain("Implemented login form with validation");
      expect(message).toContain("Feature: auth.login");
    });

    it("should extract module from task ID", () => {
      const message = generateCommitMessage(
        "api.users.create",
        "Create user endpoint",
        "Summary"
      );

      expect(message).toContain("feat(api):");
    });

    it("should include generator attribution", () => {
      const message = generateCommitMessage("test.feature", "Test", "Summary");

      expect(message).toContain("Generated with agent-foreman");
    });

    it("should handle single-segment task ID", () => {
      const message = generateCommitMessage("core", "Core feature", "Summary");

      expect(message).toContain("feat(core):");
    });
  });

  describe("generateFeatureGuidance", () => {
    it("should generate guidance with feature details", () => {
      const feature = {
        id: "auth.login",
        description: "User login functionality",
        acceptance: ["User can enter credentials", "User sees success message"],
        dependsOn: [],
        notes: "",
      };

      const guidance = generateFeatureGuidance(feature);

      expect(guidance).toContain("## Task: auth.login");
      expect(guidance).toContain("**Description:** User login functionality");
    });

    it("should list acceptance criteria with checkboxes", () => {
      const feature = {
        id: "test",
        description: "Test",
        acceptance: ["First criterion", "Second criterion", "Third criterion"],
        dependsOn: [],
        notes: "",
      };

      const guidance = generateFeatureGuidance(feature);

      expect(guidance).toContain("### Acceptance Criteria");
      expect(guidance).toContain("1. [ ] First criterion");
      expect(guidance).toContain("2. [ ] Second criterion");
      expect(guidance).toContain("3. [ ] Third criterion");
    });

    it("should include dependencies section when present", () => {
      const feature = {
        id: "auth.profile",
        description: "User profile",
        acceptance: ["Criterion"],
        dependsOn: ["auth.login", "auth.register"],
        notes: "",
      };

      const guidance = generateFeatureGuidance(feature);

      expect(guidance).toContain("### Dependencies");
      expect(guidance).toContain("Ensure these tasks are passing first:");
      expect(guidance).toContain("- auth.login");
      expect(guidance).toContain("- auth.register");
    });

    it("should not include dependencies section when empty", () => {
      const feature = {
        id: "test",
        description: "Test",
        acceptance: ["Criterion"],
        dependsOn: [],
        notes: "",
      };

      const guidance = generateFeatureGuidance(feature);

      expect(guidance).not.toContain("### Dependencies");
    });

    it("should include notes section when present", () => {
      const feature = {
        id: "test",
        description: "Test",
        acceptance: ["Criterion"],
        dependsOn: [],
        notes: "Important implementation note",
      };

      const guidance = generateFeatureGuidance(feature);

      expect(guidance).toContain("### Notes");
      expect(guidance).toContain("Important implementation note");
    });

    it("should not include notes section when empty", () => {
      const feature = {
        id: "test",
        description: "Test",
        acceptance: ["Criterion"],
        dependsOn: [],
        notes: "",
      };

      const guidance = generateFeatureGuidance(feature);

      expect(guidance).not.toContain("### Notes");
    });

    it("should include workflow section", () => {
      const feature = {
        id: "auth.login",
        description: "Test",
        acceptance: ["Criterion"],
        dependsOn: [],
        notes: "",
      };

      const guidance = generateFeatureGuidance(feature);

      expect(guidance).toContain("### Workflow");
      expect(guidance).toContain("1. Review acceptance criteria above");
      expect(guidance).toContain("2. Implement the task");
      expect(guidance).toContain("3. Run `agent-foreman done");
      expect(guidance).toContain("(auto-verifies + commits)");
    });
  });

  describe("generateImpactGuidance", () => {
    it("should generate guidance for no affected tasks", () => {
      const guidance = generateImpactGuidance("auth.login", []);

      expect(guidance).toContain("## Impact Review: auth.login");
      expect(guidance).toContain("No other tasks are affected");
    });

    it("should list affected tasks in table", () => {
      const affected = [
        { id: "auth.profile", reason: "Depends on login" },
        { id: "auth.settings", reason: "Uses auth token" },
      ];

      const guidance = generateImpactGuidance("auth.login", affected);

      expect(guidance).toContain("## Impact Review: auth.login");
      expect(guidance).toContain("| Task | Reason | Action |");
      expect(guidance).toContain("| auth.profile | Depends on login | Review and update status |");
      expect(guidance).toContain("| auth.settings | Uses auth token | Review and update status |");
    });

    it("should include recommended actions", () => {
      const affected = [{ id: "test", reason: "Test reason" }];

      const guidance = generateImpactGuidance("feature", affected);

      expect(guidance).toContain("### Recommended Actions");
      expect(guidance).toContain("1. Review each affected task");
      expect(guidance).toContain("2. Run tests for affected modules");
      expect(guidance).toContain("3. Mark as `needs_review`");
      expect(guidance).toContain("4. Update `notes` field");
    });
  });

  describe("generateSessionSummary", () => {
    it("should generate summary with completed features", () => {
      const completed = [
        { id: "auth.login", description: "User login" },
        { id: "auth.register", description: "User registration" },
      ];

      const summary = generateSessionSummary(completed, [], null);

      expect(summary).toContain("## Session Summary");
      expect(summary).toContain("### Completed This Session");
      expect(summary).toContain("- ✅ auth.login: User login");
      expect(summary).toContain("- ✅ auth.register: User registration");
    });

    it("should show remaining feature count", () => {
      const remaining = [
        { id: "auth.profile", priority: 2 },
        { id: "auth.settings", priority: 3 },
        { id: "auth.logout", priority: 4 },
      ];

      const summary = generateSessionSummary([], remaining, null);

      expect(summary).toContain("### Remaining: 3 tasks");
    });

    it("should show next feature when available", () => {
      const next = { id: "auth.login", description: "User login functionality" };

      const summary = generateSessionSummary([], [], next);

      expect(summary).toContain("### Next Up");
      expect(summary).toContain("**auth.login**: User login functionality");
    });

    it("should show completion message when no next feature", () => {
      const summary = generateSessionSummary([], [], null);

      expect(summary).toContain("All tasks are complete!");
    });

    it("should handle empty completed list", () => {
      const summary = generateSessionSummary([], [], null);

      expect(summary).not.toContain("### Completed This Session");
    });

    it("should show full session with all sections", () => {
      const completed = [{ id: "auth.login", description: "Login" }];
      const remaining = [{ id: "auth.profile", priority: 2 }];
      const next = { id: "auth.register", description: "Registration" };

      const summary = generateSessionSummary(completed, remaining, next);

      expect(summary).toContain("### Completed This Session");
      expect(summary).toContain("### Remaining: 1 tasks");
      expect(summary).toContain("### Next Up");
    });
  });
});
