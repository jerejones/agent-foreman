/**
 * Unit tests for impact.ts
 * Tests task/feature impact analysis
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import { runImpact } from "../../src/commands/impact.js";

describe("commands/impact", () => {
  describe("runImpact()", () => {
    let tempDir: string;
    let originalCwd: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "foreman-impact-test-"));
      originalCwd = process.cwd();
      process.chdir(tempDir);

      // Create ai/tasks directory structure
      await fs.mkdir(path.join(tempDir, "ai/tasks/core"), { recursive: true });
      await fs.mkdir(path.join(tempDir, "ai/tasks/auth"), { recursive: true });
    });

    afterEach(async () => {
      process.chdir(originalCwd);
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    async function createFeatureIndex(features: Record<string, unknown>) {
      const index = {
        version: "2.0.0",
        updatedAt: new Date().toISOString(),
        metadata: {
          projectGoal: "Test project",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: "1.0.0",
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
      const filePath = path.join(
        tempDir,
        "ai/tasks",
        module,
        `${featureId}.md`
      );
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
    }

    it("should show error when no task list exists", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await runImpact("some.task");

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

      await runImpact("nonexistent.task");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("not found");

      consoleSpy.mockRestore();
    });

    it("should find dependent tasks", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.setup": {
          status: "passing",
          priority: 1,
          module: "core",
          description: "Setup project",
        },
        "core.build": {
          status: "failing",
          priority: 2,
          module: "core",
          description: "Build project",
        },
      });

      // core.setup - the target task
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

      // core.build - depends on core.setup
      await createFeatureMarkdown(
        "core",
        "build",
        `---
id: core.build
module: core
priority: 2
status: failing
version: 1
origin: manual
dependsOn:
  - core.setup
---
# Build project

## Acceptance Criteria
1. Project builds
`
      );

      await runImpact("core.setup");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Impact Analysis: core.setup");
      expect(allOutput).toContain("Directly Affected Tasks");
      expect(allOutput).toContain("core.build");
      expect(allOutput).toContain("depends on this task");

      consoleSpy.mockRestore();
    });

    it("should find same-module tasks", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "auth.login": {
          status: "passing",
          priority: 1,
          module: "auth",
          description: "User login",
        },
        "auth.logout": {
          status: "failing",
          priority: 2,
          module: "auth",
          description: "User logout",
        },
        "auth.register": {
          status: "passing",
          priority: 3,
          module: "auth",
          description: "User registration",
        },
      });

      await createFeatureMarkdown(
        "auth",
        "login",
        `---
id: auth.login
module: auth
priority: 1
status: passing
version: 1
origin: manual
dependsOn: []
---
# User login

## Acceptance Criteria
1. User can login
`
      );

      await createFeatureMarkdown(
        "auth",
        "logout",
        `---
id: auth.logout
module: auth
priority: 2
status: failing
version: 1
origin: manual
dependsOn: []
---
# User logout

## Acceptance Criteria
1. User can logout
`
      );

      await createFeatureMarkdown(
        "auth",
        "register",
        `---
id: auth.register
module: auth
priority: 3
status: passing
version: 1
origin: manual
dependsOn: []
---
# User registration

## Acceptance Criteria
1. User can register
`
      );

      await runImpact("auth.login");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Same Module");
      expect(allOutput).toContain("auth.logout");
      expect(allOutput).toContain("auth.register");

      consoleSpy.mockRestore();
    });

    it("should exclude deprecated tasks from same-module list", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "auth.login": {
          status: "passing",
          priority: 1,
          module: "auth",
          description: "User login",
        },
        "auth.old": {
          status: "deprecated",
          priority: 2,
          module: "auth",
          description: "Old feature",
        },
      });

      await createFeatureMarkdown(
        "auth",
        "login",
        `---
id: auth.login
module: auth
priority: 1
status: passing
version: 1
origin: manual
dependsOn: []
---
# User login

## Acceptance Criteria
1. User can login
`
      );

      await createFeatureMarkdown(
        "auth",
        "old",
        `---
id: auth.old
module: auth
priority: 2
status: deprecated
version: 1
origin: manual
dependsOn: []
---
# Old feature

## Acceptance Criteria
1. Old criteria
`
      );

      await runImpact("auth.login");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      // Should not show the deprecated task
      expect(allOutput).not.toContain("auth.old");

      consoleSpy.mockRestore();
    });

    it("should show no impact message when task has no dependents or same-module tasks", async () => {
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

      await runImpact("core.setup");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("No other tasks appear to be affected");

      consoleSpy.mockRestore();
    });

    it("should show recommendations when there are affected tasks", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createFeatureIndex({
        "core.setup": {
          status: "passing",
          priority: 1,
          module: "core",
          description: "Setup project",
        },
        "core.build": {
          status: "failing",
          priority: 2,
          module: "core",
          description: "Build project",
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

      await createFeatureMarkdown(
        "core",
        "build",
        `---
id: core.build
module: core
priority: 2
status: failing
version: 1
origin: manual
dependsOn:
  - core.setup
---
# Build project

## Acceptance Criteria
1. Project builds
`
      );

      await runImpact("core.setup");

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("Recommendations");
      expect(allOutput).toContain("agent-foreman check");

      consoleSpy.mockRestore();
    });
  });
});
