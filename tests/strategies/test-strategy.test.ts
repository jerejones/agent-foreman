/**
 * Tests for TestStrategyExecutor
 * Universal Verification Strategy (UVS) Phase 3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Feature } from "../../src/types.js";
import type { TestVerificationStrategy } from "../../src/verifier/types/index.js";

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
import { TestStrategyExecutor, testStrategyExecutor } from "../../src/strategies/test-strategy.js";
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

describe("TestStrategyExecutor", () => {
  let executor: TestStrategyExecutor;

  beforeEach(() => {
    executor = new TestStrategyExecutor();
    vi.clearAllMocks();

    // Default mock: vitest available
    mockDetectCapabilities.mockResolvedValue({
      hasTests: true,
      testCommand: "npx vitest run",
      hasTypeCheck: false,
      hasLint: false,
      hasBuild: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("type property", () => {
    it("should have type 'test'", () => {
      expect(executor.type).toBe("test");
    });
  });

  describe("execute", () => {
    it("should execute test command successfully", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "All tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.output).toContain("All tests passed");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should return failure when no test framework detected", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: false,
        testCommand: undefined,
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("No test framework detected");
      expect(result.details?.reason).toBe("no-test-framework");
    });

    it("should handle test failures", async () => {
      const error = new Error("Test failed") as any;
      error.code = 1;
      error.stdout = "1 test failed";
      error.stderr = "";
      mockExecAsync.mockRejectedValue(error);

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.exitCode).toBe(1);
    });

    it("should support selective test execution via pattern", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
        pattern: "tests/auth/**/*.test.ts",
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain("tests/auth/**/*.test.ts");
    });

    it("should support filtering by cases for vitest", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
        cases: ["should login", "should logout"],
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain("-t");
      expect(calledArgs[0]).toContain("should login|should logout");
    });

    it("should use custom timeout from strategy", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
        timeout: 30000,
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[1]?.timeout).toBe(30000);
    });

    it("should use default timeout of 60000ms", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[1]?.timeout).toBe(60000);
    });

    it("should include CI=true in environment", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[1]?.env?.CI).toBe("true");
    });

    it("should include custom env variables", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
        env: { CUSTOM_VAR: "custom_value" },
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[1]?.env?.CUSTOM_VAR).toBe("custom_value");
    });

    it("should return strategy result with details", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "10 tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
        pattern: "tests/**/*.test.ts",
        cases: ["should work"],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.command).toBeDefined();
      expect(result.details?.pattern).toBe("tests/**/*.test.ts");
      expect(result.details?.cases).toEqual(["should work"]);
    });

    it("should handle jest framework", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        testCommand: "npx jest",
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
        pattern: "tests/auth/**/*.test.ts",
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain("--testPathPattern=");
    });
  });
});

describe("testStrategyExecutor singleton", () => {
  it("should be a TestStrategyExecutor instance", () => {
    expect(testStrategyExecutor).toBeInstanceOf(TestStrategyExecutor);
  });

  it("should have type 'test'", () => {
    expect(testStrategyExecutor.type).toBe("test");
  });
});

describe("defaultRegistry integration", () => {
  it("should have test executor registered", () => {
    expect(defaultRegistry.has("test")).toBe(true);
  });

  it("should return testStrategyExecutor for 'test' type", () => {
    const executor = defaultRegistry.get("test");
    expect(executor).toBe(testStrategyExecutor);
  });
});

describe("TestStrategyExecutor - additional coverage", () => {
  let executor: TestStrategyExecutor;

  beforeEach(() => {
    executor = new TestStrategyExecutor();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("buildSelectiveCommand for different frameworks", () => {
    it("should handle mocha framework with pattern", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        testCommand: "npx mocha",
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
        pattern: "tests/**/*.spec.js",
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain('"tests/**/*.spec.js"');
    });

    it("should handle pytest framework with pattern", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        testCommand: "pytest",
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
        pattern: "tests/test_auth.py",
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain("tests/test_auth.py");
    });

    it("should handle go test framework with pattern", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        testCommand: "go test ./...",
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
        pattern: "TestAuth",
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain('-run "TestAuth"');
    });

    it("should handle unknown framework with pattern", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        testCommand: "npm run custom-test",
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
        pattern: "tests/*.ts",
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain("tests/*.ts");
    });
  });

  describe("addCaseFilter for different frameworks", () => {
    it("should handle mocha framework with cases using --grep", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        testCommand: "npx mocha",
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
        cases: ["should authenticate", "should reject invalid"],
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain("--grep");
      expect(calledArgs[0]).toContain("should authenticate|should reject invalid");
    });

    it("should handle pytest framework with cases using -k", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        testCommand: "pytest",
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
        cases: ["test_login", "test_logout"],
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain("-k");
      expect(calledArgs[0]).toContain("test_login|test_logout");
    });

    it("should handle go test framework with cases using -run", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        testCommand: "go test ./...",
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
        cases: ["TestLogin", "TestLogout"],
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain("-run");
      expect(calledArgs[0]).toContain("TestLogin|TestLogout");
    });

    it("should handle jest framework with cases using -t", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        testCommand: "npx jest",
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
        cases: ["should work", "should fail gracefully"],
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain("-t");
      expect(calledArgs[0]).toContain("should work|should fail gracefully");
    });

    it("should not add case filter for unknown framework", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        testCommand: "npm run custom-test",
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
        cases: ["some case"],
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      // Unknown framework doesn't add case filter
      expect(calledArgs[0]).toBe("npm run custom-test");
    });
  });

  describe("detectFramework", () => {
    it("should detect cargo test framework", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        testCommand: "cargo test",
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Tests passed",
        stderr: "",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
        pattern: "test_auth",
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      // Cargo test is detected but falls through to default handling
    });
  });

  describe("timeout handling", () => {
    it("should handle timeout error correctly", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        testCommand: "npx vitest run",
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
      });

      const error = new Error("Timeout") as any;
      error.killed = true;
      error.signal = "SIGTERM";
      error.stdout = "Partial output";
      error.stderr = "";
      mockExecAsync.mockRejectedValue(error);

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
        timeout: 5000,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("timed out");
      expect(result.output).toContain("5000ms");
      expect(result.details?.reason).toBe("timeout");
    });
  });

  describe("error handling", () => {
    it("should use error message when no stdout/stderr", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        testCommand: "npx vitest run",
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
      });

      const error = new Error("Unknown error");
      mockExecAsync.mockRejectedValue(error);

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toBe("Unknown error");
    });

    it("should combine stdout and stderr on success", async () => {
      mockDetectCapabilities.mockResolvedValue({
        hasTests: true,
        testCommand: "npx vitest run",
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
      });

      mockExecAsync.mockResolvedValue({
        stdout: "Test output",
        stderr: "Warning message",
      });

      const strategy: TestVerificationStrategy = {
        type: "test",
        required: true,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.output).toContain("Test output");
      expect(result.output).toContain("Warning message");
    });
  });
});
