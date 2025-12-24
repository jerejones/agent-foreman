/**
 * Tests for AIStrategyExecutor
 * Universal Verification Strategy (UVS) Phase 3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Feature } from "../../src/types.js";
import type { AiVerificationStrategy } from "../../src/verifier/types/index.js";
import {
  AIStrategyExecutor,
  aiStrategyExecutor,
  type AIAgentInterface,
  type ExtendedAiVerificationStrategy,
} from "../../src/strategies/ai-strategy.js";
import { defaultRegistry } from "../../src/strategy-executor.js";

// Base feature for testing
const baseFeature: Feature = {
  id: "test.feature",
  description: "Test feature",
  module: "test",
  priority: 1,
  status: "failing",
  acceptance: ["Acceptance criterion 1", "Acceptance criterion 2"],
  dependsOn: [],
  supersedes: [],
  tags: [],
  version: 1,
  origin: "manual",
  notes: "",
};

/**
 * Mock AI agent for testing
 */
class MockAIAgent implements AIAgentInterface {
  private responses: Array<{
    success: boolean;
    output: string;
    agentUsed?: string;
    error?: string;
  }> = [];

  setResponses(
    ...responses: Array<{
      success: boolean;
      output: string;
      agentUsed?: string;
      error?: string;
    }>
  ): void {
    this.responses = responses;
  }

  async call(): Promise<{
    success: boolean;
    output: string;
    agentUsed?: string;
    error?: string;
  }> {
    const response = this.responses.shift();
    return (
      response ?? {
        success: false,
        output: "",
        error: "No mock response configured",
      }
    );
  }
}

