/**
 * Tests for E2EStrategyExecutor
 * Universal Verification Strategy (UVS) Phase 3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Feature } from "../../src/types.js";
import type { E2EVerificationStrategy } from "../../src/verifier/types/index.js";

// Use vi.hoisted to define mocks that will be available when vi.mock factories run
const { mockExecAsync, mockDetectCapabilities } = vi.hoisted(() => ({
  mockExecAsync: vi.fn(),
  mockDetectCapabilities: vi.fn(),
}));

// Mock modules
vi.mock("node:child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: vi.fn(() => mockExecAsync),
}));

vi.mock("../../src/capabilities/index.js", () => ({
  detectCapabilities: mockDetectCapabilities,
}));

// Import after mocks are defined
import { E2EStrategyExecutor, e2eStrategyExecutor } from "../../src/strategies/e2e-strategy.js";
import { defaultRegistry } from "../../src/strategy-executor.js";

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

describe("E2EStrategyExecutor", () => {
  let executor: E2EStrategyExecutor;

  beforeEach(() => {
    executor = new E2EStrategyExecutor();
    vi.clearAllMocks();

    // Default mock: playwright available
    mockDetectCapabilities.mockResolvedValue({
      hasTests: true,
      hasTypeCheck: false,
      hasLint: false,
      hasBuild: false,
      e2eInfo: {
        available: true,
        command: "npx playwright test",
        framework: "playwright",
        grepTemplate: "npx playwright test --grep {tags}",
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("type property", () => {
    it("should have type 'e2e'", () => {
      expect(executor.type).toBe("e2e");
    });
  });

  describe("execute", () => {
    it("should execute E2E command successfully", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "All E2E tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.output).toContain("All E2E tests passed");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should return failure when no E2E framework detected", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
        e2eInfo: undefined,
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("No E2E framework detected");
      expect(result.details?.reason).toBe("no-e2e-framework");
    });

    it("should return failure when e2eInfo not available", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
        e2eInfo: {
          available: false,
        },
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("No E2E framework detected");
    });

    it("should handle E2E test failures", async () => {
      const error = new Error("E2E test failed") as any;
      error.code = 1;
      error.stdout = "1 E2E test failed";
      error.stderr = "";
      mockExecAsync.mockRejectedValue(error);

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.exitCode).toBe(1);
    });

    it("should support tag-based filtering via tags field", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
        tags: ["@smoke", "@auth"],
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain("--grep");
      expect(calledArgs[0]).toContain("@smoke|@auth");
    });

    it("should use grep template when available", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
        tags: ["@critical"],
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      // Should use the grepTemplate
      expect(calledArgs[0]).toContain("npx playwright test --grep");
    });

    it("should support selective file execution via pattern", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
        pattern: "e2e/auth/**/*.spec.ts",
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain("e2e/auth/**/*.spec.ts");
    });

    it("should use custom timeout from strategy", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
        timeout: 180000,
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[1]?.timeout).toBe(180000);
    });

    it("should use default timeout of 120000ms", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[1]?.timeout).toBe(120000);
    });

    it("should include CI=true in environment", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[1]?.env?.CI).toBe("true");
    });

    it("should return strategy result with details", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "10 E2E tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
        pattern: "e2e/**/*.spec.ts",
        tags: ["@smoke"],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.command).toBeDefined();
      expect(result.details?.pattern).toBe("e2e/**/*.spec.ts");
      expect(result.details?.tags).toEqual(["@smoke"]);
    });

    it("should handle cypress framework", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
        e2eInfo: {
          available: true,
          command: "npx cypress run",
          framework: "cypress",
        },
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
        pattern: "cypress/e2e/auth/**/*.cy.ts",
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain("--spec");
    });

    it("should handle timeout error", async () => {
      const error = new Error("Timeout") as any;
      error.killed = true;
      error.signal = "SIGTERM";
      error.stdout = "";
      error.stderr = "";
      mockExecAsync.mockRejectedValue(error);

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
        timeout: 5000,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("timed out");
      expect(result.details?.reason).toBe("timeout");
    });
  });
});

