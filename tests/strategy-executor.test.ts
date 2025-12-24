/**
 * Tests for strategy executor framework
 * Universal Verification Strategy (UVS) Phase 3
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  StrategyRegistry,
  defaultRegistry,
  type StrategyExecutor,
  type StrategyResult,
} from "../src/strategy-executor.js";
import type { Feature } from "../src/types.js";
import type {
  TestVerificationStrategy,
  E2EVerificationStrategy,
  VerificationStrategy,
} from "../src/verifier/types/index.js";

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

// Mock executor for testing
class MockTestExecutor implements StrategyExecutor<TestVerificationStrategy> {
  readonly type = "test" as const;
  executeCallCount = 0;
  lastStrategy: TestVerificationStrategy | null = null;
  lastFeature: Feature | null = null;
  mockResult: StrategyResult = { success: true };

  async execute(
    cwd: string,
    strategy: TestVerificationStrategy,
    feature: Feature
  ): Promise<StrategyResult> {
    this.executeCallCount++;
    this.lastStrategy = strategy;
    this.lastFeature = feature;
    return this.mockResult;
  }

  reset(): void {
    this.executeCallCount = 0;
    this.lastStrategy = null;
    this.lastFeature = null;
    this.mockResult = { success: true };
  }
}

// Another mock executor for testing multiple registrations
class MockE2EExecutor implements StrategyExecutor<E2EVerificationStrategy> {
  readonly type = "e2e" as const;

  async execute(
    cwd: string,
    strategy: E2EVerificationStrategy,
    feature: Feature
  ): Promise<StrategyResult> {
    return {
      success: true,
      output: "E2E tests passed",
      duration: 5000,
    };
  }
}

describe("StrategyRegistry", () => {
  let registry: StrategyRegistry;
  let mockTestExecutor: MockTestExecutor;
  let mockE2EExecutor: MockE2EExecutor;

  beforeEach(() => {
    registry = new StrategyRegistry();
    mockTestExecutor = new MockTestExecutor();
    mockE2EExecutor = new MockE2EExecutor();
  });

  describe("register", () => {
    it("should register an executor", () => {
      registry.register(mockTestExecutor);

      expect(registry.has("test")).toBe(true);
    });

    it("should register multiple executors", () => {
      registry.register(mockTestExecutor);
      registry.register(mockE2EExecutor);

      expect(registry.has("test")).toBe(true);
      expect(registry.has("e2e")).toBe(true);
    });

    it("should overwrite existing executor for same type", () => {
      const executor1 = new MockTestExecutor();
      const executor2 = new MockTestExecutor();

      registry.register(executor1);
      registry.register(executor2);

      expect(registry.get("test")).toBe(executor2);
    });
  });

  describe("get", () => {
    it("should return registered executor", () => {
      registry.register(mockTestExecutor);

      const executor = registry.get("test");

      expect(executor).toBe(mockTestExecutor);
    });

    it("should return undefined for unregistered type", () => {
      const executor = registry.get("test");

      expect(executor).toBeUndefined();
    });
  });

  describe("has", () => {
    it("should return true for registered type", () => {
      registry.register(mockTestExecutor);

      expect(registry.has("test")).toBe(true);
    });

    it("should return false for unregistered type", () => {
      expect(registry.has("test")).toBe(false);
    });
  });

  describe("execute", () => {
    it("should execute strategy using registered executor", async () => {
      registry.register(mockTestExecutor);

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
        pattern: "tests/**/*.test.ts",
      };

      const result = await registry.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(mockTestExecutor.executeCallCount).toBe(1);
      expect(mockTestExecutor.lastStrategy).toBe(strategy);
      expect(mockTestExecutor.lastFeature).toBe(baseFeature);
    });

    it("should throw error for unknown strategy type", async () => {
      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
      };

      await expect(
        registry.execute("/project", strategy, baseFeature)
      ).rejects.toThrow("No executor registered for strategy type: test");
    });

    it("should return result from executor", async () => {
      mockTestExecutor.mockResult = {
        success: true,
        output: "All tests passed",
        duration: 1234,
        details: { testsRun: 10, testsPassed: 10 },
      };
      registry.register(mockTestExecutor);

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
      };

      const result = await registry.execute("/project", strategy, baseFeature);

      expect(result).toEqual({
        success: true,
        output: "All tests passed",
        duration: 1234,
        details: { testsRun: 10, testsPassed: 10 },
      });
    });

    it("should handle failed execution", async () => {
      mockTestExecutor.mockResult = {
        success: false,
        output: "2 tests failed",
        duration: 500,
      };
      registry.register(mockTestExecutor);

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
      };

      const result = await registry.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toBe("2 tests failed");
    });
  });

  describe("getRegisteredTypes", () => {
    it("should return empty array when no executors registered", () => {
      const types = registry.getRegisteredTypes();

      expect(types).toEqual([]);
    });

    it("should return all registered types", () => {
      registry.register(mockTestExecutor);
      registry.register(mockE2EExecutor);

      const types = registry.getRegisteredTypes();

      expect(types).toContain("test");
      expect(types).toContain("e2e");
      expect(types).toHaveLength(2);
    });
  });

  describe("clear", () => {
    it("should remove all registered executors", () => {
      registry.register(mockTestExecutor);
      registry.register(mockE2EExecutor);

      registry.clear();

      expect(registry.has("test")).toBe(false);
      expect(registry.has("e2e")).toBe(false);
      expect(registry.getRegisteredTypes()).toEqual([]);
    });
  });
});

describe("StrategyResult interface", () => {
  it("should accept minimal result", () => {
    const result: StrategyResult = {
      success: true,
    };

    expect(result.success).toBe(true);
    expect(result.output).toBeUndefined();
    expect(result.duration).toBeUndefined();
    expect(result.details).toBeUndefined();
  });

  it("should accept full result", () => {
    const result: StrategyResult = {
      success: false,
      output: "Error: test failed",
      duration: 2500,
      details: {
        testsRun: 5,
        testsFailed: 1,
        failedTests: ["should work"],
      },
    };

    expect(result.success).toBe(false);
    expect(result.output).toBe("Error: test failed");
    expect(result.duration).toBe(2500);
    expect(result.details?.testsRun).toBe(5);
  });
});

describe("defaultRegistry", () => {
  it("should be a StrategyRegistry instance", () => {
    expect(defaultRegistry).toBeInstanceOf(StrategyRegistry);
  });

  it("should be usable for registering executors", () => {
    const originalTypes = defaultRegistry.getRegisteredTypes().length;

    // Register a mock executor
    const mockExecutor = new MockTestExecutor();
    defaultRegistry.register(mockExecutor);

    expect(defaultRegistry.has("test")).toBe(true);

    // Clean up (remove the mock executor we added)
    // Note: In real tests, we might want to reset the defaultRegistry
  });
});
