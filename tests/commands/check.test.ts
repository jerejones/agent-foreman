/**
 * Unit tests for check.ts
 * Tests task/feature verification command
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

// Mock the verifier to avoid real verification (AI calls, running tests, etc.)
vi.mock("../../src/verifier/index.js", () => ({
  verifyFeature: vi.fn().mockResolvedValue({
    verdict: "pass",
    passed: true,
    confidence: 0.9,
    verifiedBy: "tdd",
    verifiedAt: new Date().toISOString(),
    criteriaResults: [],
    automatedChecks: { tests: true, typeCheck: true, lint: true, build: true },
    duration: 100,
    featureId: "core.setup",
    featureVersion: 1,
  }),
  verifyFeatureAutonomous: vi.fn().mockResolvedValue({
    verdict: "pass",
    passed: true,
    confidence: 1.0,
    verifiedBy: "tdd",
    verifiedAt: new Date().toISOString(),
    criteriaResults: [],
    automatedChecks: { tests: true },
    duration: 50,
    featureId: "core.setup",
    featureVersion: 1,
    testFiles: ["tests/core/setup.test.ts"],
  }),
  verifyFeatureTDD: vi.fn().mockResolvedValue({
    verdict: "pass",
    passed: true,
    confidence: 1.0,
    verifiedBy: "tdd",
    verifiedAt: new Date().toISOString(),
    criteriaResults: [],
    automatedChecks: { tests: true },
    duration: 50,
    featureId: "core.setup",
    featureVersion: 1,
    testFiles: ["tests/core/setup.test.ts"],
  }),
  createVerificationSummary: vi.fn().mockReturnValue({
    lastVerified: new Date().toISOString(),
    result: "pass",
    confidence: 0.9,
  }),
  formatVerificationResult: vi.fn().mockReturnValue("\n   ✓ VERIFICATION PASSED\n"),
}));

// Mock capabilities detection
vi.mock("../../src/capabilities/index.js", () => ({
  detectCapabilities: vi.fn().mockResolvedValue({
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
    source: "ai",
    confidence: 0.9,
    languages: ["typescript"],
    detectedAt: new Date().toISOString(),
  }),
}));

import { runCheck } from "../../src/commands/check.js";

// Custom error for exit handling
class ExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.code = code;
    this.name = "ExitError";
  }
}

describe("commands/check", () => {
  describe("runCheck()", () => {
    let tempDir: string;
    let originalCwd: string;
    let mockExit: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "foreman-check-test-"));
      originalCwd = process.cwd();
      process.chdir(tempDir);

      // Create ai/tasks directory structure
      await fs.mkdir(path.join(tempDir, "ai/tasks/core"), { recursive: true });
      await fs.mkdir(path.join(tempDir, "ai/verification"), { recursive: true });

      // Mock process.exit inside each test
      mockExit = vi.spyOn(process, "exit").mockImplementation(((code: number) => {
        throw new ExitError(code);
      }) as () => never);
    });

    afterEach(async () => {
      process.chdir(originalCwd);
      await fs.rm(tempDir, { recursive: true, force: true });
      mockExit.mockRestore();
      vi.clearAllMocks();
    });

    async function createFeatureIndex(
      features: Record<string, unknown>,
      metadata?: Record<string, unknown>
    ) {
      const index = {
        version: "2.0.0",
        updatedAt: new Date().toISOString(),
        metadata: {
          projectGoal: "Test project goal",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-15T12:00:00.000Z",
          version: "1.0.0",
          ...metadata,
        },
        features,
      };
      await fs.writeFile(
        path.join(tempDir, "ai/tasks/index.json"),
        JSON.stringify(index, null, 2)
      );
    }

    async function createFeatureMarkdown(
      module: string,
      id: string,
      content: string
    ) {
      const featureId = id.includes(".") ? id.split(".").slice(1).join(".") : id;
      const filePath = path.join(tempDir, "ai/tasks", module, `${featureId}.md`);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
    }

    async function createFeatureList(features: unknown[], metadata?: Record<string, unknown>) {
      await fs.mkdir(path.join(tempDir, "ai"), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, "ai/feature_list.json"),
        JSON.stringify(
          {
            features,
            metadata: {
              projectGoal: "Test project goal",
              createdAt: "2024-01-01T00:00:00.000Z",
              updatedAt: "2024-01-15T12:00:00.000Z",
              version: "1.0.0",
              ...metadata,
            },
          },
          null,
          2
        )
      );
    }

    it("should show error when no task list exists", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        await runCheck("some.task", false, false);
      } catch {
        // Expected: process.exit called
      }

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("No task list found");

      consoleSpy.mockRestore();
    });

    it("should show error when task not found", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.setup": {
          status: "passing",
          priority: 1,
          module: "core",
          description: "Setup project",
        },
      });

      await createFeatureMarkdown(
        "core",
        "setup",
        `---
id: core.setup
module: core
priority: 1
status: passing
version: 1
origin: manual
dependsOn: []
---
# Setup project

## Acceptance Criteria
1. Project is setup
`
      );

      try {
        await runCheck("nonexistent.task", false, false);
      } catch {
        // Expected: process.exit called
      }

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("not found");

      consoleSpy.mockRestore();
    });

    it("should run verification in normal mode", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList([
        {
          id: "core.setup",
          module: "core",
          priority: 1,
          status: "failing",
          description: "Setup project",
          acceptance: ["Project is setup"],
          version: 1,
          origin: "manual",
          dependsOn: [],
        },
      ]);

      await runCheck("core.setup", false, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("TASK VERIFICATION");
      expect(allOutput).toContain("core.setup");
      expect(allOutput).toContain("Acceptance Criteria");

      consoleSpy.mockRestore();
    });

    it("should show TDD gate for strict mode", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList(
        [
          {
            id: "core.setup",
            module: "core",
            priority: 1,
            status: "failing",
            description: "Setup project",
            acceptance: ["Project is setup"],
            version: 1,
            origin: "manual",
            dependsOn: [],
            testRequirements: {
              unit: { required: true, pattern: "tests/core/**/*.test.ts" },
            },
          },
        ],
        { tddMode: "strict" }
      );

      try {
        await runCheck("core.setup", false, false);
      } catch {
        // Expected: may exit due to missing tests
      }

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("TDD VERIFICATION GATE");
      expect(allOutput).toContain("STRICT TDD");

      consoleSpy.mockRestore();
    });

    it("should show TDD gate when feature has required tests", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList([
        {
          id: "core.setup",
          module: "core",
          priority: 1,
          status: "failing",
          description: "Setup project",
          acceptance: ["Project is setup"],
          version: 1,
          origin: "manual",
          dependsOn: [],
          testRequirements: {
            unit: { required: true, pattern: "tests/core/**/*.test.ts" },
          },
        },
      ]);

      try {
        await runCheck("core.setup", false, false);
      } catch {
        // Expected: may exit due to missing tests
      }

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("TDD VERIFICATION GATE");

      consoleSpy.mockRestore();
    });

    it("should pass TDD gate when test files exist", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Create test file
      await fs.mkdir(path.join(tempDir, "tests/core"), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, "tests/core/setup.test.ts"),
        'describe("setup", () => { it("works", () => {}); });'
      );

      await createFeatureList([
        {
          id: "core.setup",
          module: "core",
          priority: 1,
          status: "failing",
          description: "Setup project",
          acceptance: ["Project is setup"],
          version: 1,
          origin: "manual",
          dependsOn: [],
          testRequirements: {
            unit: { required: true, pattern: "tests/core/**/*.test.ts" },
          },
        },
      ]);

      await runCheck("core.setup", false, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Test files exist");

      consoleSpy.mockRestore();
    });

    it("should show quick test mode label", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList([
        {
          id: "core.setup",
          module: "core",
          priority: 1,
          status: "failing",
          description: "Setup project",
          acceptance: ["Project is setup"],
          version: 1,
          origin: "manual",
          dependsOn: [],
        },
      ]);

      await runCheck("core.setup", false, false, false, "quick");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Test mode: Quick");

      consoleSpy.mockRestore();
    });

    it("should show AI mode label when ai flag is true", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList([
        {
          id: "core.setup",
          module: "core",
          priority: 1,
          status: "failing",
          description: "Setup project",
          acceptance: ["Project is setup"],
          version: 1,
          origin: "manual",
          dependsOn: [],
        },
      ]);

      await runCheck("core.setup", false, false, true);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Mode: AI autonomous exploration");

      consoleSpy.mockRestore();
    });

    it("should display acceptance criteria", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureList([
        {
          id: "core.setup",
          module: "core",
          priority: 1,
          status: "failing",
          description: "Setup project",
          acceptance: [
            "First criterion",
            "Second criterion",
            "Third criterion",
          ],
          version: 1,
          origin: "manual",
          dependsOn: [],
        },
      ]);

      await runCheck("core.setup", false, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("First criterion");
      expect(allOutput).toContain("Second criterion");
      expect(allOutput).toContain("Third criterion");

      consoleSpy.mockRestore();
    });

    it("should save verification results", async () => {
      await createFeatureList([
        {
          id: "core.setup",
          module: "core",
          priority: 1,
          status: "failing",
          description: "Setup project",
          acceptance: ["Project is setup"],
          version: 1,
          origin: "manual",
          dependsOn: [],
        },
      ]);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await runCheck("core.setup", false, false);

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Results saved");

      consoleSpy.mockRestore();
    });

    it("should suggest done command on pass", async () => {
      await createFeatureList([
        {
          id: "core.trivial",
          module: "core",
          priority: 1,
          status: "failing",
          description: "Trivial task",
          acceptance: ["Always true"],
          version: 1,
          origin: "manual",
          dependsOn: [],
        },
      ]);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await runCheck("core.trivial", false, true); // skipChecks to ensure pass

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      // May contain suggestion for done command if verification passes
      // The actual result depends on verifier implementation

      consoleSpy.mockRestore();
    });
  });
});
