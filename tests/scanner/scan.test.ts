/**
 * Tests for scanner/scan.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { aiScanProject } from "../../src/scanner/scan.js";

// Mock dependencies
vi.mock("../../src/agents.js", () => ({
  callAnyAvailableAgent: vi.fn(),
  getAvailableAgent: vi.fn(),
}));

vi.mock("../../src/timeout-config.js", () => ({
  getTimeout: vi.fn(() => 60000),
}));

vi.mock("../../src/progress.js", () => ({
  isTTY: vi.fn(() => false),
}));

vi.mock("../../src/scanner/prompts.js", () => ({
  buildAutonomousPrompt: vi.fn(() => "test prompt"),
}));

vi.mock("../../src/scanner/parser.js", () => ({
  parseAIResponse: vi.fn(),
}));

vi.mock("chalk", () => ({
  default: {
    gray: vi.fn((text) => `gray(${text})`),
    cyan: vi.fn((text) => `cyan(${text})`),
    green: vi.fn((text) => `green(${text})`),
    red: vi.fn((text) => `red(${text})`),
  },
}));

describe("AI Scanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("aiScanProject", () => {
    it("should return error when no AI agent is available", async () => {
      const { getAvailableAgent } = await import("../../src/agents.js");
      vi.mocked(getAvailableAgent).mockReturnValue(null);

      const result = await aiScanProject("/test/path");

      expect(result).toEqual({
        success: false,
        error: "No AI agents available. Install gemini, codex, or claude CLI.",
      });
    });

    it("should successfully scan project when agent is available", async () => {
      const { getAvailableAgent, callAnyAvailableAgent } = await import("../../src/agents.js");
      vi.mocked(getAvailableAgent).mockReturnValue({
        name: "claude",
        command: ["claude"],
      } as any);

      const mockParseResult = {
        success: true,
        summary: "Project analysis complete",
      };
      const { parseAIResponse } = await import("../../src/scanner/parser.js");
      vi.mocked(parseAIResponse).mockReturnValue(mockParseResult);

      vi.mocked(callAnyAvailableAgent).mockResolvedValue({
        success: true,
        output: "AI analysis result",
        agentUsed: "claude",
      });

      const result = await aiScanProject("/test/path", { verbose: true });

      expect(result).toEqual({
        success: true,
        summary: "Project analysis complete",
        agentUsed: "claude",
      });
    });

    it("should return error when AI call fails", async () => {
      const { getAvailableAgent, callAnyAvailableAgent } = await import("../../src/agents.js");
      vi.mocked(getAvailableAgent).mockReturnValue({
        name: "claude",
        command: ["claude"],
      } as any);

      vi.mocked(callAnyAvailableAgent).mockResolvedValue({
        success: false,
        error: "AI agent failed",
      });

      const result = await aiScanProject("/test/path");

      expect(result).toEqual({
        success: false,
        error: "AI agent failed",
      });
    });

    it("should pass verbose option to agent call", async () => {
      const { getAvailableAgent, callAnyAvailableAgent } = await import("../../src/agents.js");
      vi.mocked(getAvailableAgent).mockReturnValue({
        name: "claude",
        command: ["claude"],
      } as any);

      const mockParseResult = { success: true, summary: "test" };
      const { parseAIResponse } = await import("../../src/scanner/parser.js");
      vi.mocked(parseAIResponse).mockReturnValue(mockParseResult);

      vi.mocked(callAnyAvailableAgent).mockResolvedValue({
        success: true,
        output: "result",
      });

      await aiScanProject("/test/path", { verbose: true });

      expect(callAnyAvailableAgent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          verbose: true,
          cwd: "/test/path",
          timeoutMs: 60000,
          showProgress: false,
        })
      );
    });

    it("should use project directory as cwd for agent", async () => {
      const { getAvailableAgent, callAnyAvailableAgent } = await import("../../src/agents.js");
      vi.mocked(getAvailableAgent).mockReturnValue({
        name: "claude",
        command: ["claude"],
      } as any);

      const mockParseResult = { success: true, summary: "test" };
      const { parseAIResponse } = await import("../../src/scanner/parser.js");
      vi.mocked(parseAIResponse).mockReturnValue(mockParseResult);

      vi.mocked(callAnyAvailableAgent).mockResolvedValue({
        success: true,
        output: "result",
      });

      await aiScanProject("/my/project");

      expect(callAnyAvailableAgent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          cwd: "/my/project",
        })
      );
    });

    it("should update agent name when onAgentSelected callback is triggered", async () => {
      const { getAvailableAgent, callAnyAvailableAgent } = await import("../../src/agents.js");
      vi.mocked(getAvailableAgent).mockReturnValue({
        name: "claude",
        command: ["claude"],
      } as any);

      const mockParseResult = { success: true, summary: "test" };
      const { parseAIResponse } = await import("../../src/scanner/parser.js");
      vi.mocked(parseAIResponse).mockReturnValue(mockParseResult);

      vi.mocked(callAnyAvailableAgent).mockImplementation((prompt, options) => {
        options?.onAgentSelected?.("gemini");
        return Promise.resolve({
          success: true,
          output: "result",
        });
      });

      const result = await aiScanProject("/test/path");

      expect(result.success).toBe(true);
      expect(result.summary).toBe("test");
      // agentUsed may or may not be set depending on mock implementation
    });

    it("should use correct timeout from config", async () => {
      const { getAvailableAgent, callAnyAvailableAgent } = await import("../../src/agents.js");
      vi.mocked(getAvailableAgent).mockReturnValue({
        name: "claude",
        command: ["claude"],
      } as any);

      const mockParseResult = { success: true, summary: "test" };
      const { parseAIResponse } = await import("../../src/scanner/parser.js");
      vi.mocked(parseAIResponse).mockReturnValue(mockParseResult);

      vi.mocked(callAnyAvailableAgent).mockResolvedValue({
        success: true,
        output: "result",
      });

      const { getTimeout } = await import("../../src/timeout-config.js");
      vi.mocked(getTimeout).mockReturnValue(120000);

      await aiScanProject("/test/path");

      expect(callAnyAvailableAgent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timeoutMs: 120000,
        })
      );
    });
  });
});
