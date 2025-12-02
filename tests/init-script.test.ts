/**
 * Tests for src/init-script.ts - Bootstrap script generation
 */
import { describe, it, expect } from "vitest";
import { generateInitScript, generateMinimalInitScript, generateInitScriptFromCapabilities, generateInitScriptWithTypeCheck } from "../src/init-script.js";
import type { ProjectCommands } from "../src/types.js";
import type { ExtendedCapabilities } from "../src/verification-types.js";

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

      // Should include configured commands
      expect(script).toContain("npm install");
      expect(script).toContain("npm run dev");
      expect(script).toContain("npm test");
      expect(script).toContain("npm run build");
      expect(script).toContain("npm run lint");
    });

    it("should generate script with only install command", () => {
      const commands: ProjectCommands = {
        install: "yarn install",
      };

      const script = generateInitScript(commands);

      expect(script).toContain("yarn install");
      expect(script).toContain("No dev command configured");
      expect(script).toContain("No test command configured");
      expect(script).toContain("No build command configured");
    });

    it("should generate script with only test command", () => {
      const commands: ProjectCommands = {
        test: "jest",
      };

      const script = generateInitScript(commands);

      expect(script).toContain("jest");
      expect(script).toContain("No install command configured");
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

    it("should include check function with exit code tracking", () => {
      const commands: ProjectCommands = {
        test: "npm test",
        lint: "npm run lint",
        build: "npm run build",
      };
      const script = generateInitScript(commands);

      expect(script).toContain("local exit_code=0");
      expect(script).toContain("local e2e_exit_code=0");
      // Return combined exit code for unit tests + E2E tests
      expect(script).toContain("return $(( exit_code + e2e_exit_code ))");
      // Separate failure messages for unit and E2E tests
      expect(script).toContain("Unit tests/checks failed");
      expect(script).toContain("E2E tests failed");
      expect(script).toContain("All checks passed!");
    });

    it("should include TypeScript check in check function", () => {
      const commands: ProjectCommands = {};
      const script = generateInitScript(commands);

      expect(script).toContain('if [ -f "tsconfig.json" ]');
      expect(script).toContain("npx tsc --noEmit");
      expect(script).toContain("Type check failed");
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
      expect(script).toContain("No test command configured");
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

    it("should include check function with TypeScript check", () => {
      const script = generateMinimalInitScript();

      expect(script).toContain("local exit_code=0");
      expect(script).toContain('if [ -f "tsconfig.json" ]');
      expect(script).toContain("npx tsc --noEmit");
      expect(script).toContain("Configure test/lint/build commands for full verification");
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
      expect(script).toContain("--quick");
      expect(script).toContain("Run all checks");
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

      // Full script should have actual commands
      expect(fullScript).toContain("npm install");
      expect(fullScript).toContain("npm test");
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
      expect(script).toContain("pnpm test");
      expect(script).toContain("pnpm lint");
      expect(script).toContain("pnpm build");
      expect(script).toContain("pnpm tsc --noEmit");
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
      expect(script).toContain("No test command configured");
      expect(script).toContain("No build command configured");
    });

    it("should include explicit typecheck command when provided", () => {
      const caps: ExtendedCapabilities = {
        ...baseCapabilities,
        typeCheckCommand: "mypy --strict src/",
      };

      const script = generateInitScriptFromCapabilities(caps);
      expect(script).toContain("mypy --strict src/");
      // Should NOT contain fallback tsconfig detection for typecheck
      expect(script).not.toContain('if [ -f "tsconfig.json" ]');
    });

    it("should fallback to tsconfig detection when no typecheck command", () => {
      const caps: ExtendedCapabilities = {
        ...baseCapabilities,
        typeCheckCommand: undefined,
      };

      const script = generateInitScriptFromCapabilities(caps);
      expect(script).toContain('if [ -f "tsconfig.json" ]');
      expect(script).toContain("npx tsc --noEmit");
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

    it("should include explicit typecheck command when provided", () => {
      const script = generateInitScriptWithTypeCheck(commands, "tsc --noEmit --strict");

      expect(script).toContain("tsc --noEmit --strict");
      // Should NOT contain fallback tsconfig detection
      expect(script).not.toContain('if [ -f "tsconfig.json" ]');
    });

    it("should include tsconfig fallback when no typecheck command", () => {
      const script = generateInitScriptWithTypeCheck(commands);

      expect(script).toContain('if [ -f "tsconfig.json" ]');
      expect(script).toContain("npx tsc --noEmit");
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

    it("should include quick mode handling", () => {
      const script = generateInitScriptWithTypeCheck(commands);

      expect(script).toContain("--quick");
      expect(script).toContain("quick_mode=false");
      expect(script).toContain("Quick mode: skipping type check, lint, and build");
    });

    it("should handle Python typecheck (mypy)", () => {
      const pythonCommands: ProjectCommands = {
        install: "pip install -r requirements.txt",
        test: "pytest",
      };

      const script = generateInitScriptWithTypeCheck(pythonCommands, "mypy src/");

      expect(script).toContain("mypy src/");
      expect(script).toContain("Running type check...");
    });

    it("should include E2E test section when e2eCommands provided", () => {
      const e2eCommands = {
        command: "npx playwright test",
        grepTemplate: "npx playwright test --grep {tags}",
      };

      const script = generateInitScriptWithTypeCheck(commands, undefined, e2eCommands);

      // Should include E2E mode handling
      expect(script).toContain("e2e_exit_code=0");
      expect(script).toContain("skip_e2e=false");
      expect(script).toContain("full_mode=false");
      expect(script).toContain("e2e_tags=");
      expect(script).toContain("E2E_TAGS:-");

      // Should include E2E execution branches
      expect(script).toContain('if [ "$skip_e2e" = true ]');
      expect(script).toContain("E2E tests: skipped (--skip-e2e)");
      expect(script).toContain('elif [ "$full_mode" = true ]');
      expect(script).toContain("Running E2E tests (full)...");
      expect(script).toContain('elif [ -n "$e2e_tags" ]');
      expect(script).toContain("Running E2E tests (tags:");
      expect(script).toContain("Running E2E tests (@smoke)...");

      // Should include E2E commands
      expect(script).toContain("npx playwright test");
      expect(script).toContain("npx playwright test --grep");
      expect(script).toContain("@smoke");
    });

    it("should not include E2E section when no e2eCommands", () => {
      const script = generateInitScriptWithTypeCheck(commands);

      // Should have placeholder comment
      expect(script).toContain("# No E2E tests configured");
      // Should NOT have E2E execution branches
      expect(script).not.toContain('if [ "$skip_e2e" = true ]');
      expect(script).not.toContain("Running E2E tests (full)...");
    });

    it("should include --full and --skip-e2e flags in help", () => {
      const script = generateInitScriptWithTypeCheck(commands);

      expect(script).toContain("--full");
      expect(script).toContain("--skip-e2e");
      expect(script).toContain("E2E_TAGS");
      expect(script).toContain("Run all tests including full E2E suite");
      expect(script).toContain("Skip E2E tests entirely");
    });

    it("should parse --full and --skip-e2e arguments", () => {
      const script = generateInitScriptWithTypeCheck(commands);

      expect(script).toContain("--full)");
      expect(script).toContain("full_mode=true");
      expect(script).toContain("--skip-e2e)");
      expect(script).toContain("skip_e2e=true");
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

    it("should include E2E section when e2eInfo is available", () => {
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

      expect(script).toContain("npx playwright test");
      expect(script).toContain("Running E2E tests (full)...");
      expect(script).toContain("Running E2E tests (@smoke)...");
      expect(script).toContain('if [ "$skip_e2e" = true ]');
    });

    it("should not include E2E section when e2eInfo is not available", () => {
      const capsWithoutE2E: ExtendedCapabilities = {
        ...baseCapabilities,
        e2eInfo: {
          available: false,
        },
      };

      const script = generateInitScriptFromCapabilities(capsWithoutE2E);

      expect(script).toContain("# No E2E tests configured");
      expect(script).not.toContain("Running E2E tests (full)...");
    });

    it("should use custom grep template for E2E filtering", () => {
      const capsWithCustomGrep: ExtendedCapabilities = {
        ...baseCapabilities,
        e2eInfo: {
          available: true,
          framework: "playwright",
          command: "pnpm exec playwright test",
          grepTemplate: "pnpm exec playwright test -g {tags}",
        },
      };

      const script = generateInitScriptFromCapabilities(capsWithCustomGrep);

      expect(script).toContain("pnpm exec playwright test");
      expect(script).toContain("pnpm exec playwright test -g");
    });
  });
});
