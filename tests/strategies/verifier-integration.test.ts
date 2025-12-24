/**
 * Integration Tests for Strategy-Based Verification
 * Universal Verification Strategy (UVS) Phase 4
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Feature } from "../../src/types.js";
import type { VerificationStrategy } from "../../src/verifier/types/index.js";
import {
  executeVerificationStrategies,
  shouldUseStrategyVerification,
  getVerificationStrategies,
  type StrategyExecutionResult,
} from "../../src/verifier/index.js";
import { defaultRegistry } from "../../src/strategy-executor.js";
import { initializeStrategies } from "../../src/strategies/index.js";

// Base feature for testing
const baseFeature: Feature = {
  id: "test.feature",
  description: "Test feature for integration testing",
  module: "test",
  priority: 1,
  status: "failing",
  acceptance: [
    "First acceptance criterion",
    "Second acceptance criterion",
    "Third acceptance criterion",
  ],
  dependsOn: [],
  supersedes: [],
  tags: [],
  version: 1,
  origin: "manual",
  notes: "",
};

describe("Strategy-Based Verification Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console output during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // Ensure strategies are initialized
    initializeStrategies();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("shouldUseStrategyVerification", () => {
    it("should return false for feature without explicit strategies", () => {
      const feature = { ...baseFeature };
      expect(shouldUseStrategyVerification(feature)).toBe(false);
    });

    it("should return true for feature with verificationStrategies", () => {
      const feature: Feature = {
        ...baseFeature,
        verificationStrategies: [
          { type: "test", required: true, pattern: "tests/**/*.test.ts" },
        ],
      };
      expect(shouldUseStrategyVerification(feature)).toBe(true);
    });

    it("should return true for feature with testRequirements that has pattern", () => {
      const feature: Feature = {
        ...baseFeature,
        testRequirements: {
          unit: {
            required: true,
            pattern: "tests/unit/**/*.test.ts",
          },
        },
      };
      expect(shouldUseStrategyVerification(feature)).toBe(true);
    });

    it("should return false for feature with empty verificationStrategies", () => {
      const feature: Feature = {
        ...baseFeature,
        verificationStrategies: [],
      };
      expect(shouldUseStrategyVerification(feature)).toBe(false);
    });
  });

  describe("getVerificationStrategies", () => {
    it("should return explicit strategies when provided", () => {
      const strategies: VerificationStrategy[] = [
        { type: "file", required: true, path: "src/index.ts", exists: true },
        { type: "test", required: true, pattern: "tests/**/*.test.ts" },
      ];
      const feature: Feature = {
        ...baseFeature,
        verificationStrategies: strategies,
      };

      const result = getVerificationStrategies(feature);

      expect(result).toEqual(strategies);
    });

    it("should convert testRequirements to strategies", () => {
      const feature: Feature = {
        ...baseFeature,
        testRequirements: {
          unit: {
            required: true,
            pattern: "tests/unit/**/*.test.ts",
          },
        },
      };

      const result = getVerificationStrategies(feature);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe("test");
    });

    it("should return AI strategy as default", () => {
      const result = getVerificationStrategies(baseFeature);

      expect(result.length).toBe(1);
      expect(result[0].type).toBe("ai");
      expect(result[0].required).toBe(true);
    });
  });

  describe("executeVerificationStrategies", () => {
    it("should execute file strategy", async () => {
      const strategies: VerificationStrategy[] = [
        {
          type: "file",
          required: true,
          path: __filename, // This test file exists
          exists: true,
        },
      ];

      const result = await executeVerificationStrategies(
        __dirname,
        baseFeature,
        strategies
      );

      expect(result.verdict).toBe("pass");
      expect(result.results).toHaveLength(1);
      expect(result.results[0].result.success).toBe(true);
    });

    it("should fail when required strategy fails", async () => {
      const strategies: VerificationStrategy[] = [
        {
          type: "file",
          required: true,
          path: "/nonexistent/file.ts",
          exists: true,
        },
      ];

      const result = await executeVerificationStrategies(
        __dirname,
        baseFeature,
        strategies
      );

      expect(result.verdict).toBe("fail");
      expect(result.results[0].result.success).toBe(false);
    });

    it("should pass when optional strategy fails", async () => {
      const strategies: VerificationStrategy[] = [
        {
          type: "file",
          required: true,
          path: __filename,
          exists: true,
        },
        {
          type: "file",
          required: false,
          path: "/nonexistent/file.ts",
          exists: true,
        },
      ];

      const result = await executeVerificationStrategies(
        __dirname,
        baseFeature,
        strategies
      );

      expect(result.verdict).toBe("pass");
      expect(result.results).toHaveLength(2);
    });

    it("should combine multiple strategy outputs into overallReasoning", async () => {
      const strategies: VerificationStrategy[] = [
        {
          type: "file",
          required: true,
          path: __filename,
          exists: true,
        },
        {
          type: "file",
          required: true,
          path: __dirname + "/index.test.ts",
          exists: true,
        },
      ];

      const result = await executeVerificationStrategies(
        __dirname,
        baseFeature,
        strategies
      );

      expect(result.overallReasoning).toContain("[FILE]");
      expect(result.overallReasoning).toContain("PASS");
    });

    it("should map criteria results when strategies pass", async () => {
      const strategies: VerificationStrategy[] = [
        {
          type: "file",
          required: true,
          path: __filename,
          exists: true,
        },
      ];

      const result = await executeVerificationStrategies(
        __dirname,
        baseFeature,
        strategies
      );

      expect(result.criteriaResults).toHaveLength(3); // 3 acceptance criteria
      result.criteriaResults.forEach((cr) => {
        expect(cr.satisfied).toBe(true);
        expect(cr.index).toBeDefined();
      });
    });

    it("should handle empty strategies array", async () => {
      const result = await executeVerificationStrategies(
        __dirname,
        baseFeature,
        []
      );

      expect(result.verdict).toBe("pass"); // Vacuously true
      expect(result.results).toHaveLength(0);
    });
  });

  describe("composite strategy execution", () => {
    it("should execute composite AND strategy", async () => {
      const strategies: VerificationStrategy[] = [
        {
          type: "composite",
          required: true,
          operator: "and",
          strategies: [
            { type: "file", required: true, path: __filename, exists: true },
            {
              type: "file",
              required: true,
              path: __dirname + "/index.test.ts",
              exists: true,
            },
          ],
        },
      ];

      const result = await executeVerificationStrategies(
        __dirname,
        baseFeature,
        strategies
      );

      expect(result.verdict).toBe("pass");
      expect(result.results).toHaveLength(1);
      expect(result.results[0].strategy.type).toBe("composite");
    });

    it("should fail composite AND when one strategy fails", async () => {
      const strategies: VerificationStrategy[] = [
        {
          type: "composite",
          required: true,
          operator: "and",
          strategies: [
            { type: "file", required: true, path: __filename, exists: true },
            {
              type: "file",
              required: true,
              path: "/nonexistent/file.ts",
              exists: true,
            },
          ],
        },
      ];

      const result = await executeVerificationStrategies(
        __dirname,
        baseFeature,
        strategies
      );

      expect(result.verdict).toBe("fail");
    });

    it("should pass composite OR when one strategy passes", async () => {
      const strategies: VerificationStrategy[] = [
        {
          type: "composite",
          required: true,
          operator: "or",
          strategies: [
            {
              type: "file",
              required: true,
              path: "/nonexistent/file.ts",
              exists: true,
            },
            { type: "file", required: true, path: __filename, exists: true },
          ],
        },
      ];

      const result = await executeVerificationStrategies(
        __dirname,
        baseFeature,
        strategies
      );

      expect(result.verdict).toBe("pass");
    });
  });

  describe("registry integration", () => {
    it("should have all strategy executors available", () => {
      const types = [
        "test",
        "e2e",
        "script",
        "http",
        "file",
        "command",
        "manual",
        "ai",
        "composite",
      ];

      for (const type of types) {
        expect(defaultRegistry.has(type as any)).toBe(true);
      }
    });
  });
});