describe("AIStrategyExecutor", () => {
  let executor: AIStrategyExecutor;
  let mockAgent: MockAIAgent;

  beforeEach(() => {
    mockAgent = new MockAIAgent();
    executor = new AIStrategyExecutor(mockAgent);
    vi.clearAllMocks();
    // Suppress console output during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("type property", () => {
    it("should have type 'ai'", () => {
      expect(executor.type).toBe("ai");
    });
  });

  describe("autonomous mode (default)", () => {
    it("should pass when AI returns pass verdict", async () => {
      mockAgent.setResponses({
        success: true,
        output: JSON.stringify({
          criteriaResults: [
            { index: 0, satisfied: true, reasoning: "Found implementation", confidence: 0.9 },
            { index: 1, satisfied: true, reasoning: "Found tests", confidence: 0.85 },
          ],
          verdict: "pass",
          overallReasoning: "All criteria satisfied",
        }),
        agentUsed: "codex",
      });

      const strategy: ExtendedAiVerificationStrategy = {
        type: "ai",
        required: true,
        mode: "autonomous",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.verdict).toBe("pass");
      expect(result.details?.agentUsed).toBe("codex");
      expect(result.details?.mode).toBe("autonomous");
    });

    it("should fail when AI returns fail verdict", async () => {
      mockAgent.setResponses({
        success: true,
        output: JSON.stringify({
          criteriaResults: [
            { index: 0, satisfied: true, reasoning: "Found implementation", confidence: 0.9 },
            { index: 1, satisfied: false, reasoning: "Missing tests", confidence: 0.95 },
          ],
          verdict: "fail",
          overallReasoning: "One criterion not satisfied",
        }),
        agentUsed: "gemini",
      });

      const strategy: ExtendedAiVerificationStrategy = {
        type: "ai",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.verdict).toBe("fail");
    });

    it("should use default mode as autonomous", async () => {
      mockAgent.setResponses({
        success: true,
        output: JSON.stringify({
          criteriaResults: [
            { index: 0, satisfied: true, reasoning: "Found", confidence: 0.9 },
            { index: 1, satisfied: true, reasoning: "Found", confidence: 0.9 },
          ],
          verdict: "pass",
          overallReasoning: "All good",
        }),
        agentUsed: "claude",
      });

      const strategy: ExtendedAiVerificationStrategy = {
        type: "ai",
        required: true,
        // No mode specified - should default to autonomous
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.details?.mode).toBe("autonomous");
    });
  });

  describe("diff mode", () => {
    it("should use diff mode when specified", async () => {
      mockAgent.setResponses({
        success: true,
        output: JSON.stringify({
          criteriaResults: [
            { index: 0, satisfied: true, reasoning: "Found in diff", confidence: 0.88 },
            { index: 1, satisfied: true, reasoning: "Found in diff", confidence: 0.92 },
          ],
          verdict: "pass",
          overallReasoning: "Diff analysis complete",
        }),
        agentUsed: "codex",
      });

      const strategy: ExtendedAiVerificationStrategy = {
        type: "ai",
        required: true,
        mode: "diff",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.mode).toBe("diff");
    });
  });

  describe("custom prompt", () => {
    it("should use customPrompt when provided", async () => {
      mockAgent.setResponses({
        success: true,
        output: JSON.stringify({
          criteriaResults: [
            { index: 0, satisfied: true, reasoning: "Custom check passed", confidence: 0.9 },
            { index: 1, satisfied: true, reasoning: "Custom check passed", confidence: 0.9 },
          ],
          verdict: "pass",
          overallReasoning: "Custom verification complete",
        }),
        agentUsed: "claude",
      });

      const strategy: ExtendedAiVerificationStrategy = {
        type: "ai",
        required: true,
        customPrompt: "Custom prompt for {featureId} in {cwd}\n\nCriteria:\n{acceptanceCriteria}",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
    });
  });

  describe("minConfidence threshold", () => {
    it("should use default minConfidence of 0.7", async () => {
      mockAgent.setResponses({
        success: true,
        output: JSON.stringify({
          criteriaResults: [
            { index: 0, satisfied: true, reasoning: "Found", confidence: 0.75 },
            { index: 1, satisfied: true, reasoning: "Found", confidence: 0.8 },
          ],
          verdict: "pass",
          overallReasoning: "All good",
        }),
        agentUsed: "codex",
      });

      const strategy: ExtendedAiVerificationStrategy = {
        type: "ai",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.minConfidence).toBe(0.7);
    });

    it("should fail when confidence below threshold", async () => {
      mockAgent.setResponses({
        success: true,
        output: JSON.stringify({
          criteriaResults: [
            { index: 0, satisfied: true, reasoning: "Found", confidence: 0.5 },
            { index: 1, satisfied: true, reasoning: "Found", confidence: 0.6 },
          ],
          verdict: "pass",
          overallReasoning: "All good",
        }),
        agentUsed: "codex",
      });

      const strategy: ExtendedAiVerificationStrategy = {
        type: "ai",
        required: true,
        minConfidence: 0.7,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.verdict).toBe("needs_review");
      expect(result.details?.lowConfidenceCriteria).toContain("Acceptance criterion 1");
    });

    it("should respect custom minConfidence", async () => {
      mockAgent.setResponses({
        success: true,
        output: JSON.stringify({
          criteriaResults: [
            { index: 0, satisfied: true, reasoning: "Found", confidence: 0.85 },
            { index: 1, satisfied: true, reasoning: "Found", confidence: 0.88 },
          ],
          verdict: "pass",
          overallReasoning: "All good",
        }),
        agentUsed: "codex",
      });

      const strategy: ExtendedAiVerificationStrategy = {
        type: "ai",
        required: true,
        minConfidence: 0.9,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.minConfidence).toBe(0.9);
    });
  });

  describe("AI agent failure", () => {
    it("should fail when AI call fails", async () => {
      mockAgent.setResponses({
        success: false,
        output: "",
        error: "API rate limit exceeded",
      });

      const strategy: ExtendedAiVerificationStrategy = {
        type: "ai",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("AI verification failed");
      expect(result.details?.reason).toBe("ai-call-failed");
      expect(result.details?.error).toBe("API rate limit exceeded");
    });

    it("should handle invalid JSON response", async () => {
      mockAgent.setResponses({
        success: true,
        output: "This is not valid JSON",
        agentUsed: "codex",
      });

      const strategy: ExtendedAiVerificationStrategy = {
        type: "ai",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.verdict).toBe("needs_review");
    });

    it("should handle partial JSON response", async () => {
      mockAgent.setResponses({
        success: true,
        output: JSON.stringify({
          criteriaResults: [{ index: 0, satisfied: true, confidence: 0.9 }],
          // Missing second criterion
          verdict: "pass",
        }),
        agentUsed: "codex",
      });

      const strategy: ExtendedAiVerificationStrategy = {
        type: "ai",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      // Should still process but mark missing criterion as not analyzed
      expect(result.details?.criteriaResults).toHaveLength(2);
    });
  });

  describe("model preference", () => {
    it("should use specified model", async () => {
      mockAgent.setResponses({
        success: true,
        output: JSON.stringify({
          criteriaResults: [
            { index: 0, satisfied: true, reasoning: "Found", confidence: 0.9 },
            { index: 1, satisfied: true, reasoning: "Found", confidence: 0.9 },
          ],
          verdict: "pass",
          overallReasoning: "All good",
        }),
        agentUsed: "claude",
      });

      const strategy: ExtendedAiVerificationStrategy = {
        type: "ai",
        required: true,
        model: "claude",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
    });
  });

  describe("setAIAgent", () => {
    it("should allow setting AI agent after construction", async () => {
      const executor2 = new AIStrategyExecutor();
      const newMockAgent = new MockAIAgent();
      newMockAgent.setResponses({
        success: true,
        output: JSON.stringify({
          criteriaResults: [
            { index: 0, satisfied: true, reasoning: "Found", confidence: 0.9 },
            { index: 1, satisfied: true, reasoning: "Found", confidence: 0.9 },
          ],
          verdict: "pass",
          overallReasoning: "All good",
        }),
        agentUsed: "codex",
      });
      executor2.setAIAgent(newMockAgent);

      const strategy: ExtendedAiVerificationStrategy = {
        type: "ai",
        required: true,
      };

      const result = await executor2.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
    });
  });

  describe("return value details", () => {
    it("should include duration", async () => {
      mockAgent.setResponses({
        success: true,
        output: JSON.stringify({
          criteriaResults: [
            { index: 0, satisfied: true, reasoning: "Found", confidence: 0.9 },
            { index: 1, satisfied: true, reasoning: "Found", confidence: 0.9 },
          ],
          verdict: "pass",
          overallReasoning: "All good",
        }),
        agentUsed: "codex",
      });

      const strategy: ExtendedAiVerificationStrategy = {
        type: "ai",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should include all strategy info in details", async () => {
      mockAgent.setResponses({
        success: true,
        output: JSON.stringify({
          criteriaResults: [
            { index: 0, satisfied: true, reasoning: "Found impl", confidence: 0.9 },
            { index: 1, satisfied: true, reasoning: "Found tests", confidence: 0.85 },
          ],
          verdict: "pass",
          overallReasoning: "All criteria satisfied",
          suggestions: ["Consider adding more tests"],
        }),
        agentUsed: "codex",
      });

      const strategy: ExtendedAiVerificationStrategy = {
        type: "ai",
        required: true,
        mode: "autonomous",
        minConfidence: 0.8,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.details?.mode).toBe("autonomous");
      expect(result.details?.agentUsed).toBe("codex");
      expect(result.details?.verdict).toBe("pass");
      expect(result.details?.criteriaResults).toBeDefined();
      expect(result.details?.overallReasoning).toBe("All criteria satisfied");
      expect(result.details?.suggestions).toContain("Consider adding more tests");
    });
  });

  describe("JSON extraction from markdown", () => {
    it("should extract JSON from markdown code blocks", async () => {
      mockAgent.setResponses({
        success: true,
        output: `Here's the analysis:

\`\`\`json
{
  "criteriaResults": [
    { "index": 0, "satisfied": true, "reasoning": "Found", "confidence": 0.9 },
    { "index": 1, "satisfied": true, "reasoning": "Found", "confidence": 0.9 }
  ],
  "verdict": "pass",
  "overallReasoning": "All good"
}
\`\`\`

That's the result.`,
        agentUsed: "claude",
      });

      const strategy: ExtendedAiVerificationStrategy = {
        type: "ai",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.verdict).toBe("pass");
    });
  });
});

describe("aiStrategyExecutor singleton", () => {
  it("should be an AIStrategyExecutor instance", () => {
    expect(aiStrategyExecutor).toBeInstanceOf(AIStrategyExecutor);
  });

  it("should have type 'ai'", () => {
    expect(aiStrategyExecutor.type).toBe("ai");
  });
});

describe("defaultRegistry integration", () => {
  it("should have ai executor registered", () => {
    expect(defaultRegistry.has("ai")).toBe(true);
  });

  it("should return aiStrategyExecutor for 'ai' type", () => {
    const executor = defaultRegistry.get("ai");
    expect(executor).toBe(aiStrategyExecutor);
  });
});
