/**
 * Tests for src/init-script.ts - Bootstrap script generation
 *
 * Note: The check() function now delegates to agent-foreman check
 * instead of running tests/lint/build directly. This is the new architecture
 * where init.sh is a thin wrapper and all verification logic is centralized
 * in agent-foreman check.
 */
import { describe, it, expect } from "vitest";
import { generateInitScript, generateMinimalInitScript, generateInitScriptFromCapabilities, generateInitScriptWithTypeCheck } from "../src/init-script.js";
import type { ProjectCommands } from "../src/types.js";
import type { ExtendedCapabilities } from "../src/verifier/types/index.js";

describe("Init Script", () => {
  describe("generateInitScript", () => {
    it("should generate script with all commands configured", () => {
      const commands: ProjectCommands = {
        install: "npm install",
        dev: "npm run dev",
        test: "npm test",
        build: "npm run build",
        lint: "npm run lint",
      };

      const script = generateInitScript(commands);

      // Should include shebang and header
      expect(script).toContain("#!/usr/bin/env bash");
      expect(script).toContain("# ai/init.sh - Bootstrap script for agent-foreman harness");
      expect(script).toContain("set -euo pipefail");

      // Should include configured commands for bootstrap, dev, and build
      expect(script).toContain("npm install");
      expect(script).toContain("npm run dev");
      expect(script).toContain("npm run build");
      // Note: test and lint are now handled by agent-foreman check delegation
    });

    it("should generate script with only install command", () => {
      const commands: ProjectCommands = {
        install: "yarn install",
      };

      const script = generateInitScript(commands);

      expect(script).toContain("yarn install");
      expect(script).toContain("No dev command configured");
      expect(script).toContain("No build command configured");
    });

    it("should include all required shell functions", () => {
      const commands: ProjectCommands = {};
      const script = generateInitScript(commands);

      // Required functions
      expect(script).toContain("bootstrap()");
      expect(script).toContain("dev()");
      expect(script).toContain("check()");
      expect(script).toContain("build()");
      expect(script).toContain("status()");
      expect(script).toContain("show_help()");
    });

    it("should include main case statement with all commands", () => {
      const commands: ProjectCommands = {};
      const script = generateInitScript(commands);

      // Main case statement
      expect(script).toContain('case "${1:-help}" in');
      expect(script).toContain("bootstrap)");
      expect(script).toContain("dev)");
      expect(script).toContain("check)");
      expect(script).toContain("build)");
      expect(script).toContain("status)");
      expect(script).toContain("help|--help|-h)");
    });

    it("should include color output helpers", () => {
      const commands: ProjectCommands = {};
      const script = generateInitScript(commands);

      expect(script).toContain("RED=");
      expect(script).toContain("GREEN=");
      expect(script).toContain("YELLOW=");
      expect(script).toContain("NC=");
      expect(script).toContain("log_info()");
      expect(script).toContain("log_warn()");
      expect(script).toContain("log_error()");
    });

    it("should include status function with feature list parsing", () => {
      const commands: ProjectCommands = {};
      const script = generateInitScript(commands);

      expect(script).toContain("ai/feature_list.json");
      expect(script).toContain("jq '.features | length'");
      expect(script).toContain('select(.status == "passing")');
      expect(script).toContain('select(.status == "failing")');
      expect(script).toContain('select(.status == "needs_review")');
    });

    it("should include check function that delegates to agent-foreman", () => {
      const commands: ProjectCommands = {
        test: "npm test",
        lint: "npm run lint",
        build: "npm run build",
      };
      const script = generateInitScript(commands);

      // New delegation behavior
      expect(script).toContain("agent-foreman check");
      expect(script).toContain("Running verification via agent-foreman");
      expect(script).toContain("agent-foreman not found");
    });

    it("should include progress log in status function", () => {
      const commands: ProjectCommands = {};
      const script = generateInitScript(commands);

      expect(script).toContain('if [ -f "ai/progress.log" ]');
      expect(script).toContain("tail -5 ai/progress.log");
    });

    it("should handle empty commands gracefully", () => {
      const commands: ProjectCommands = {};
      const script = generateInitScript(commands);

      // Should still generate valid script
      expect(script).toContain("#!/usr/bin/env bash");
      expect(script).toContain("No install command configured");
      expect(script).toContain("No dev command configured");
      expect(script).toContain("No build command configured");
    });

    it("should properly escape shell variables", () => {
      const commands: ProjectCommands = {};
      const script = generateInitScript(commands);

      // Escaped variables for bash output
      expect(script).toContain("${GREEN}");
      expect(script).toContain("${NC}");
      expect(script).toContain("$1");
    });
  });

  describe("generateMinimalInitScript", () => {
    it("should generate a valid minimal script", () => {
      const script = generateMinimalInitScript();

      expect(script).toContain("#!/usr/bin/env bash");
      expect(script).toContain("# ai/init.sh - Bootstrap script for agent-foreman harness");
      expect(script).toContain("set -euo pipefail");
    });

    it("should include all required shell functions", () => {
      const script = generateMinimalInitScript();

      expect(script).toContain("bootstrap()");
      expect(script).toContain("dev()");
      expect(script).toContain("check()");
      expect(script).toContain("build()");
      expect(script).toContain("status()");
      expect(script).toContain("show_help()");
    });

    it("should include TODO comments for unconfigured commands", () => {
      const script = generateMinimalInitScript();

      expect(script).toContain("# TODO: Add your install command");
      expect(script).toContain("# TODO: Add your dev command");
      expect(script).toContain("# TODO: Add your build command");
    });

    it("should include placeholder messages", () => {
      const script = generateMinimalInitScript();

      expect(script).toContain("Please configure install command in this script");
      expect(script).toContain("Please configure dev command in this script");
      expect(script).toContain("Please configure build command in this script");
    });

    it("should include main case statement with all commands", () => {
      const script = generateMinimalInitScript();

      expect(script).toContain('case "${1:-help}" in');
      expect(script).toContain("bootstrap)");
      expect(script).toContain("dev)");
      expect(script).toContain("check)");
      expect(script).toContain("build)");
      expect(script).toContain("status)");
    });

    it("should include color output helpers", () => {
      const script = generateMinimalInitScript();

      expect(script).toContain("RED=");
      expect(script).toContain("GREEN=");
      expect(script).toContain("YELLOW=");
      expect(script).toContain("NC=");
    });

    it("should include check function that delegates to agent-foreman", () => {
      const script = generateMinimalInitScript();

      // New delegation behavior
      expect(script).toContain("agent-foreman check");
      expect(script).toContain("Running verification via agent-foreman");
      expect(script).toContain("agent-foreman not found");
    });

    it("should include status function with jq conditional", () => {
      const script = generateMinimalInitScript();

      expect(script).toContain("ai/feature_list.json");
      expect(script).toContain("command -v jq");
      expect(script).toContain("jq '.features | length'");
    });

    it("should include help function with command descriptions", () => {
      const script = generateMinimalInitScript();

      expect(script).toContain("Usage: ./ai/init.sh <command>");
      expect(script).toContain("bootstrap");
      expect(script).toContain("Install dependencies");
      expect(script).toContain("dev");
      expect(script).toContain("Start development server");
      expect(script).toContain("check");
      // New help text for check command
      expect(script).toContain("Run verification (delegates to agent-foreman check)");
      expect(script).toContain("--ai");
      expect(script).toContain("--full");
      expect(script).toContain("build");
      expect(script).toContain("Build for production");
      expect(script).toContain("status");
      expect(script).toContain("Show project status");
      expect(script).toContain("help");
      expect(script).toContain("Show this help message");
    });

    it("should include unknown command error handling", () => {
      const script = generateMinimalInitScript();

      expect(script).toContain("Unknown command:");
      expect(script).toContain("exit 1");
    });
  });

  describe("script comparison", () => {
    it("should generate different scripts for full vs minimal", () => {
      const fullScript = generateInitScript({
        install: "npm install",
        test: "npm test",
      });
      const minimalScript = generateMinimalInitScript();

      // Minimal script should have TODO comments, full script should not
      expect(minimalScript).toContain("# TODO:");
      expect(fullScript).not.toContain("# TODO:");

      // Full script should have actual install command
      expect(fullScript).toContain("npm install");
    });

    it("should have same structure for both scripts", () => {
      const fullScript = generateInitScript({});
      const minimalScript = generateMinimalInitScript();

      // Both should have the same basic structure
      const requiredFunctions = [
        "bootstrap()",
        "dev()",
        "check()",
        "build()",
        "status()",
        "show_help()",
      ];

      for (const func of requiredFunctions) {
        expect(fullScript).toContain(func);
        expect(minimalScript).toContain(func);
      }
    });
  });

  describe("generateInitScriptFromCapabilities", () => {
    const baseCapabilities: ExtendedCapabilities = {
      hasTests: true,
      testCommand: "pnpm test",
      testFramework: "vitest",
      hasTypeCheck: true,
      typeCheckCommand: "pnpm tsc --noEmit",
      hasLint: true,
      lintCommand: "pnpm lint",
      hasBuild: true,
      buildCommand: "pnpm build",
      hasGit: true,
      source: "ai" as const,
      confidence: 0.95,
      languages: ["typescript"],
      detectedAt: new Date().toISOString(),
    };

    it("should generate script using capabilities commands", () => {
      const script = generateInitScriptFromCapabilities(baseCapabilities);

      expect(script).toContain("#!/usr/bin/env bash");
      // Build command is still used in the build() function
      expect(script).toContain("pnpm build");
      // Check function delegates to agent-foreman
      expect(script).toContain("agent-foreman check");
    });

    it("should use fallback install command when not provided", () => {
      const script = generateInitScriptFromCapabilities(baseCapabilities);

      // Default install command for npm (no package manager in testInfo)
      expect(script).toContain("npm install");
    });

    it("should use fallback commands when provided", () => {
      const script = generateInitScriptFromCapabilities(baseCapabilities, {
        install: "yarn install",
        dev: "yarn dev",
      });

      expect(script).toContain("yarn install");
      expect(script).toContain("yarn dev");
    });

    it("should derive install command from packageManager in testInfo", () => {
      const capsWithPnpm: ExtendedCapabilities = {
        ...baseCapabilities,
        testInfo: {
          command: "pnpm test",
          packageManager: "pnpm",
        },
      };

      const script = generateInitScriptFromCapabilities(capsWithPnpm);
      expect(script).toContain("pnpm install");
      expect(script).toContain("pnpm dev");
    });

    it("should handle different package managers", () => {
      const testCases = [
        { packageManager: "npm", install: "npm install", dev: "npm run dev" },
        { packageManager: "pnpm", install: "pnpm install", dev: "pnpm dev" },
        { packageManager: "yarn", install: "yarn install", dev: "yarn dev" },
        { packageManager: "bun", install: "bun install", dev: "bun dev" },
        { packageManager: "pip", install: "pip install -r requirements.txt", dev: "npm run dev" },
        { packageManager: "cargo", install: "cargo build", dev: "cargo run" },
        { packageManager: "go", install: "go mod download", dev: "go run ." },
      ];

      for (const { packageManager, install, dev } of testCases) {
        const caps: ExtendedCapabilities = {
          ...baseCapabilities,
          testInfo: {
            command: "test",
            packageManager,
          },
        };

        const script = generateInitScriptFromCapabilities(caps);
        expect(script).toContain(install);
        expect(script).toContain(dev);
      }
    });

    it("should handle missing capabilities gracefully", () => {
      const minimalCaps: ExtendedCapabilities = {
        hasTests: false,
        hasTypeCheck: false,
        hasLint: false,
        hasBuild: false,
        hasGit: true,
        source: "ai" as const,
        confidence: 0.5,
        languages: [],
        detectedAt: new Date().toISOString(),
      };

      const script = generateInitScriptFromCapabilities(minimalCaps);

      expect(script).toContain("#!/usr/bin/env bash");
      expect(script).toContain("No build command configured");
      // Check delegates to agent-foreman regardless of capabilities
      expect(script).toContain("agent-foreman check");
    });

    it("should delegate to agent-foreman check regardless of typecheck command", () => {
      const caps: ExtendedCapabilities = {
        ...baseCapabilities,
        typeCheckCommand: "mypy --strict src/",
      };

      const script = generateInitScriptFromCapabilities(caps);
      // Check function delegates - doesn't run typecheck directly
      expect(script).toContain("agent-foreman check");
    });
  });

  describe("generateInitScriptWithTypeCheck", () => {
    const commands: ProjectCommands = {
      install: "npm install",
      dev: "npm run dev",
      test: "npm test",
      build: "npm run build",
      lint: "npm run lint",
    };

    it("should delegate to agent-foreman check regardless of typecheck command", () => {
      const script = generateInitScriptWithTypeCheck(commands, "tsc --noEmit --strict");

      // Check function delegates to agent-foreman
      expect(script).toContain("agent-foreman check");
      expect(script).toContain("Running verification via agent-foreman");
    });

    it("should include all required functions", () => {
      const script = generateInitScriptWithTypeCheck(commands, "tsc --noEmit");

      expect(script).toContain("bootstrap()");
      expect(script).toContain("dev()");
      expect(script).toContain("check()");
      expect(script).toContain("build()");
      expect(script).toContain("status()");
      expect(script).toContain("show_help()");
    });

    it("should include help with --ai and --full flags", () => {
      const script = generateInitScriptWithTypeCheck(commands);

      expect(script).toContain("--ai");
      expect(script).toContain("--full");
      expect(script).toContain("--verbose");
    });
  });

  describe("E2E integration with generateInitScriptFromCapabilities", () => {
    const baseCapabilities: ExtendedCapabilities = {
      hasTests: true,
      testCommand: "pnpm test",
      testFramework: "vitest",
      hasTypeCheck: true,
      typeCheckCommand: "pnpm tsc --noEmit",
      hasLint: true,
      lintCommand: "pnpm lint",
      hasBuild: true,
      buildCommand: "pnpm build",
      hasGit: true,
      source: "ai" as const,
      confidence: 0.95,
      languages: ["typescript"],
      detectedAt: new Date().toISOString(),
    };

    it("should delegate to agent-foreman check regardless of e2eInfo", () => {
      const capsWithE2E: ExtendedCapabilities = {
        ...baseCapabilities,
        e2eInfo: {
          available: true,
          framework: "playwright",
          command: "npx playwright test",
          grepTemplate: "npx playwright test --grep {tags}",
        },
      };

      const script = generateInitScriptFromCapabilities(capsWithE2E);

      // Check function delegates to agent-foreman - doesn't run E2E directly
      expect(script).toContain("agent-foreman check");
      expect(script).toContain("Running verification via agent-foreman");
    });

    it("should still delegate to agent-foreman even when e2eInfo is not available", () => {
      const capsWithoutE2E: ExtendedCapabilities = {
        ...baseCapabilities,
        e2eInfo: {
          available: false,
        },
      };

      const script = generateInitScriptFromCapabilities(capsWithoutE2E);

      // Check function still delegates
      expect(script).toContain("agent-foreman check");
    });
  });
});
