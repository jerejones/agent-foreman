/**
 * Unit tests for cli-commands.ts
 * Tests CLI command registration functions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import yargs from "yargs";

// Mock all command handlers to prevent execution
vi.mock("../../src/commands/init.js", () => ({ runInit: vi.fn() }));
vi.mock("../../src/commands/next.js", () => ({ runNext: vi.fn() }));
vi.mock("../../src/commands/status.js", () => ({ runStatus: vi.fn() }));
vi.mock("../../src/commands/impact.js", () => ({ runImpact: vi.fn() }));
vi.mock("../../src/commands/check.js", () => ({ runCheck: vi.fn() }));
vi.mock("../../src/commands/done.js", () => ({ runDone: vi.fn() }));
vi.mock("../../src/commands/install.js", () => ({ runInstall: vi.fn() }));
vi.mock("../../src/commands/uninstall.js", () => ({ runUninstall: vi.fn() }));
vi.mock("../../src/commands/utils.js", () => ({ detectProjectGoal: vi.fn() }));
vi.mock("../../src/agents.js", () => ({ printAgentStatus: vi.fn() }));

import {
  registerInitCommand,
  registerNextCommand,
  registerStatusCommand,
  registerImpactCommand,
  registerDoneCommand,
  registerCheckCommand,
  registerUtilityCommands,
  registerInstallCommand,
  registerUninstallCommand,
} from "../../src/commands/cli-commands.js";

describe("commands/cli-commands", () => {
  let testYargs: ReturnType<typeof yargs>;

  beforeEach(() => {
    // Configure yargs to not exit process during testing
    testYargs = yargs([]).fail(false).exitProcess(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper to safely parse args - handlers are mocked so won't execute
  async function parseCommand(yargsInstance: ReturnType<typeof yargs>, args: string[]) {
    return yargsInstance.fail(false).exitProcess(false).parse(args);
  }

  describe("registerInitCommand()", () => {
    it("should register the init command", async () => {
      const result = registerInitCommand(testYargs);
      expect(result).toBeDefined();
      const parsed = await parseCommand(result, ["init"]);
      expect(parsed._[0]).toBe("init");
    });

    it("should have mode option with choices", async () => {
      const result = registerInitCommand(testYargs);
      const parsed = await parseCommand(result, ["init", "--mode", "new"]);
      expect(parsed.mode).toBe("new");
    });

    it("should have task-type option", async () => {
      const result = registerInitCommand(testYargs);
      const parsed = await parseCommand(result, ["init", "--task-type", "code"]);
      expect(parsed.taskType).toBe("code");
    });
  });

  describe("registerNextCommand()", () => {
    it("should register the next command", async () => {
      const result = registerNextCommand(testYargs);
      expect(result).toBeDefined();
      const parsed = await parseCommand(result, ["next"]);
      expect(parsed._[0]).toBe("next");
    });

    it("should have feature_id positional argument", async () => {
      const result = registerNextCommand(testYargs);
      const parsed = await parseCommand(result, ["next", "core.setup"]);
      expect(parsed.feature_id).toBe("core.setup");
    });

    it("should have dry-run option", async () => {
      const result = registerNextCommand(testYargs);
      const parsed = await parseCommand(result, ["next", "--dry-run"]);
      expect(parsed.dryRun).toBe(true);
    });

    it("should have json output option", async () => {
      const result = registerNextCommand(testYargs);
      const parsed = await parseCommand(result, ["next", "--json"]);
      expect(parsed.json).toBe(true);
    });

    it("should have quiet option", async () => {
      const result = registerNextCommand(testYargs);
      const parsed = await parseCommand(result, ["next", "--quiet"]);
      expect(parsed.quiet).toBe(true);
    });

    it("should have allow-dirty option", async () => {
      const result = registerNextCommand(testYargs);
      const parsed = await parseCommand(result, ["next", "--allow-dirty"]);
      expect(parsed.allowDirty).toBe(true);
    });
  });

  describe("registerStatusCommand()", () => {
    it("should register the status command", async () => {
      const result = registerStatusCommand(testYargs);
      expect(result).toBeDefined();
      const parsed = await parseCommand(result, ["status"]);
      expect(parsed._[0]).toBe("status");
    });

    it("should have json option", async () => {
      const result = registerStatusCommand(testYargs);
      const parsed = await parseCommand(result, ["status", "--json"]);
      expect(parsed.json).toBe(true);
    });

    it("should have quiet option", async () => {
      const result = registerStatusCommand(testYargs);
      const parsed = await parseCommand(result, ["status", "-q"]);
      expect(parsed.quiet).toBe(true);
    });
  });

  describe("registerImpactCommand()", () => {
    it("should register the impact command", async () => {
      const result = registerImpactCommand(testYargs);
      expect(result).toBeDefined();
      const parsed = await parseCommand(result, ["impact", "test"]);
      expect(parsed._[0]).toBe("impact");
    });

    it("should require feature_id argument", async () => {
      const result = registerImpactCommand(testYargs);
      const parsed = await parseCommand(result, ["impact", "core.feature"]);
      expect(parsed.feature_id).toBe("core.feature");
    });
  });

  describe("registerDoneCommand()", () => {
    it("should register the done command", async () => {
      const result = registerDoneCommand(testYargs);
      expect(result).toBeDefined();
      const parsed = await parseCommand(result, ["done", "test"]);
      expect(parsed._[0]).toBe("done");
    });

    it("should require feature_id argument", async () => {
      const result = registerDoneCommand(testYargs);
      const parsed = await parseCommand(result, ["done", "test.feature"]);
      expect(parsed.feature_id).toBe("test.feature");
    });

    it("should have notes option", async () => {
      const result = registerDoneCommand(testYargs);
      const parsed = await parseCommand(result, ["done", "test.feature", "--notes", "Added tests"]);
      expect(parsed.notes).toBe("Added tests");
    });

    it("should have skip-check option defaulting to true", async () => {
      const result = registerDoneCommand(testYargs);
      const parsed = await parseCommand(result, ["done", "test.feature"]);
      expect(parsed.skipCheck).toBe(true);
    });

    it("should have loop option defaulting to true", async () => {
      const result = registerDoneCommand(testYargs);
      const parsed = await parseCommand(result, ["done", "test.feature"]);
      expect(parsed.loop).toBe(true);
    });

    it("should have full test option", async () => {
      const result = registerDoneCommand(testYargs);
      const parsed = await parseCommand(result, ["done", "test.feature", "--full"]);
      expect(parsed.full).toBe(true);
    });
  });

  describe("registerCheckCommand()", () => {
    it("should register the check command", async () => {
      const result = registerCheckCommand(testYargs);
      expect(result).toBeDefined();
      const parsed = await parseCommand(result, ["check", "test"]);
      expect(parsed._[0]).toBe("check");
    });

    it("should require feature_id argument", async () => {
      const result = registerCheckCommand(testYargs);
      const parsed = await parseCommand(result, ["check", "auth.login"]);
      expect(parsed.feature_id).toBe("auth.login");
    });

    it("should have verbose option", async () => {
      const result = registerCheckCommand(testYargs);
      const parsed = await parseCommand(result, ["check", "auth.login", "-v"]);
      expect(parsed.verbose).toBe(true);
    });

    it("should have quick option defaulting to true", async () => {
      const result = registerCheckCommand(testYargs);
      const parsed = await parseCommand(result, ["check", "auth.login"]);
      expect(parsed.quick).toBe(true);
    });

    it("should have skip-e2e option", async () => {
      const result = registerCheckCommand(testYargs);
      const parsed = await parseCommand(result, ["check", "auth.login", "--skip-e2e"]);
      expect(parsed.skipE2e).toBe(true);
    });
  });

  describe("registerUtilityCommands()", () => {
    it("should register agents command", async () => {
      const result = registerUtilityCommands(testYargs);
      expect(result).toBeDefined();
      const parsed = await parseCommand(result, ["agents"]);
      expect(parsed._[0]).toBe("agents");
    });
  });

  describe("registerInstallCommand()", () => {
    it("should register the install command", async () => {
      const result = registerInstallCommand(testYargs);
      expect(result).toBeDefined();
      const parsed = await parseCommand(result, ["install"]);
      expect(parsed._[0]).toBe("install");
    });

    it("should have force option", async () => {
      const result = registerInstallCommand(testYargs);
      const parsed = await parseCommand(result, ["install", "--force"]);
      expect(parsed.force).toBe(true);
    });
  });

  describe("registerUninstallCommand()", () => {
    it("should register the uninstall command", async () => {
      const result = registerUninstallCommand(testYargs);
      expect(result).toBeDefined();
      const parsed = await parseCommand(result, ["uninstall"]);
      expect(parsed._[0]).toBe("uninstall");
    });
  });
});
