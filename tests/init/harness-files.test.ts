/**
 * Tests for init/harness-files.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  generateCapabilities,
  generateGitignore,
  generateInitScript,
  generateClaudeRules,
  generateProgressLog,
  showGitSuggestion,
  generateHarnessFiles,
} from "../../src/init/harness-files.js";
import type { InitContext } from "../../src/init/harness-files.js";

// Mock dependencies
vi.mock("node:fs/promises");
vi.mock("node:path", async () => {
  return {
    join: (...args: string[]) => args.join("/").replace(/\/+/g, "/"),
  };
});
vi.mock("../../src/capabilities/index.js", () => ({
  detectCapabilities: vi.fn(),
}));

vi.mock("../../src/gitignore/index.js", () => ({
  ensureComprehensiveGitignore: vi.fn(),
}));

vi.mock("../../src/init/init-script-merge.js", () => ({
  generateOrMergeInitScript: vi.fn(),
}));

vi.mock("../../src/rules/index.js", () => ({
  copyRulesToProject: vi.fn(),
  hasRulesInstalled: vi.fn(),
}));

vi.mock("../../src/prompts.js", () => ({
  generateMinimalClaudeMd: vi.fn(() => "# CLAUDE.md\n"),
}));

vi.mock("../../src/ui/index.js", () => ({
  createSpinner: vi.fn(() => ({
    start: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  })),
}));

vi.mock("../../src/progress-log.js", () => ({
  appendProgressLog: vi.fn(),
  createInitEntry: vi.fn(() => ({ type: "INIT", timestamp: "", message: "" })),
}));

vi.mock("../../src/debug.js", () => ({
  debugInit: vi.fn(),
}));

vi.mock("chalk", () => ({
  default: {
    green: vi.fn((text) => `green(${text})`),
    gray: vi.fn((text) => `gray(${text})`),
    yellow: vi.fn((text) => `yellow(${text})`),
    cyan: vi.fn((text) => `cyan(${text})`),
    white: vi.fn((text) => `white(${text})`),
  },
}));

describe("Harness Files Generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateCapabilities", () => {
    it("should detect and cache capabilities", async () => {
      const { detectCapabilities } = await import("../../src/capabilities/index.js");
      vi.mocked(detectCapabilities).mockResolvedValue({
        testCommand: "npm test",
      } as any);

      const ctx: InitContext = {
        cwd: "/test",
        goal: "test goal",
        mode: "new",
        survey: { commands: {} } as any,
        featureList: { features: {} } as any,
      };

      const result = await generateCapabilities(ctx);

      expect(result).toEqual({
        testCommand: "npm test",
      });
      expect(detectCapabilities).toHaveBeenCalledWith("/test", expect.objectContaining({ force: true, verbose: false }));
      expect(ctx.capabilities).toEqual({
        testCommand: "npm test",
      });
    });
  });

  describe("generateGitignore", () => {
    it("should ensure comprehensive gitignore exists", async () => {
      const { ensureComprehensiveGitignore } = await import("../../src/gitignore/index.js");
      vi.mocked(ensureComprehensiveGitignore).mockResolvedValue({
        action: "created",
        templates: ["node", "typescript"],
      });

      const ctx: InitContext = {
        cwd: "/test",
        goal: "test goal",
        mode: "new",
        survey: { commands: {} } as any,
        featureList: { features: {} } as any,
      };

      await generateGitignore(ctx);

      expect(ensureComprehensiveGitignore).toHaveBeenCalledWith("/test");
    });

    it("should log created action", async () => {
      const { ensureComprehensiveGitignore } = await import("../../src/gitignore/index.js");
      vi.mocked(ensureComprehensiveGitignore).mockResolvedValue({
        action: "created",
        templates: ["node"],
      });

      const ctx: InitContext = {
        cwd: "/test",
        goal: "test goal",
        mode: "new",
        survey: { commands: {} } as any,
        featureList: { features: {} } as any,
      };

      await generateGitignore(ctx);
    });
  });

  describe("generateInitScript", () => {
    it("should throw error if capabilities are not detected", async () => {
      const ctx: InitContext = {
        cwd: "/test",
        goal: "test goal",
        mode: "new",
        survey: { commands: {} } as any,
        featureList: { features: {} } as any,
      };

      await expect(generateInitScript(ctx)).rejects.toThrow(
        "Capabilities must be detected before generating init.sh"
      );
    });

    it("should call generateOrMergeInitScript", async () => {
      const { generateOrMergeInitScript } = await import("../../src/init/init-script-merge.js");
      vi.mocked(generateOrMergeInitScript).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));

      const ctx: InitContext = {
        cwd: "/test",
        goal: "test goal",
        mode: "new",
        survey: { commands: {} } as any,
        featureList: { features: {} } as any,
        capabilities: { testCommand: "npm test" } as any,
      };

      await generateInitScript(ctx);

      expect(generateOrMergeInitScript).toHaveBeenCalled();
      const args = vi.mocked(generateOrMergeInitScript).mock.calls[0];
      expect(args[0]).toBe("/test");
      expect(args[1]).toEqual({ testCommand: "npm test" });
      expect(args[2]).toEqual({ commands: {} });
      expect(args[3]).toBe("new");
      expect(args[4]).toBe("");
      expect(args[5]).toBe(false);
    });
  });

  describe("generateClaudeRules", () => {
    it("should setup rules with force in new mode", async () => {
      const { copyRulesToProject, hasRulesInstalled } = await import("../../src/rules/index.js");
      vi.mocked(hasRulesInstalled).mockReturnValue(false);
      vi.mocked(copyRulesToProject).mockResolvedValue({
        created: 5,
        skipped: 0,
      });

      vi.spyOn(fs, "readFile").mockRejectedValue(new Error("File not found"));
      vi.spyOn(fs, "writeFile").mockResolvedValue(undefined);

      const ctx: InitContext = {
        cwd: "/test",
        goal: "test goal",
        mode: "new",
        survey: { commands: {} } as any,
        featureList: { features: {} } as any,
      };

      await generateClaudeRules(ctx);

      expect(copyRulesToProject).toHaveBeenCalledWith("/test", { force: true });
    });

    it("should not force overwrite in merge mode", async () => {
      const { copyRulesToProject, hasRulesInstalled } = await import("../../src/rules/index.js");
      vi.mocked(hasRulesInstalled).mockReturnValue(true);
      vi.mocked(copyRulesToProject).mockResolvedValue({
        created: 0,
        skipped: 5,
      });

      vi.spyOn(fs, "readFile").mockRejectedValue(new Error("File not found"));
      vi.spyOn(fs, "writeFile").mockResolvedValue(undefined);

      const ctx: InitContext = {
        cwd: "/test",
        goal: "test goal",
        mode: "merge",
        survey: { commands: {} } as any,
        featureList: { features: {} } as any,
      };

      await generateClaudeRules(ctx);

      expect(copyRulesToProject).toHaveBeenCalledWith("/test", { force: false });
    });
  });

  describe("generateProgressLog", () => {
    it("should skip in scan mode", async () => {
      const { appendProgressLog } = await import("../../src/progress-log.js");
      vi.mocked(appendProgressLog).mockResolvedValue(undefined);

      const ctx: InitContext = {
        cwd: "/test",
        goal: "test goal",
        mode: "scan",
        survey: { commands: {} } as any,
        featureList: { features: {} } as any,
      };

      await generateProgressLog(ctx);

      expect(appendProgressLog).not.toHaveBeenCalled();
    });

    it("should append progress log in other modes", async () => {
      const { appendProgressLog, createInitEntry } = await import("../../src/progress-log.js");
      vi.mocked(appendProgressLog).mockResolvedValue(undefined);
      vi.mocked(createInitEntry).mockReturnValue({
        type: "INIT",
        timestamp: "",
        message: "",
      });

      const ctx: InitContext = {
        cwd: "/test",
        goal: "test goal",
        mode: "new",
        survey: { commands: {} } as any,
        featureList: { features: {} } as any,
      };

      await generateProgressLog(ctx);

      expect(appendProgressLog).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          type: "INIT",
        })
      );
    });
  });

  describe("showGitSuggestion", () => {
    it("should skip in scan mode", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const ctx: InitContext = {
        cwd: "/test",
        goal: "test goal",
        mode: "scan",
        survey: { commands: {} } as any,
        featureList: { features: {} } as any,
      };

      showGitSuggestion(ctx);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should show git suggestion in other modes", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const ctx: InitContext = {
        cwd: "/test",
        goal: "test goal",
        mode: "new",
        survey: { commands: {} } as any,
        featureList: { features: {} } as any,
      };

      showGitSuggestion(ctx);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Suggested git commit")
      );

      consoleSpy.mockRestore();
    });
  });

  describe("generateHarnessFiles", () => {
    it("should orchestrate all generation steps", async () => {
      const { detectCapabilities } = await import("../../src/capabilities/index.js");
      vi.mocked(detectCapabilities).mockResolvedValue({
        testCommand: "npm test",
      } as any);

      const { ensureComprehensiveGitignore } = await import("../../src/gitignore/index.js");
      vi.mocked(ensureComprehensiveGitignore).mockResolvedValue({
        action: "created",
        templates: ["node"],
      });

      const { generateOrMergeInitScript } = await import("../../src/init/init-script-merge.js");
      vi.mocked(generateOrMergeInitScript).mockResolvedValue(undefined);

      const { copyRulesToProject, hasRulesInstalled } = await import("../../src/rules/index.js");
      vi.mocked(hasRulesInstalled).mockReturnValue(false);
      vi.mocked(copyRulesToProject).mockResolvedValue({
        created: 5,
        skipped: 0,
      });

      vi.spyOn(fs, "readFile").mockRejectedValue(new Error("File not found"));
      vi.spyOn(fs, "writeFile").mockResolvedValue(undefined);

      const { appendProgressLog } = await import("../../src/progress-log.js");
      vi.mocked(appendProgressLog).mockResolvedValue(undefined);

      const survey = {
        commands: {
          install: "npm install",
          dev: "npm run dev",
        },
      };

      const featureList = {
        features: {
          "test.feature": {
            status: "failing",
            priority: 1,
            module: "test",
            description: "Test feature",
          },
        },
      };

      await generateHarnessFiles("/test", survey, featureList, "test goal", "new");

      expect(detectCapabilities).toHaveBeenCalled();
      expect(ensureComprehensiveGitignore).toHaveBeenCalledWith("/test");
      expect(generateOrMergeInitScript).toHaveBeenCalled();
      expect(copyRulesToProject).toHaveBeenCalled();
      expect(appendProgressLog).toHaveBeenCalled();
    });
  });
});
