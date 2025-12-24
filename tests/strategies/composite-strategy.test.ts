/**
 * Tests for CompositeStrategyExecutor
 * Universal Verification Strategy (UVS) Phase 3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Feature } from "../../src/types.js";
import type { VerificationStrategy } from "../../src/verifier/types/index.js";
import {
  CompositeStrategyExecutor,
  compositeStrategyExecutor,
  type ExtendedCompositeVerificationStrategy,
} from "../../src/strategies/composite-strategy.js";
import { StrategyRegistry, defaultRegistry, type StrategyResult, type StrategyExecutor } from "../../src/strategy-executor.js";

// Base feature for testing
const baseFeature: Feature = {
  id: "test.feature",
  description: "Test feature",
  module: "test",
  priority: 1,
  status: "failing",
  acceptance: ["Acceptance criterion"],
  dependsOn: [],
  supersedes: [],
  tags: [],
  version: 1,
  origin: "manual",
  notes: "",
};

/**
 * Mock executor for testing
 */
class MockExecutor implements StrategyExecutor {
  type: string;
  private results: StrategyResult[] = [];
  private callCount = 0;
  executionOrder: string[] = [];

  constructor(type: string) {
    this.type = type;
  }

  setResults(...results: StrategyResult[]): void {
    this.results = results;
    this.callCount = 0;
  }

  async execute(
    _cwd: string,
    _strategy: VerificationStrategy,
    _feature: Feature
  ): Promise<StrategyResult> {
    this.executionOrder.push(this.type);
    const result = this.results[this.callCount] ?? { success: false, output: "No result configured" };
    this.callCount++;
    return result;
  }
}

