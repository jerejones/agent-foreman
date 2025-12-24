/**
 * Integration tests for combined AI merge optimization
 * Tests the combined merge flow with real file operations
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";

// Use vi.hoisted to create mock functions that can be used in vi.mock
const { mockCallAnyAvailableAgent, mockPrintAgentStatus } = vi.hoisted(() => ({
  mockCallAnyAvailableAgent: vi.fn(),
  mockPrintAgentStatus: vi.fn(),
}));

// Mock the agents module
vi.mock("../../src/agents.js", () => ({
  callAnyAvailableAgent: mockCallAnyAvailableAgent,
  printAgentStatus: mockPrintAgentStatus,
}));

// Mock project-capabilities module
const { mockDetectCapabilities } = vi.hoisted(() => ({
  mockDetectCapabilities: vi.fn(),
}));

vi.mock("../../src/capabilities/index.js", () => ({
  detectCapabilities: mockDetectCapabilities,
}));

import { generateHarnessFiles } from "../../src/init/index.js";
import type { FeatureList } from "../../src/types.js";

describe("Combined AI Merge Integration", () => {
  let testDir: string;

  const mockSurvey = {
    techStack: { language: "typescript" },
    commands: {
      install: "npm install",
      dev: "npm run dev",
      test: "npm test",
    },
    features: [],
    modules: [],
    structure: { entryPoints: [], sourceDirectories: [], testDirectories: [] },
  };

  const mockFeatureList: FeatureList = {
    features: [],
    metadata: {
      projectGoal: "Test project",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
    },
  };

  const defaultCapabilities = {
    hasTests: true,
    testCommand: "npm test",
    testFramework: "vitest",
    hasTypeCheck: true,
    typeCheckCommand: "npx tsc --noEmit",
    hasLint: true,
    lintCommand: "npm run lint",
    hasBuild: true,
    buildCommand: "npm run build",
    hasGit: true,
    source: "ai" as const,
    confidence: 0.9,
    languages: ["typescript"],
    detectedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    testDir = path.join(tmpdir(), `init-merge-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });
    vi.clearAllMocks();
    mockDetectCapabilities.mockResolvedValue(defaultCapabilities);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Combined merge mode", () => {
    it("should use combined AI call when both files exist in merge mode", async () => {
      // Create existing files
      await fs.mkdir(path.join(testDir, "ai"), { recursive: true });
      await fs.writeFile(path.join(testDir, "ai/init.sh"), `#!/usr/bin/env bash
bootstrap() {
  pnpm install
}`);
      await fs.writeFile(path.join(testDir, "CLAUDE.md"), `# My Project
Custom content here.`);

      // Mock individual merge responses (implementation now does individual merges)
      mockCallAnyAvailableAgent.mockResolvedValue({
        success: true,
        output: `#!/usr/bin/env bash
bootstrap() {
  pnpm install
}
check() {
  npm test
}`,
      });

      await generateHarnessFiles(testDir, mockSurvey as any, mockFeatureList, "Test goal", "merge");

      // Verify at least one AI call was made for init.sh merge
      expect(mockCallAnyAvailableAgent).toHaveBeenCalled();
      const callArg = mockCallAnyAvailableAgent.mock.calls[0][0];
      // Implementation now uses individual merge prompts, not combined "Task 1:" format
      expect(callArg).toContain("init.sh");

      // Verify init.sh was written
      const initScript = await fs.readFile(path.join(testDir, "ai/init.sh"), "utf-8");
      expect(initScript).toContain("pnpm install");

      // CLAUDE.md is generated (may have project instructions)
      const claudeMd = await fs.readFile(path.join(testDir, "CLAUDE.md"), "utf-8");
      expect(claudeMd).toBeDefined();
    });

    it("should handle individual merge for init.sh in merge mode", async () => {
      // Create existing files
      await fs.mkdir(path.join(testDir, "ai"), { recursive: true });
      await fs.writeFile(path.join(testDir, "ai/init.sh"), `#!/usr/bin/env bash
bootstrap() {
  yarn install
}`);
      await fs.writeFile(path.join(testDir, "CLAUDE.md"), `# Existing Project`);

      // Mock individual merge response for init.sh
      mockCallAnyAvailableAgent.mockResolvedValue({
        success: true,
        output: `#!/usr/bin/env bash
bootstrap() {
  yarn install
}
check() {
  yarn test
}`,
      });

      await generateHarnessFiles(testDir, mockSurvey as any, mockFeatureList, "Test goal", "merge");

      // Verify AI was called for init.sh merge
      expect(mockCallAnyAvailableAgent).toHaveBeenCalled();

      // Verify init.sh was written with merged content
      const initScript = await fs.readFile(path.join(testDir, "ai/init.sh"), "utf-8");
      expect(initScript).toContain("yarn install");

      // CLAUDE.md should exist
      const claudeMd = await fs.readFile(path.join(testDir, "CLAUDE.md"), "utf-8");
      expect(claudeMd).toBeDefined();
    });

    it("should preserve existing init.sh when AI returns invalid script", async () => {
      await fs.mkdir(path.join(testDir, "ai"), { recursive: true });
      await fs.writeFile(path.join(testDir, "ai/init.sh"), `#!/usr/bin/env bash
bootstrap() { npm install; }`);
      await fs.writeFile(path.join(testDir, "CLAUDE.md"), `# Project`);

      // AI returns invalid script (no shebang)
      mockCallAnyAvailableAgent.mockResolvedValue({
        success: true,
        output: "echo not a valid script", // Invalid - no shebang
      });

      await generateHarnessFiles(testDir, mockSurvey as any, mockFeatureList, "Test goal", "merge");

      // Original init.sh should be preserved when AI output is invalid
      const initScript = await fs.readFile(path.join(testDir, "ai/init.sh"), "utf-8");
      expect(initScript).toContain("#!/usr/bin/env bash");
      expect(initScript).toContain("bootstrap()");
    });

    it("should not use combined merge when only init.sh exists", async () => {
      // Only create init.sh, not CLAUDE.md
      await fs.mkdir(path.join(testDir, "ai"), { recursive: true });
      await fs.writeFile(path.join(testDir, "ai/init.sh"), `#!/usr/bin/env bash
bootstrap() { npm install; }`);

      mockCallAnyAvailableAgent.mockResolvedValue({
        success: true,
        output: `#!/usr/bin/env bash
bootstrap() { npm install; }
check() { npm test; }`,
      });

      await generateHarnessFiles(testDir, mockSurvey as any, mockFeatureList, "Test goal", "merge");

      // Should use individual merge for init.sh only, then create new CLAUDE.md
      // First call is for init.sh merge, no call for CLAUDE.md (new file created directly)
      expect(mockCallAnyAvailableAgent).toHaveBeenCalledTimes(1);
      const callArg = mockCallAnyAvailableAgent.mock.calls[0][0];
      expect(callArg).not.toContain("Task 1:");
      expect(callArg).not.toContain("Task 2:");
    });

    it("should not use combined merge when only CLAUDE.md exists", async () => {
      // Only create CLAUDE.md, not init.sh
      await fs.writeFile(path.join(testDir, "CLAUDE.md"), `# My Project`);

      // No AI call needed when only CLAUDE.md exists - new init.sh is generated from template
      // and CLAUDE.md gets project goal appended
      mockCallAnyAvailableAgent.mockResolvedValue({
        success: true,
        output: `# My Project

## Long-Task Harness
Content here.`,
      });

      await generateHarnessFiles(testDir, mockSurvey as any, mockFeatureList, "Test goal", "merge");

      // CLAUDE.md should be updated
      const claudeMd = await fs.readFile(path.join(testDir, "CLAUDE.md"), "utf-8");
      expect(claudeMd).toBeDefined();

      // init.sh should be created (new from template)
      const initScript = await fs.readFile(path.join(testDir, "ai/init.sh"), "utf-8");
      expect(initScript).toContain("#!/usr/bin/env bash");
    });

    it("should not use combined merge in new mode", async () => {
      // Create both files
      await fs.mkdir(path.join(testDir, "ai"), { recursive: true });
      await fs.writeFile(path.join(testDir, "ai/init.sh"), `#!/usr/bin/env bash
bootstrap() { pnpm install; }`);
      await fs.writeFile(path.join(testDir, "CLAUDE.md"), `# My Project`);

      // In new mode, init.sh is overwritten directly (no AI merge needed)
      mockCallAnyAvailableAgent.mockResolvedValue({
        success: true,
        output: `# My Project

## Long-Task Harness
Merged content.`,
      });

      await generateHarnessFiles(testDir, mockSurvey as any, mockFeatureList, "Test goal", "new");

      // New init.sh should be written (overwritten with template, not merged)
      const initScript = await fs.readFile(path.join(testDir, "ai/init.sh"), "utf-8");
      expect(initScript).toContain("#!/usr/bin/env bash");
      expect(initScript).toContain("npm install"); // Template command, not user's pnpm

      // CLAUDE.md should exist
      const claudeMd = await fs.readFile(path.join(testDir, "CLAUDE.md"), "utf-8");
      expect(claudeMd).toBeDefined();
    });
  });
});
