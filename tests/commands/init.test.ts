/**
 * Unit tests for init.ts
 * Tests harness initialization command
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { runInit, runInitAnalyze, runInitScan } from "../../src/commands/init.js";

// Mock the features module
vi.mock("../../src/features/index.js", () => ({
  saveFeatureList: vi.fn(),
}));

// Mock the git-utils module
vi.mock("../../src/git-utils.js", () => ({
  isGitRepo: vi.fn(),
  gitInit: vi.fn(),
}));

// Mock the init module
vi.mock("../../src/init/index.js", () => ({
  detectAndAnalyzeProject: vi.fn(),
  mergeOrCreateFeatures: vi.fn(),
  generateHarnessFiles: vi.fn(),
}));

// Mock the scanner module (for runInitAnalyze)
vi.mock("../../src/scanner/index.js", () => ({
  aiScanProject: vi.fn(),
  aiResultToSurvey: vi.fn(),
  generateAISurveyMarkdown: vi.fn(),
}));

// Mock the project-scanner module
vi.mock("../../src/project-scanner.js", () => ({
  scanDirectoryStructure: vi.fn(),
}));

// Mock the agents module
vi.mock("../../src/agents.js", () => ({
  printAgentStatus: vi.fn(),
  getAgentPriorityString: vi.fn(() => "claude > codex > gemini"),
}));

// Mock the capabilities module (for runInitScan)
vi.mock("../../src/capabilities/index.js", () => ({
  detectCapabilities: vi.fn(),
  formatExtendedCapabilities: vi.fn(() => "Formatted capabilities output"),
}));

// Mock the progress module
vi.mock("../../src/progress.js", () => ({
  createSpinner: vi.fn(() => ({
    succeed: vi.fn(),
    fail: vi.fn(),
  })),
}));

// Mock readline before imports
const mockRl = {
  question: vi.fn(),
  close: vi.fn(),
};
vi.mock("node:readline", () => ({
  createInterface: vi.fn(() => mockRl),
}));

// Custom error for exit handling
class ExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.code = code;
    this.name = "ExitError";
  }
}

describe("commands/init", () => {
  describe("runInit()", () => {
    let tempDir: string;
    let originalCwd: string;
    let mockExit: ReturnType<typeof vi.spyOn>;
    let originalStdin: typeof process.stdin;

    beforeEach(async () => {
      const rawTempDir = await fs.mkdtemp(path.join(os.tmpdir(), "foreman-init-test-"));
      tempDir = fsSync.realpathSync(rawTempDir); // Resolve symlinks (macOS /var -> /private/var)
      originalCwd = process.cwd();
      process.chdir(tempDir);

      // Mock process.exit
      mockExit = vi.spyOn(process, "exit").mockImplementation(((code: number) => {
        throw new ExitError(code);
      }) as () => never);

      // Store original stdin
      originalStdin = process.stdin;
    });

    afterEach(async () => {
      process.chdir(originalCwd);
      await fs.rm(tempDir, { recursive: true, force: true });
      mockExit.mockRestore();
      vi.clearAllMocks();
    });

    it("should initialize git repo if not exists", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo, gitInit } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject } = await import("../../src/init/index.js");

      vi.mocked(isGitRepo).mockReturnValue(false);
      vi.mocked(gitInit).mockReturnValue({ success: true });
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: false,
        error: "Test error",
      });

      try {
        await runInit("Test project", "merge", false);
      } catch {
        // Expected exit
      }

      expect(gitInit).toHaveBeenCalledWith(tempDir);

      consoleSpy.mockRestore();
    });

    it("should show error when git init fails", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo, gitInit } = await import("../../src/git-utils.js");

      vi.mocked(isGitRepo).mockReturnValue(false);
      vi.mocked(gitInit).mockReturnValue({ success: false, error: "Git failed" });

      try {
        await runInit("Test project", "merge", false);
      } catch (e) {
        expect((e as ExitError).code).toBe(1);
      }

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Failed to initialize git");

      consoleSpy.mockRestore();
    });

    it("should show error when AI analysis fails", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject } = await import("../../src/init/index.js");

      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: false,
        error: "No AI agent available",
      });

      try {
        await runInit("Test project", "merge", false);
      } catch (e) {
        expect((e as ExitError).code).toBe(1);
      }

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("AI analysis failed");
      expect(allOutput).toContain("No AI agent available");

      consoleSpy.mockRestore();
    });

    it("should display mode and task-type info", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject } = await import("../../src/init/index.js");

      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: false,
        error: "Test",
      });

      try {
        await runInit("Test project", "new", false, "code");
      } catch {
        // Expected exit
      }

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("mode: new");
      expect(allOutput).toContain("task-type: code");

      consoleSpy.mockRestore();
    });

    it("should show verbose output when verbose is true", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject, mergeOrCreateFeatures, generateHarnessFiles } = await import("../../src/init/index.js");

      const mockSurvey = {
        features: [{ id: "test.feature" }, { id: "test.other" }],
      };

      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: true,
        survey: mockSurvey,
        agentUsed: "claude",
      });
      vi.mocked(mergeOrCreateFeatures).mockResolvedValue({
        features: [],
        metadata: {} as any,
      });
      vi.mocked(generateHarnessFiles).mockResolvedValue();

      // For scan mode, TDD prompt is skipped
      await runInit("Test project", "scan", true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Found 2 features");

      consoleSpy.mockRestore();
    });

    it("should apply taskType to all features when specified", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject, mergeOrCreateFeatures, generateHarnessFiles } = await import("../../src/init/index.js");
      const { saveFeatureList } = await import("../../src/features/index.js");

      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: true,
        survey: { features: [] },
        agentUsed: "gemini",
      });
      vi.mocked(mergeOrCreateFeatures).mockResolvedValue({
        features: [
          { id: "a", taskType: undefined },
          { id: "b", taskType: undefined },
        ],
        metadata: {} as any,
      });
      vi.mocked(generateHarnessFiles).mockResolvedValue();

      // For scan mode, TDD prompt is skipped
      await runInit("Test project", "scan", false, "ops");

      expect(saveFeatureList).toHaveBeenCalled();
      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain('Applied task-type "ops"');

      consoleSpy.mockRestore();
    });

    it("should show success message on completion", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject, mergeOrCreateFeatures, generateHarnessFiles } = await import("../../src/init/index.js");

      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: true,
        survey: { features: [] },
        agentUsed: "codex",
      });
      vi.mocked(mergeOrCreateFeatures).mockResolvedValue({
        features: [],
        metadata: {} as any,
      });
      vi.mocked(generateHarnessFiles).mockResolvedValue();

      // For scan mode, TDD prompt is skipped
      await runInit("Test project", "scan", false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Harness initialized successfully");
      expect(allOutput).toContain("agent-foreman next");

      consoleSpy.mockRestore();
    });

    it("should skip TDD prompt in scan mode", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject, mergeOrCreateFeatures, generateHarnessFiles } = await import("../../src/init/index.js");

      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: true,
        survey: { features: [] },
        agentUsed: "claude",
      });
      vi.mocked(mergeOrCreateFeatures).mockResolvedValue({
        features: [],
        metadata: {} as any,
      });
      vi.mocked(generateHarnessFiles).mockResolvedValue();

      await runInit("Test project", "scan", false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      // Should NOT show TDD prompt in scan mode
      expect(allOutput).not.toContain("TDD Mode Configuration");
      expect(allOutput).toContain("Harness initialized successfully");

      consoleSpy.mockRestore();
    });

    it("should display AI agent used in success message", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject, mergeOrCreateFeatures, generateHarnessFiles } = await import("../../src/init/index.js");

      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: true,
        survey: { features: [] },
        agentUsed: "gemini",
      });
      vi.mocked(mergeOrCreateFeatures).mockResolvedValue({
        features: [],
        metadata: {} as any,
      });
      vi.mocked(generateHarnessFiles).mockResolvedValue();

      await runInit("Test project", "scan", false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("agent: gemini");

      consoleSpy.mockRestore();
    });

    it("should skip git repo check when already a git repo", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo, gitInit } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject, mergeOrCreateFeatures, generateHarnessFiles } = await import("../../src/init/index.js");

      vi.mocked(isGitRepo).mockReturnValue(true); // Already a git repo
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: true,
        survey: { features: [] },
        agentUsed: "claude",
      });
      vi.mocked(mergeOrCreateFeatures).mockResolvedValue({
        features: [],
        metadata: {} as any,
      });
      vi.mocked(generateHarnessFiles).mockResolvedValue();

      await runInit("Test project", "scan", false);

      // gitInit should NOT be called when already a git repo
      expect(gitInit).not.toHaveBeenCalled();

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).not.toContain("Not a git repository");
      expect(allOutput).toContain("Harness initialized successfully");

      consoleSpy.mockRestore();
    });

    it("should initialize git and show success message", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo, gitInit } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject, mergeOrCreateFeatures, generateHarnessFiles } = await import("../../src/init/index.js");

      vi.mocked(isGitRepo).mockReturnValue(false);
      vi.mocked(gitInit).mockReturnValue({ success: true });
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: true,
        survey: { features: [] },
        agentUsed: "claude",
      });
      vi.mocked(mergeOrCreateFeatures).mockResolvedValue({
        features: [],
        metadata: {} as any,
      });
      vi.mocked(generateHarnessFiles).mockResolvedValue();

      await runInit("Test project", "scan", false);

      expect(gitInit).toHaveBeenCalled();

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Git repository initialized");
      expect(allOutput).toContain("Harness initialized successfully");

      consoleSpy.mockRestore();
    });

    it("should not apply taskType when not specified", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject, mergeOrCreateFeatures, generateHarnessFiles } = await import("../../src/init/index.js");
      const { saveFeatureList } = await import("../../src/features/index.js");

      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: true,
        survey: { features: [] },
        agentUsed: "claude",
      });
      vi.mocked(mergeOrCreateFeatures).mockResolvedValue({
        features: [{ id: "a" }, { id: "b" }],
        metadata: {} as any,
      });
      vi.mocked(generateHarnessFiles).mockResolvedValue();

      await runInit("Test project", "scan", false); // No taskType

      // saveFeatureList should NOT be called for taskType since none specified
      expect(saveFeatureList).not.toHaveBeenCalled();

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).not.toContain("Applied task-type");

      consoleSpy.mockRestore();
    });

    it("should handle undefined survey in analysis result", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject } = await import("../../src/init/index.js");

      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: true,
        survey: undefined, // Survey is undefined
        agentUsed: "claude",
      });

      try {
        await runInit("Test project", "merge", false);
      } catch (e) {
        expect((e as ExitError).code).toBe(1);
      }

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("AI analysis failed");

      consoleSpy.mockRestore();
    });

    it("should prompt for TDD mode in merge mode and handle strict selection", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject, mergeOrCreateFeatures, generateHarnessFiles } = await import("../../src/init/index.js");

      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: true,
        survey: { features: [] },
        agentUsed: "claude",
      });
      vi.mocked(mergeOrCreateFeatures).mockResolvedValue({
        features: [],
        metadata: {} as any,
      });
      vi.mocked(generateHarnessFiles).mockResolvedValue();

      // Mock readline to immediately call callback with "1" (strict)
      mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
        callback("1");
      });

      await runInit("Test project", "merge", false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("TDD Mode Configuration");
      expect(allOutput).toContain("Strict TDD mode enabled");
      expect(allOutput).toContain("STRICT TDD MODE ENABLED");
      expect(allOutput).toContain("Write tests BEFORE implementation");
      expect(allOutput).toContain("Harness initialized successfully");

      consoleSpy.mockRestore();
    });

    it("should prompt for TDD mode in new mode and handle recommended selection", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject, mergeOrCreateFeatures, generateHarnessFiles } = await import("../../src/init/index.js");

      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: true,
        survey: { features: [] },
        agentUsed: "claude",
      });
      vi.mocked(mergeOrCreateFeatures).mockResolvedValue({
        features: [],
        metadata: {} as any,
      });
      vi.mocked(generateHarnessFiles).mockResolvedValue();

      // Mock readline to immediately call callback with "2" (recommended)
      mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
        callback("2");
      });

      await runInit("Test project", "new", false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("TDD Mode Configuration");
      expect(allOutput).toContain("recommended mode");
      // Should NOT show strict TDD warning
      expect(allOutput).not.toContain("STRICT TDD MODE ENABLED");
      expect(allOutput).toContain("Harness initialized successfully");

      consoleSpy.mockRestore();
    });

    it("should handle TDD mode disabled selection", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject, mergeOrCreateFeatures, generateHarnessFiles } = await import("../../src/init/index.js");

      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: true,
        survey: { features: [] },
        agentUsed: "claude",
      });
      vi.mocked(mergeOrCreateFeatures).mockResolvedValue({
        features: [],
        metadata: {} as any,
      });
      vi.mocked(generateHarnessFiles).mockResolvedValue();

      // Mock readline to immediately call callback with "3" (disabled)
      mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
        callback("3");
      });

      await runInit("Test project", "new", false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("TDD mode disabled");
      expect(allOutput).not.toContain("STRICT TDD MODE ENABLED");

      consoleSpy.mockRestore();
    });

    it("should handle empty TDD mode selection (default)", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject, mergeOrCreateFeatures, generateHarnessFiles } = await import("../../src/init/index.js");

      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: true,
        survey: { features: [] },
        agentUsed: "claude",
      });
      vi.mocked(mergeOrCreateFeatures).mockResolvedValue({
        features: [],
        metadata: {} as any,
      });
      vi.mocked(generateHarnessFiles).mockResolvedValue();

      // Mock readline to immediately call callback with "" (empty, default)
      mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
        callback("");
      });

      await runInit("Test project", "new", false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("recommended mode");

      consoleSpy.mockRestore();
    });

    it("should handle TDD mode text inputs (strict, recommended, disabled, none)", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject, mergeOrCreateFeatures, generateHarnessFiles } = await import("../../src/init/index.js");

      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: true,
        survey: { features: [] },
        agentUsed: "claude",
      });
      vi.mocked(mergeOrCreateFeatures).mockResolvedValue({
        features: [],
        metadata: {} as any,
      });
      vi.mocked(generateHarnessFiles).mockResolvedValue();

      // Test "strict" text input
      mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
        callback("strict");
      });

      await runInit("Test project", "new", false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Strict TDD mode enabled");

      consoleSpy.mockRestore();
    });

    it("should handle TDD mode 'none' text input", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject, mergeOrCreateFeatures, generateHarnessFiles } = await import("../../src/init/index.js");

      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: true,
        survey: { features: [] },
        agentUsed: "claude",
      });
      vi.mocked(mergeOrCreateFeatures).mockResolvedValue({
        features: [],
        metadata: {} as any,
      });
      vi.mocked(generateHarnessFiles).mockResolvedValue();

      mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
        callback("none");
      });

      await runInit("Test project", "new", false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("TDD mode disabled");

      consoleSpy.mockRestore();
    });

    it("should handle TDD mode 'recommended' text input", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject, mergeOrCreateFeatures, generateHarnessFiles } = await import("../../src/init/index.js");

      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: true,
        survey: { features: [] },
        agentUsed: "claude",
      });
      vi.mocked(mergeOrCreateFeatures).mockResolvedValue({
        features: [],
        metadata: {} as any,
      });
      vi.mocked(generateHarnessFiles).mockResolvedValue();

      mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
        callback("recommended");
      });

      await runInit("Test project", "new", false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("recommended mode");

      consoleSpy.mockRestore();
    });

    it("should handle TDD mode 'disabled' text input", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { isGitRepo } = await import("../../src/git-utils.js");
      const { detectAndAnalyzeProject, mergeOrCreateFeatures, generateHarnessFiles } = await import("../../src/init/index.js");

      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(detectAndAnalyzeProject).mockResolvedValue({
        success: true,
        survey: { features: [] },
        agentUsed: "claude",
      });
      vi.mocked(mergeOrCreateFeatures).mockResolvedValue({
        features: [],
        metadata: {} as any,
      });
      vi.mocked(generateHarnessFiles).mockResolvedValue();

      mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
        callback("disabled");
      });

      await runInit("Test project", "new", false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("TDD mode disabled");

      consoleSpy.mockRestore();
    });

    describe("InitOptions - analyzeOnly", () => {
      it("should delegate to runInitAnalyze when analyzeOnly is true", async () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const { aiScanProject, aiResultToSurvey, generateAISurveyMarkdown } = await import("../../src/scanner/index.js");
        const { scanDirectoryStructure } = await import("../../src/project-scanner.js");

        vi.mocked(aiScanProject).mockResolvedValue({
          success: true,
          agentUsed: "claude",
          summary: "Test project summary",
        });
        vi.mocked(scanDirectoryStructure).mockResolvedValue({
          entryPoints: [],
          srcDirs: [],
          testDirs: [],
          configFiles: [],
        });
        vi.mocked(aiResultToSurvey).mockReturnValue({
          techStack: { language: "TypeScript", framework: "Node.js" },
          modules: [{ name: "core" }],
          features: [{ id: "test.feature" }],
          completion: { overall: 80 },
        });
        vi.mocked(generateAISurveyMarkdown).mockReturnValue("# Test Markdown");

        await runInit("", "merge", false, undefined, { analyzeOnly: true });

        expect(aiScanProject).toHaveBeenCalled();
        const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(allOutput).toContain("AI-powered project analysis");
        expect(allOutput).toContain("Analysis written to");

        consoleSpy.mockRestore();
      });
    });

    describe("InitOptions - scanOnly", () => {
      it("should delegate to runInitScan when scanOnly is true", async () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const { detectCapabilities, formatExtendedCapabilities } = await import("../../src/capabilities/index.js");

        vi.mocked(detectCapabilities).mockResolvedValue({
          detectedAt: new Date().toISOString(),
          source: "ai-discovered",
        });
        vi.mocked(formatExtendedCapabilities).mockReturnValue("Test capabilities");

        await runInit("", "merge", false, undefined, { scanOnly: true });

        expect(detectCapabilities).toHaveBeenCalled();
        const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(allOutput).toContain("Detecting project verification capabilities");

        consoleSpy.mockRestore();
      });
    });
  });

  describe("runInitAnalyze()", () => {
    let tempDir: string;
    let originalCwd: string;
    let mockExit: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      const rawTempDir = await fs.mkdtemp(path.join(os.tmpdir(), "foreman-analyze-test-"));
      tempDir = fsSync.realpathSync(rawTempDir);
      originalCwd = process.cwd();
      process.chdir(tempDir);

      mockExit = vi.spyOn(process, "exit").mockImplementation(((code: number) => {
        throw new ExitError(code);
      }) as () => never);
    });

    afterEach(async () => {
      process.chdir(originalCwd);
      await fs.rm(tempDir, { recursive: true, force: true });
      mockExit.mockRestore();
      vi.clearAllMocks();
    });

    it("should generate ARCHITECTURE.md successfully", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { aiScanProject, aiResultToSurvey, generateAISurveyMarkdown } = await import("../../src/scanner/index.js");
      const { scanDirectoryStructure } = await import("../../src/project-scanner.js");

      vi.mocked(aiScanProject).mockResolvedValue({
        success: true,
        agentUsed: "claude",
        summary: "A TypeScript CLI tool",
        recommendations: ["Add more tests", "Improve docs"],
      });
      vi.mocked(scanDirectoryStructure).mockResolvedValue({
        entryPoints: ["src/index.ts"],
        srcDirs: ["src"],
        testDirs: ["tests"],
        configFiles: ["package.json"],
      });
      vi.mocked(aiResultToSurvey).mockReturnValue({
        techStack: { language: "TypeScript", framework: "Node.js" },
        modules: [{ name: "core" }, { name: "utils" }],
        features: [{ id: "test.a" }, { id: "test.b" }],
        completion: { overall: 75 },
      });
      vi.mocked(generateAISurveyMarkdown).mockReturnValue("# Architecture\n\nGenerated content");

      await runInitAnalyze("docs/ARCHITECTURE.md", false);

      expect(aiScanProject).toHaveBeenCalled();
      expect(aiResultToSurvey).toHaveBeenCalled();
      expect(generateAISurveyMarkdown).toHaveBeenCalled();

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("AI-powered project analysis");
      expect(allOutput).toContain("AI analysis successful");
      expect(allOutput).toContain("agent: claude");
      expect(allOutput).toContain("Analysis written to docs/ARCHITECTURE.md");
      expect(allOutput).toContain("TypeScript/Node.js");
      expect(allOutput).toContain("Modules: 2");
      expect(allOutput).toContain("Features: 2");
      expect(allOutput).toContain("Completion: 75%");
      expect(allOutput).toContain("Summary:");
      expect(allOutput).toContain("A TypeScript CLI tool");
      expect(allOutput).toContain("Recommendations:");

      consoleSpy.mockRestore();
    });

    it("should exit with error when AI analysis fails", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { aiScanProject } = await import("../../src/scanner/index.js");

      vi.mocked(aiScanProject).mockResolvedValue({
        success: false,
        error: "No AI agent available",
      });

      try {
        await runInitAnalyze("docs/ARCHITECTURE.md", false);
      } catch (e) {
        expect((e as ExitError).code).toBe(1);
      }

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("AI analysis failed");
      expect(allOutput).toContain("gemini, codex, or claude CLI is installed");

      consoleSpy.mockRestore();
    });

    it("should show agent status when verbose is true", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { aiScanProject, aiResultToSurvey, generateAISurveyMarkdown } = await import("../../src/scanner/index.js");
      const { scanDirectoryStructure } = await import("../../src/project-scanner.js");
      const { printAgentStatus } = await import("../../src/agents.js");

      vi.mocked(aiScanProject).mockResolvedValue({
        success: true,
        agentUsed: "gemini",
      });
      vi.mocked(scanDirectoryStructure).mockResolvedValue({
        entryPoints: [],
        srcDirs: [],
        testDirs: [],
        configFiles: [],
      });
      vi.mocked(aiResultToSurvey).mockReturnValue({
        techStack: { language: "Python", framework: "Flask" },
        modules: [],
        features: [],
        completion: { overall: 50 },
      });
      vi.mocked(generateAISurveyMarkdown).mockReturnValue("# Test");

      await runInitAnalyze("docs/ARCHITECTURE.md", true);

      expect(printAgentStatus).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("runInitScan()", () => {
    let tempDir: string;
    let originalCwd: string;
    let mockExit: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      const rawTempDir = await fs.mkdtemp(path.join(os.tmpdir(), "foreman-scan-test-"));
      tempDir = fsSync.realpathSync(rawTempDir);
      originalCwd = process.cwd();
      process.chdir(tempDir);

      mockExit = vi.spyOn(process, "exit").mockImplementation(((code: number) => {
        throw new ExitError(code);
      }) as () => never);
    });

    afterEach(async () => {
      process.chdir(originalCwd);
      await fs.rm(tempDir, { recursive: true, force: true });
      mockExit.mockRestore();
      vi.clearAllMocks();
    });

    it("should detect capabilities successfully", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { detectCapabilities, formatExtendedCapabilities } = await import("../../src/capabilities/index.js");

      vi.mocked(detectCapabilities).mockResolvedValue({
        detectedAt: "2025-01-01T00:00:00Z",
        source: "ai-discovered",
        customRules: [],
      });
      vi.mocked(formatExtendedCapabilities).mockReturnValue("Capabilities: vitest, eslint, tsc");

      await runInitScan(false, false);

      expect(detectCapabilities).toHaveBeenCalledWith(tempDir, { force: false, verbose: false });

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Detecting project verification capabilities");
      expect(allOutput).toContain("Capabilities: vitest, eslint, tsc");
      expect(allOutput).toContain("Detected at: 2025-01-01T00:00:00Z");
      expect(allOutput).toContain("Cache: ai/capabilities.json");

      consoleSpy.mockRestore();
    });

    it("should show force message when force is true", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { detectCapabilities } = await import("../../src/capabilities/index.js");

      vi.mocked(detectCapabilities).mockResolvedValue({
        detectedAt: "2025-01-01T00:00:00Z",
        source: "ai-discovered",
      });

      await runInitScan(true, false);

      expect(detectCapabilities).toHaveBeenCalledWith(tempDir, { force: true, verbose: false });

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("forcing re-detection, ignoring cache");

      consoleSpy.mockRestore();
    });

    it("should display custom rules when present", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { detectCapabilities } = await import("../../src/capabilities/index.js");

      vi.mocked(detectCapabilities).mockResolvedValue({
        detectedAt: "2025-01-01T00:00:00Z",
        source: "ai-discovered",
        customRules: [
          { id: "integration-test", description: "Run integration tests", command: "npm run test:integration" },
        ],
      });

      await runInitScan(false, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Custom Rules:");
      expect(allOutput).toContain("integration-test");
      expect(allOutput).toContain("Run integration tests");
      expect(allOutput).toContain("npm run test:integration");

      consoleSpy.mockRestore();
    });

    it("should exit with error when detection fails", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { detectCapabilities } = await import("../../src/capabilities/index.js");

      vi.mocked(detectCapabilities).mockRejectedValue(new Error("Detection failed"));

      try {
        await runInitScan(false, false);
      } catch (e) {
        expect((e as ExitError).code).toBe(1);
      }

      consoleSpy.mockRestore();
    });
  });
});