describe("CompositeStrategyExecutor", () => {
  let executor: CompositeStrategyExecutor;
  let mockRegistry: StrategyRegistry;
  let mockTestExecutor: MockExecutor;
  let mockFileExecutor: MockExecutor;
  let mockCommandExecutor: MockExecutor;

  beforeEach(() => {
    mockRegistry = new StrategyRegistry();
    mockTestExecutor = new MockExecutor("test");
    mockFileExecutor = new MockExecutor("file");
    mockCommandExecutor = new MockExecutor("command");

    mockRegistry.register(mockTestExecutor as StrategyExecutor);
    mockRegistry.register(mockFileExecutor as StrategyExecutor);
    mockRegistry.register(mockCommandExecutor as StrategyExecutor);

    executor = new CompositeStrategyExecutor(mockRegistry);
    vi.clearAllMocks();
    // Suppress console output during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("type property", () => {
    it("should have type 'composite'", () => {
      expect(executor.type).toBe("composite");
    });
  });

  describe("AND logic", () => {
    it("should pass when all nested strategies pass", async () => {
      mockTestExecutor.setResults({ success: true, output: "Tests passed" });
      mockFileExecutor.setResults({ success: true, output: "File exists" });

      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        operator: "and",
        strategies: [
          { type: "test", required: true },
          { type: "file", required: true, path: "/some/file" },
        ],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.operator).toBe("and");
      expect(result.details?.executedCount).toBe(2);
      expect(result.details?.shortCircuited).toBe(false);
    });

    it("should fail when any nested strategy fails", async () => {
      mockTestExecutor.setResults({ success: true, output: "Tests passed" });
      mockFileExecutor.setResults({ success: false, output: "File missing" });

      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        operator: "and",
        strategies: [
          { type: "test", required: true },
          { type: "file", required: true, path: "/some/file" },
        ],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.executedCount).toBe(2);
    });

    it("should short-circuit on first failure (fail fast)", async () => {
      mockTestExecutor.setResults({ success: false, output: "Tests failed" });
      mockFileExecutor.setResults({ success: true, output: "File exists" });

      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        operator: "and",
        strategies: [
          { type: "test", required: true },
          { type: "file", required: true, path: "/some/file" },
        ],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.executedCount).toBe(1);
      expect(result.details?.shortCircuited).toBe(true);
      expect(mockTestExecutor.executionOrder).toHaveLength(1);
      expect(mockFileExecutor.executionOrder).toHaveLength(0);
    });

    it("should use 'and' as default operator", async () => {
      mockTestExecutor.setResults({ success: true, output: "Tests passed" });
      mockFileExecutor.setResults({ success: true, output: "File exists" });

      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        // No operator specified - should default to "and"
        strategies: [
          { type: "test", required: true },
          { type: "file", required: true, path: "/some/file" },
        ],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.operator).toBe("and");
    });
  });

  describe("OR logic", () => {
    it("should pass when at least one nested strategy passes", async () => {
      mockTestExecutor.setResults({ success: false, output: "Tests failed" });
      mockFileExecutor.setResults({ success: true, output: "File exists" });

      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        operator: "or",
        strategies: [
          { type: "test", required: true },
          { type: "file", required: true, path: "/some/file" },
        ],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.operator).toBe("or");
    });

    it("should fail when all nested strategies fail", async () => {
      mockTestExecutor.setResults({ success: false, output: "Tests failed" });
      mockFileExecutor.setResults({ success: false, output: "File missing" });

      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        operator: "or",
        strategies: [
          { type: "test", required: true },
          { type: "file", required: true, path: "/some/file" },
        ],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.executedCount).toBe(2);
    });

    it("should short-circuit on first success", async () => {
      mockTestExecutor.setResults({ success: true, output: "Tests passed" });
      mockFileExecutor.setResults({ success: false, output: "File missing" });

      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        operator: "or",
        strategies: [
          { type: "test", required: true },
          { type: "file", required: true, path: "/some/file" },
        ],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.executedCount).toBe(1);
      expect(result.details?.shortCircuited).toBe(true);
      expect(mockTestExecutor.executionOrder).toHaveLength(1);
      expect(mockFileExecutor.executionOrder).toHaveLength(0);
    });
  });

  describe("'logic' alias for 'operator'", () => {
    it("should support 'logic' field as alias for 'operator'", async () => {
      mockTestExecutor.setResults({ success: true, output: "Tests passed" });
      mockFileExecutor.setResults({ success: true, output: "File exists" });

      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        logic: "and", // Using 'logic' instead of 'operator'
        strategies: [
          { type: "test", required: true },
          { type: "file", required: true, path: "/some/file" },
        ],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.operator).toBe("and");
    });

    it("should support 'logic: or'", async () => {
      mockTestExecutor.setResults({ success: true, output: "Tests passed" });

      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        logic: "or",
        strategies: [
          { type: "test", required: true },
          { type: "file", required: true, path: "/some/file" },
        ],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.operator).toBe("or");
    });

    it("should prefer 'operator' over 'logic' when both are specified", async () => {
      mockTestExecutor.setResults({ success: true, output: "Tests passed" });

      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        operator: "or",
        logic: "and", // This should be ignored
        strategies: [
          { type: "test", required: true },
          { type: "file", required: true, path: "/some/file" },
        ],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      // operator: "or" takes precedence, so short-circuits on first success
      expect(result.details?.operator).toBe("or");
      expect(result.details?.shortCircuited).toBe(true);
    });
  });

  describe("nested composite strategies (recursive)", () => {
    it("should support nested composite strategies", async () => {
      mockTestExecutor.setResults({ success: true, output: "Tests passed" });
      mockFileExecutor.setResults({ success: true, output: "File exists" });
      mockCommandExecutor.setResults({ success: true, output: "Command succeeded" });

      // Register a nested composite executor
      const nestedExecutor = new CompositeStrategyExecutor(mockRegistry);
      mockRegistry.register(nestedExecutor as StrategyExecutor);

      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        operator: "and",
        strategies: [
          { type: "test", required: true },
          {
            type: "composite",
            required: true,
            operator: "or",
            strategies: [
              { type: "file", required: true, path: "/file1" },
              { type: "command", required: true, command: "echo test" },
            ],
          },
        ],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.executedCount).toBe(2);
    });

    it("should handle deeply nested composite strategies", async () => {
      mockTestExecutor.setResults(
        { success: true, output: "Test 1" },
        { success: true, output: "Test 2" }
      );
      mockFileExecutor.setResults({ success: true, output: "File exists" });

      // Register composite executor for nesting
      const nestedExecutor = new CompositeStrategyExecutor(mockRegistry);
      mockRegistry.register(nestedExecutor as StrategyExecutor);

      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        operator: "and",
        strategies: [
          { type: "test", required: true },
          {
            type: "composite",
            required: true,
            operator: "and",
            strategies: [
              { type: "file", required: true, path: "/file" },
              {
                type: "composite",
                required: true,
                operator: "or",
                strategies: [
                  { type: "test", required: true },
                ],
              },
            ],
          },
        ],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
    });
  });

  describe("output aggregation", () => {
    it("should aggregate output from all executed strategies", async () => {
      mockTestExecutor.setResults({ success: true, output: "All tests passed" });
      mockFileExecutor.setResults({ success: true, output: "Config file exists" });

      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        operator: "and",
        strategies: [
          { type: "test", required: true },
          { type: "file", required: true, path: "/config.json" },
        ],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.output).toContain("test");
      expect(result.output).toContain("file");
      expect(result.output).toContain("2 passed");
    });

    it("should include failure information in output", async () => {
      mockTestExecutor.setResults({ success: false, output: "3 tests failed" });

      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        operator: "and",
        strategies: [
          { type: "test", required: true },
          { type: "file", required: true, path: "/config.json" },
        ],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.output).toContain("failed");
    });
  });

  describe("empty strategies array", () => {
    it("should return success for empty AND strategies (vacuously true)", async () => {
      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        operator: "and",
        strategies: [],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.executedCount).toBe(0);
    });

    it("should return success for empty OR strategies (vacuously true)", async () => {
      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        operator: "or",
        strategies: [],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
    });
  });

  describe("missing executor", () => {
    it("should fail gracefully when no executor is registered", async () => {
      const emptyRegistry = new StrategyRegistry();
      const executorWithEmptyRegistry = new CompositeStrategyExecutor(emptyRegistry);

      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        operator: "and",
        strategies: [{ type: "test", required: true }],
      };

      const result = await executorWithEmptyRegistry.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("No executor registered");
    });
  });

  describe("setRegistry", () => {
    it("should allow setting registry after construction", async () => {
      const newRegistry = new StrategyRegistry();
      const newMockExecutor = new MockExecutor("test");
      newMockExecutor.setResults({ success: true, output: "Success from new registry" });
      newRegistry.register(newMockExecutor as StrategyExecutor);

      const executorNoRegistry = new CompositeStrategyExecutor();
      executorNoRegistry.setRegistry(newRegistry);

      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        operator: "and",
        strategies: [{ type: "test", required: true }],
      };

      const result = await executorNoRegistry.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
    });
  });

  describe("return value details", () => {
    it("should include duration", async () => {
      mockTestExecutor.setResults({ success: true, output: "Pass" });

      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        operator: "and",
        strategies: [{ type: "test", required: true }],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should include nested results details", async () => {
      mockTestExecutor.setResults({ success: true, output: "Tests passed", duration: 100 });
      mockFileExecutor.setResults({ success: true, output: "File exists", duration: 50 });

      const strategy: ExtendedCompositeVerificationStrategy = {
        type: "composite",
        required: true,
        operator: "and",
        strategies: [
          { type: "test", required: true },
          { type: "file", required: true, path: "/file" },
        ],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      const nestedResults = result.details?.nestedResults as Array<{
        type: string;
        index: number;
        success: boolean;
      }>;

      expect(nestedResults).toHaveLength(2);
      expect(nestedResults[0].type).toBe("test");
      expect(nestedResults[0].index).toBe(0);
      expect(nestedResults[0].success).toBe(true);
      expect(nestedResults[1].type).toBe("file");
      expect(nestedResults[1].index).toBe(1);
      expect(nestedResults[1].success).toBe(true);
    });
  });
});

describe("compositeStrategyExecutor singleton", () => {
  it("should be a CompositeStrategyExecutor instance", () => {
    expect(compositeStrategyExecutor).toBeInstanceOf(CompositeStrategyExecutor);
  });

  it("should have type 'composite'", () => {
    expect(compositeStrategyExecutor.type).toBe("composite");
  });
});

describe("defaultRegistry integration", () => {
  it("should have composite executor registered", () => {
    expect(defaultRegistry.has("composite")).toBe(true);
  });

  it("should return compositeStrategyExecutor for 'composite' type", () => {
    const registeredExecutor = defaultRegistry.get("composite");
    expect(registeredExecutor).toBe(compositeStrategyExecutor);
  });
});