describe("e2eStrategyExecutor singleton", () => {
  it("should be an E2EStrategyExecutor instance", () => {
    expect(e2eStrategyExecutor).toBeInstanceOf(E2EStrategyExecutor);
  });

  it("should have type 'e2e'", () => {
    expect(e2eStrategyExecutor.type).toBe("e2e");
  });
});

describe("defaultRegistry integration", () => {
  it("should have e2e executor registered", () => {
    expect(defaultRegistry.has("e2e")).toBe(true);
  });

  it("should return e2eStrategyExecutor for 'e2e' type", () => {
    const executor = defaultRegistry.get("e2e");
    expect(executor).toBe(e2eStrategyExecutor);
  });
});

describe("E2EStrategyExecutor - additional coverage", () => {
  let executor: E2EStrategyExecutor;

  beforeEach(() => {
    executor = new E2EStrategyExecutor();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("tag filtering for different frameworks", () => {
    it("should handle cypress tag filtering with --spec flag", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
        e2eInfo: {
          available: true,
          command: "npx cypress run",
          framework: "cypress",
          // No grepTemplate - will use framework-specific handling
        },
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
        tags: ["@login", "@auth"],
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain("--spec");
      expect(calledArgs[0]).toContain("@login|@auth");
    });

    it("should handle puppeteer tag filtering with --grep flag", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
        e2eInfo: {
          available: true,
          command: "npx puppeteer test",
          framework: "puppeteer",
        },
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
        tags: ["@smoke"],
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain("--grep");
    });

    it("should use default --grep for unknown frameworks", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
        e2eInfo: {
          available: true,
          command: "npx some-unknown-framework test",
          framework: "unknown",
        },
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
        tags: ["@test"],
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain("--grep");
    });
  });

  describe("pattern filtering with fileTemplate", () => {
    it("should use fileTemplate when available", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
        e2eInfo: {
          available: true,
          command: "npx playwright test",
          framework: "playwright",
          fileTemplate: "npx playwright test {files}",
        },
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
        pattern: "e2e/auth/*.spec.ts",
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toBe("npx playwright test e2e/auth/*.spec.ts");
    });

    it("should handle puppeteer pattern", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
        e2eInfo: {
          available: true,
          command: "npx puppeteer test",
          framework: "puppeteer",
        },
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
        pattern: "tests/*.test.js",
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain("tests/*.test.js");
    });

    it("should handle unknown framework pattern", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
        e2eInfo: {
          available: true,
          command: "npx custom-framework",
          framework: "unknown",
        },
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
        pattern: "test.js",
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain("test.js");
    });
  });

  describe("detectFramework", () => {
    it("should detect webdriver framework", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
        e2eInfo: {
          available: true,
          command: "npx webdriverio test",
        },
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
        tags: ["@tag"],
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
    });

    it("should detect selenium framework", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
        e2eInfo: {
          available: true,
          command: "npx selenium-webdriver test",
        },
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
        tags: ["@tag"],
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
    });

    it("should detect testcafe framework", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
        e2eInfo: {
          available: true,
          command: "npx testcafe chrome tests/",
        },
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
        tags: ["@tag"],
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
    });
  });

  describe("custom environment variables", () => {
    it("should merge custom env with CI=true", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
        e2eInfo: {
          available: true,
          command: "npx playwright test",
          framework: "playwright",
        },
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
        env: {
          CUSTOM_VAR: "custom_value",
          DEBUG: "true",
        },
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[1]?.env?.CI).toBe("true");
      expect(calledArgs[1]?.env?.CUSTOM_VAR).toBe("custom_value");
      expect(calledArgs[1]?.env?.DEBUG).toBe("true");
    });
  });

  describe("error handling edge cases", () => {
    it("should handle error with only message (no stdout/stderr)", async () => {
      const error = new Error("Unknown error");
      mockExecAsync.mockRejectedValue(error);

      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
        e2eInfo: {
          available: true,
          command: "npx playwright test",
          framework: "playwright",
        },
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toBe("Unknown error");
    });

    it("should combine stderr with stdout on failure", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
        e2eInfo: {
          available: true,
          command: "npx playwright test",
          framework: "playwright",
        },
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Test output",
        stderr: "Warning message",
      });

      const strategy: E2EVerificationStrategy = {
        type: "e2e",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.output).toContain("Test output");
      expect(result.output).toContain("Warning message");
    });
  });
});
