/**
 * Tests for init/init-script-merge.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { generateOrMergeInitScript } from "../../src/init/init-script-merge.js";

// Mock dependencies
vi.mock("node:fs/promises");
vi.mock("node:path", async () => {
  return {
    join: (...args: string[]) => args.join("/").replace(/\/+/g, "/"),
  };
});
vi.mock("../../src/init-script.js", () => ({
  generateMinimalInitScript: vi.fn(() => "#!/usr/bin/env bash\nminimal script\n"),
  generateInitScriptFromCapabilities: vi.fn(() => "#!/usr/bin/env bash\ncapabilities script\n"),
}));

vi.mock("../../src/agents.js", () => ({
  callAnyAvailableAgent: vi.fn(),
}));

vi.mock("../../src/debug.js", () => ({
  debugInit: vi.fn(),
}));

vi.mock("../../src/timeout-config.js", () => ({
  getTimeout: vi.fn(() => 60000),
}));

vi.mock("../../src/scanner/index.js", () => ({
  aiResultToSurvey: vi.fn(() => ({
    commands: {
      install: "npm install",
      dev: "npm run dev",
    },
  })),
}));

vi.mock("../../src/validation/index.js", () => ({
  validateBashScript: vi.fn(() => ({
    valid: true,
    errors: [],
    warnings: [],
  })),
  isLikelyBashScript: vi.fn(() => true),
}));

vi.mock("../../src/ui/index.js", () => ({
  createSpinner: vi.fn(() => ({
    start: vi.fn(),
    update: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
    warn: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock("chalk", () => ({
  default: {
    green: vi.fn((text) => `green(${text})`),
    gray: vi.fn((text) => `gray(${text})`),
    yellow: vi.fn((text) => `yellow(${text})`),
    red: vi.fn((text) => `red(${text})`),
  },
}));

describe("Init Script Merge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateOrMergeInitScript", () => {
    it("should generate new script when no existing script", async () => {
      const { generateInitScriptFromCapabilities } = await import("../../src/init-script.js");
      vi.mocked(generateInitScriptFromCapabilities).mockReturnValue("#!/usr/bin/env bash\nnew script\n");

      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await generateOrMergeInitScript(
        "/test",
        { testCommand: "npm test" } as any,
        { commands: {} } as any,
        "new"
      );

      expect(fs.writeFile).toHaveBeenCalledWith(
        "/test/ai/init.sh",
        "#!/usr/bin/env bash\nnew script\n"
      );
      expect(fs.chmod).toHaveBeenCalledWith("/test/ai/init.sh", 0o755);
    });

    it("should use minimal script when no capabilities or survey commands", async () => {
      const { generateMinimalInitScript } = await import("../../src/init-script.js");
      vi.mocked(generateMinimalInitScript).mockReturnValue("#!/usr/bin/env bash\nminimal\n");

      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await generateOrMergeInitScript(
        "/test",
        {} as any,
        { commands: {} } as any,
        "new"
      );

      expect(generateMinimalInitScript).toHaveBeenCalled();
    });

    it("should merge existing script in merge mode", async () => {
      const { callAnyAvailableAgent } = await import("../../src/agents.js");
      vi.mocked(callAnyAvailableAgent).mockResolvedValue({
        success: true,
        output: "#!/usr/bin/env bash\nmerged script\n",
      });

      const { isLikelyBashScript, validateBashScript } = await import("../../src/validation/index.js");
      vi.mocked(isLikelyBashScript).mockReturnValue(true);
      vi.mocked(validateBashScript).mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
      });

      vi.mocked(fs.readFile).mockResolvedValue("existing script");
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await generateOrMergeInitScript(
        "/test",
        { testCommand: "npm test" } as any,
        { commands: {} } as any,
        "merge",
        "existing script",
        true
      );

      expect(callAnyAvailableAgent).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        "/test/ai/init.sh",
        "#!/usr/bin/env bash\nmerged script\n"
      );
    });

    it("should handle AI merge failure gracefully", async () => {
      const { callAnyAvailableAgent } = await import("../../src/agents.js");
      vi.mocked(callAnyAvailableAgent).mockResolvedValue({
        success: false,
        error: "AI merge failed",
      });

      vi.mocked(fs.readFile).mockResolvedValue("existing script");

      await generateOrMergeInitScript(
        "/test",
        { testCommand: "npm test" } as any,
        { commands: {} } as any,
        "merge",
        "existing script",
        true
      );

      // Should not write file when AI merge fails
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it("should fallback when merged output doesn't look like bash script", async () => {
      const { callAnyAvailableAgent } = await import("../../src/agents.js");
      vi.mocked(callAnyAvailableAgent).mockResolvedValue({
        success: true,
        output: "not a bash script",
      });

      const { isLikelyBashScript } = await import("../../src/validation/index.js");
      vi.mocked(isLikelyBashScript).mockReturnValue(false);

      vi.mocked(fs.readFile).mockResolvedValue("existing script");

      await generateOrMergeInitScript(
        "/test",
        { testCommand: "npm test" } as any,
        { commands: {} } as any,
        "merge",
        "existing script",
        true
      );

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it("should handle validation errors and keep existing script", async () => {
      const { callAnyAvailableAgent } = await import("../../src/agents.js");
      vi.mocked(callAnyAvailableAgent).mockResolvedValue({
        success: true,
        output: "#!/usr/bin/env bash\nmerged\n",
      });

      const { isLikelyBashScript, validateBashScript } = await import("../../src/validation/index.js");
      vi.mocked(isLikelyBashScript).mockReturnValue(true);
      vi.mocked(validateBashScript).mockReturnValue({
        valid: false,
        errors: ["Syntax error"],
        warnings: [],
      });

      vi.mocked(fs.readFile).mockResolvedValue("existing script");

      await generateOrMergeInitScript(
        "/test",
        { testCommand: "npm test" } as any,
        { commands: {} } as any,
        "merge",
        "existing script",
        true
      );

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it("should log validation warnings", async () => {
      const { callAnyAvailableAgent } = await import("../../src/agents.js");
      vi.mocked(callAnyAvailableAgent).mockResolvedValue({
        success: true,
        output: "#!/usr/bin/env bash\nmerged\n",
      });

      const { isLikelyBashScript, validateBashScript } = await import("../../src/validation/index.js");
      vi.mocked(isLikelyBashScript).mockReturnValue(true);
      vi.mocked(validateBashScript).mockReturnValue({
        valid: true,
        errors: [],
        warnings: ["Warning 1", "Warning 2", "Warning 3", "Warning 4"],
      });

      vi.mocked(fs.readFile).mockResolvedValue("existing script");
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await generateOrMergeInitScript(
        "/test",
        { testCommand: "npm test" } as any,
        { commands: {} } as any,
        "merge",
        "existing script",
        true
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Warning 1")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("... and 1 more")
      );

      consoleSpy.mockRestore();
    });

    it("should use preloaded script content when provided", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await generateOrMergeInitScript(
        "/test",
        { testCommand: "npm test" } as any,
        { commands: {} } as any,
        "new",
        "preloaded script",
        true
      );

      // Should not call fs.readFile when preloadedScript is provided
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it("should use preloaded exists flag when provided", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await generateOrMergeInitScript(
        "/test",
        { testCommand: "npm test" } as any,
        { commands: {} } as any,
        "merge",
        "preloaded script",
        true
      );

      // Should attempt merge when preloadedExists is true
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it("should create ai directory if it doesn't exist", async () => {
      vi.mocked(fs.mkdir).mockImplementation(() => Promise.resolve());
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await generateOrMergeInitScript(
        "/test",
        { testCommand: "npm test" } as any,
        { commands: {} } as any,
        "new"
      );

      expect(fs.mkdir).toHaveBeenCalledWith("/test/ai", { recursive: true });
    });

    it("should handle empty existing script", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("");
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await generateOrMergeInitScript(
        "/test",
        { testCommand: "npm test" } as any,
        { commands: {} } as any,
        "merge",
        "",
        false
      );

      // Should write new script when existing is empty
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});
