/**
 * Unit tests for done-helpers.ts
 * Tests display helper functions and survey regeneration
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import {
  displayTestFileHeader,
  displayVerificationHeader,
  displayCommitSuggestion,
  regenerateSurvey,
} from "../../src/commands/done-helpers.js";
import type { Feature, FeatureList } from "../../src/types/index.js";

// Import the mock to control it in tests
import { aiScanProject } from "../../src/scanner/scan.js";
import { aiResultToSurvey, generateAISurveyMarkdown } from "../../src/scanner/survey.js";
import { scanDirectoryStructure } from "../../src/project-scanner.js";

// Mock the AI scanner module to prevent actual AI calls
vi.mock("../../src/scanner/scan.js", () => ({
  aiScanProject: vi.fn(),
}));

vi.mock("../../src/scanner/survey.js", () => ({
  aiResultToSurvey: vi.fn(),
  generateAISurveyMarkdown: vi.fn(),
}));

vi.mock("../../src/project-scanner.js", () => ({
  scanDirectoryStructure: vi.fn(),
}));

describe("done-helpers", () => {
  describe("displayTestFileHeader()", () => {
    it("should output test file verification header", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      displayTestFileHeader();

      expect(consoleSpy).toHaveBeenCalled();
      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("TEST FILE VERIFICATION");

      consoleSpy.mockRestore();
    });
  });

  describe("displayVerificationHeader()", () => {
    const mockFeature: Feature = {
      id: "test.feature",
      description: "Test feature description",
      module: "test",
      priority: 1,
      status: "failing",
      acceptance: ["Criterion 1", "Criterion 2", "Criterion 3"],
      version: 1,
      origin: "manual",
    };

    it("should display task information", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      displayVerificationHeader(mockFeature, false, "full");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("TASK VERIFICATION");
      expect(allOutput).toContain("test.feature");
      expect(allOutput).toContain("Module: test");
      expect(allOutput).toContain("Priority: 1");

      consoleSpy.mockRestore();
    });

    it("should display acceptance criteria", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      displayVerificationHeader(mockFeature, false, "full");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Acceptance Criteria");
      expect(allOutput).toContain("Criterion 1");
      expect(allOutput).toContain("Criterion 2");
      expect(allOutput).toContain("Criterion 3");

      consoleSpy.mockRestore();
    });

    it("should show AI mode indicator when enabled", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      displayVerificationHeader(mockFeature, true, "full");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("AI autonomous exploration");

      consoleSpy.mockRestore();
    });

    it("should not show AI mode indicator when disabled", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      displayVerificationHeader(mockFeature, false, "full");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).not.toContain("AI autonomous exploration");

      consoleSpy.mockRestore();
    });

    it("should show quick test mode indicator", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      displayVerificationHeader(mockFeature, false, "quick");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Quick (selective tests)");

      consoleSpy.mockRestore();
    });

    it("should not show test mode indicator for full mode", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      displayVerificationHeader(mockFeature, false, "full");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).not.toContain("Quick");
      expect(allOutput).not.toContain("selective tests");

      consoleSpy.mockRestore();
    });

    it("should show both AI and quick mode when both enabled", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      displayVerificationHeader(mockFeature, true, "quick");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("AI autonomous exploration");
      expect(allOutput).toContain("Quick (selective tests)");

      consoleSpy.mockRestore();
    });
  });

  describe("displayCommitSuggestion()", () => {
    it("should display commit suggestion with module and description", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      displayCommitSuggestion("auth", "Add login functionality");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Suggested commit");
      expect(allOutput).toContain("feat(auth):");
      expect(allOutput).toContain("Add login functionality");

      consoleSpy.mockRestore();
    });

    it("should truncate long descriptions to 50 characters", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const longDescription =
        "This is a very long description that exceeds the fifty character limit";
      displayCommitSuggestion("module", longDescription);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("...");
      expect(allOutput).not.toContain("character limit");

      consoleSpy.mockRestore();
    });

    it("should not truncate descriptions at exactly 50 characters", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const exactDescription = "A".repeat(50);
      displayCommitSuggestion("module", exactDescription);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).not.toContain("...");
      expect(allOutput).toContain("A".repeat(50));

      consoleSpy.mockRestore();
    });

    it("should truncate descriptions longer than 50 characters", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const longDescription = "B".repeat(51);
      displayCommitSuggestion("module", longDescription);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("...");
      expect(allOutput).toContain("B".repeat(47));

      consoleSpy.mockRestore();
    });
  });

  describe("regenerateSurvey()", () => {
    let tempDir: string;
    const mockAiScanProject = vi.mocked(aiScanProject);
    const mockAiResultToSurvey = vi.mocked(aiResultToSurvey);
    const mockGenerateAISurveyMarkdown = vi.mocked(generateAISurveyMarkdown);
    const mockScanDirectoryStructure = vi.mocked(scanDirectoryStructure);

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "foreman-test-"));
      vi.clearAllMocks();
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("should handle AI unavailable gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      mockAiScanProject.mockResolvedValue({
        success: false,
        error: "AI unavailable in test",
      });

      const featureList: FeatureList = {
        features: [
          {
            id: "test.feature",
            description: "Test",
            module: "test",
            priority: 1,
            status: "passing",
            acceptance: ["Test acceptance"],
            version: 1,
            origin: "manual",
          },
        ],
        metadata: {
          projectGoal: "Test project",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: "1.0.0",
        },
      };

      // This should not throw, just log a warning
      await regenerateSurvey(tempDir, featureList);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      // Should either succeed or show unavailable message
      expect(
        allOutput.includes("Regenerating project survey") ||
          allOutput.includes("Could not regenerate")
      ).toBe(true);

      consoleSpy.mockRestore();
    });

    it("should generate survey when AI scan succeeds", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      mockAiScanProject.mockResolvedValue({
        success: true,
        raw: "Project analysis...",
        overview: {
          projectName: "Test Project",
          description: "Test description",
          primaryLanguage: "TypeScript",
        },
        agentUsed: "claude",
      });

      mockScanDirectoryStructure.mockResolvedValue({
        root: tempDir,
        totalFiles: 10,
        totalDirectories: 5,
        tree: [],
      });

      mockAiResultToSurvey.mockReturnValue({
        projectName: "Test Project",
        description: "Test description",
        modules: [{ name: "test", path: "src/test", files: [] }],
        features: [],
        completion: { overall: 50, byModule: {}, notes: [] },
        capabilities: [],
        metadata: {
          createdAt: new Date().toISOString(),
          source: "ai",
        },
      });

      mockGenerateAISurveyMarkdown.mockReturnValue("# Test Survey Markdown");

      const featureList: FeatureList = {
        features: [
          {
            id: "test.feature",
            description: "Test feature",
            module: "test",
            priority: 1,
            status: "passing",
            acceptance: ["Test acceptance"],
            version: 1,
            origin: "manual",
          },
          {
            id: "test.feature2",
            description: "Test feature 2",
            module: "test",
            priority: 2,
            status: "failing",
            acceptance: ["Another test"],
            version: 1,
            origin: "manual",
          },
        ],
        metadata: {
          projectGoal: "Test project",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: "1.0.0",
        },
      };

      await regenerateSurvey(tempDir, featureList);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Regenerating project survey");
      expect(allOutput).toContain("Updated docs/ARCHITECTURE.md");

      // Verify file was created
      const surveyPath = path.join(tempDir, "docs/ARCHITECTURE.md");
      const content = await fs.readFile(surveyPath, "utf-8");
      expect(content).toBe("# Test Survey Markdown");

      consoleSpy.mockRestore();
    });

    it("should catch exceptions and show warning", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      mockAiScanProject.mockRejectedValue(new Error("Network error"));

      const featureList: FeatureList = {
        features: [],
        metadata: {
          projectGoal: "Test",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: "1.0.0",
        },
      };

      await regenerateSurvey(tempDir, featureList);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Could not regenerate survey");

      consoleSpy.mockRestore();
    });
  });
});
