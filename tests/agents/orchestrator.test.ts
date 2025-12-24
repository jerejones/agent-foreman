/**
 * Tests for agents/orchestrator.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callAnyAvailableAgent, printAgentStatus, getAgentPriorityString } from "../../src/agents/orchestrator.js";
import { DEFAULT_AGENTS } from "../../src/agents/config.js";
import { getAgentPriority } from "../../src/timeout-config.js";

// Mock dependencies
vi.mock("../../src/progress.js", () => ({
  isTTY: vi.fn(() => false),
}));

vi.mock("../../src/timeout-config.js", () => ({
  getAgentPriority: vi.fn(() => ["claude", "codex", "gemini"]),
}));

vi.mock("../../src/agents/detection.js", () => ({
  commandExists: vi.fn().mockReturnValue(false),
  checkAvailableAgents: vi.fn(() => [
    { name: "claude", available: true },
    { name: "codex", available: false },
    { name: "gemini", available: true },
  ]),
}));

vi.mock("../../src/agents/executor.js", () => ({
  callAgent: vi.fn(),
}));

vi.mock("chalk", () => ({
  default: {
    gray: vi.fn((text) => `gray(${text})`),
    blue: vi.fn((text) => `blue(${text})`),
    cyan: vi.fn((text) => `cyan(${text})`),
    green: vi.fn((text) => `green(${text})`),
    red: vi.fn((text) => `red(${text})`),
    yellow: vi.fn((text) => `yellow(${text})`),
    bold: vi.fn((text) => `bold(${text})`),
  },
}));

describe("Agent Orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("callAnyAvailableAgent", () => {
    it("should skip AI calls when SKIP_AI_GUIDANCE is set", async () => {
      process.env.SKIP_AI_GUIDANCE = "true";

      const result = await callAnyAvailableAgent("test prompt");

      expect(result).toEqual({
        success: false,
        output: "",
        error: "AI calls disabled via SKIP_AI_GUIDANCE",
      });

      delete process.env.SKIP_AI_GUIDANCE;
    });

    it("should return error when no agents are available", async () => {
      const { commandExists } = await import("../../src/agents/detection.js");
      vi.mocked(commandExists).mockReturnValue(false);

      const result = await callAnyAvailableAgent("test prompt", { verbose: true });

      expect(result).toEqual({
        success: false,
        output: "",
        error: "No AI agents available or all failed",
      });
    });

    it("should call first available agent and return success", async () => {
      const { callAgent } = await import("../../src/agents/executor.js");
      const { commandExists } = await import("../../src/agents/detection.js");
      vi.mocked(commandExists).mockReturnValue(true);
      vi.mocked(callAgent).mockResolvedValue({
        success: true,
        output: "test output",
      });

      const result = await callAnyAvailableAgent("test prompt");

      expect(result).toEqual({
        success: true,
        output: "test output",
        agentUsed: "claude",
      });
      expect(callAgent).toHaveBeenCalledTimes(1);
    });

    it("should try multiple agents in order until one succeeds", async () => {
      const { callAgent } = await import("../../src/agents/executor.js");
      const { commandExists } = await import("../../src/agents/detection.js");
      vi.mocked(commandExists).mockReturnValue(true);
      vi.mocked(callAgent)
        .mockResolvedValueOnce({ success: false, error: "first failed" })
        .mockResolvedValueOnce({ success: false, error: "second failed" })
        .mockResolvedValueOnce({ success: true, output: "third succeeded" });

      const result = await callAnyAvailableAgent("test prompt", { verbose: true });

      expect(result).toEqual({
        success: true,
        output: "third succeeded",
        agentUsed: "gemini",
      });
      expect(callAgent).toHaveBeenCalledTimes(3);
    });

    it("should use preferredOrder when provided", async () => {
      const { callAgent } = await import("../../src/agents/executor.js");
      const { commandExists } = await import("../../src/agents/detection.js");
      vi.mocked(commandExists).mockReturnValue(true);
      vi.mocked(callAgent).mockResolvedValue({
        success: true,
        output: "test output",
      });

      await callAnyAvailableAgent("test prompt", {
        preferredOrder: ["gemini", "claude"],
      });

      expect(callAgent).toHaveBeenCalledWith(
        expect.objectContaining({ name: "gemini" }),
        "test prompt",
        expect.any(Object)
      );
    });

    it("should call onAgentSelected callback when agent is selected", async () => {
      const { callAgent } = await import("../../src/agents/executor.js");
      const { commandExists } = await import("../../src/agents/detection.js");
      vi.mocked(commandExists).mockReturnValue(true);
      vi.mocked(callAgent).mockResolvedValue({
        success: true,
        output: "test output",
      });

      const onAgentSelected = vi.fn();
      await callAnyAvailableAgent("test prompt", { onAgentSelected });

      expect(onAgentSelected).toHaveBeenCalledWith("claude");
    });

    it("should handle timeout correctly", async () => {
      const { callAgent } = await import("../../src/agents/executor.js");
      const { commandExists } = await import("../../src/agents/detection.js");
      vi.mocked(commandExists).mockReturnValue(true);
      vi.mocked(callAgent).mockResolvedValue({
        success: true,
        output: "test output",
      });

      await callAnyAvailableAgent("test prompt", { timeoutMs: 5000 });

      expect(callAgent).toHaveBeenCalled();
      // Verify callAgent was called with timeout in options
      const callArgs = vi.mocked(callAgent).mock.calls[0];
      expect(callArgs[2]).toHaveProperty("timeoutMs", 5000);
    });

    it("should use provided cwd", async () => {
      const { callAgent } = await import("../../src/agents/executor.js");
      const { commandExists } = await import("../../src/agents/detection.js");
      vi.mocked(commandExists).mockReturnValue(true);
      vi.mocked(callAgent).mockResolvedValue({
        success: true,
        output: "test output",
      });

      await callAnyAvailableAgent("test prompt", { cwd: "/test/path" });

      expect(callAgent).toHaveBeenCalled();
      // Verify callAgent was called with cwd in options
      const callArgs = vi.mocked(callAgent).mock.calls[0];
      expect(callArgs[2]).toHaveProperty("cwd", "/test/path");
    });

    it("should respect showProgress=false option", async () => {
      const { callAgent } = await import("../../src/agents/executor.js");
      const { commandExists } = await import("../../src/agents/detection.js");
      vi.mocked(commandExists).mockReturnValue(true);
      vi.mocked(callAgent).mockResolvedValue({
        success: true,
        output: "test output",
      });

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await callAnyAvailableAgent("test prompt", { showProgress: false });

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Using")
      );

      consoleSpy.mockRestore();
    });
  });

  describe("printAgentStatus", () => {
    it("should print status for all agents", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      printAgentStatus();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("AI Agents Status:")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("claude:")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("✓ available")
      );

      consoleSpy.mockRestore();
    });
  });

  describe("getAgentPriorityString", () => {
    it("should return formatted priority string", () => {
      const result = getAgentPriorityString();

      expect(result).toBe("Claude > Codex > Gemini");
    });

    it("should capitalize agent names", async () => {
      const { getAgentPriority } = await import("../../src/timeout-config.js");
      vi.mocked(getAgentPriority).mockReturnValue(["codex", "gemini"]);

      const result = getAgentPriorityString();

      expect(result).toBe("Codex > Gemini");
    });
  });
});
