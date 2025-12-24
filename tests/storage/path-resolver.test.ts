import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";

import {
  resolveFeaturePath,
  deriveFeaturePath,
} from "../../src/storage/path-resolver.js";
import { TASKS_DIR } from "../../src/storage/constants.js";

describe("path-resolver", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(tmpdir(), "path-resolver-test-"));
    // Create ai/tasks directory
    await fs.mkdir(path.join(testDir, TASKS_DIR), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe("deriveFeaturePath", () => {
    it("should derive path using module when provided", () => {
      expect(deriveFeaturePath("asset.dashboard.BREAKDOWN", "asset.dashboard"))
        .toBe("asset.dashboard/BREAKDOWN.md");
    });

    it("should use first segment as module when no module provided", () => {
      expect(deriveFeaturePath("auth.login"))
        .toBe("auth/login.md");
    });

    it("should handle nested IDs without module", () => {
      expect(deriveFeaturePath("chat.message.edit"))
        .toBe("chat/message.edit.md");
    });

    it("should handle single-part ID", () => {
      expect(deriveFeaturePath("standalone"))
        .toBe("standalone.md");
    });

    it("should not use module if ID doesn't start with it", () => {
      expect(deriveFeaturePath("other.feature", "asset.dashboard"))
        .toBe("other/feature.md");
    });
  });

  describe("resolveFeaturePath", () => {
    describe("Priority 1: Explicit filePath", () => {
      it("should use explicit filePath when file exists", async () => {
        // Create the file
        const moduleDir = path.join(testDir, TASKS_DIR, "core");
        await fs.mkdir(moduleDir, { recursive: true });
        await fs.writeFile(
          path.join(moduleDir, "01-init.md"),
          "---\nid: core.init\n---\n# Init"
        );

        const result = await resolveFeaturePath(
          testDir,
          "core.init",
          { filePath: "core/01-init.md" }
        );

        expect(result).toBe("core/01-init.md");
      });

      it("should return null when explicit filePath doesn't exist", async () => {
        const result = await resolveFeaturePath(
          testDir,
          "core.init",
          { filePath: "core/nonexistent.md" }
        );

        expect(result).toBeNull();
      });
    });

    describe("Priority 2: Module-based derivation", () => {
      it("should derive path from module when file exists", async () => {
        // Create the file at module-derived path
        const moduleDir = path.join(testDir, TASKS_DIR, "asset.dashboard");
        await fs.mkdir(moduleDir, { recursive: true });
        await fs.writeFile(
          path.join(moduleDir, "BREAKDOWN.md"),
          "---\nid: asset.dashboard.BREAKDOWN\n---\n# Breakdown"
        );

        const result = await resolveFeaturePath(
          testDir,
          "asset.dashboard.BREAKDOWN",
          { module: "asset.dashboard" }
        );

        expect(result).toBe("asset.dashboard/BREAKDOWN.md");
      });

      it("should fall through when module-derived path doesn't exist", async () => {
        // Create file at legacy path instead
        const legacyDir = path.join(testDir, TASKS_DIR, "asset");
        await fs.mkdir(legacyDir, { recursive: true });
        await fs.writeFile(
          path.join(legacyDir, "dashboard.BREAKDOWN.md"),
          "---\nid: asset.dashboard.BREAKDOWN\n---\n# Breakdown"
        );

        const result = await resolveFeaturePath(
          testDir,
          "asset.dashboard.BREAKDOWN",
          { module: "asset.dashboard" }
        );

        expect(result).toBe("asset/dashboard.BREAKDOWN.md");
      });
    });

    describe("Priority 3: ID-based derivation (legacy)", () => {
      it("should derive path from first segment", async () => {
        const moduleDir = path.join(testDir, TASKS_DIR, "auth");
        await fs.mkdir(moduleDir, { recursive: true });
        await fs.writeFile(
          path.join(moduleDir, "login.md"),
          "---\nid: auth.login\n---\n# Login"
        );

        const result = await resolveFeaturePath(testDir, "auth.login");

        expect(result).toBe("auth/login.md");
      });
    });

    describe("Priority 4: Directory scan", () => {
      it("should find file by frontmatter ID match", async () => {
        // Create file with non-standard name
        const moduleDir = path.join(testDir, TASKS_DIR, "core");
        await fs.mkdir(moduleDir, { recursive: true });
        await fs.writeFile(
          path.join(moduleDir, "99-renamed-task.md"),
          "---\nid: core.original-name\n---\n# Original Name"
        );

        const result = await resolveFeaturePath(testDir, "core.original-name");

        expect(result).toBe("core/99-renamed-task.md");
      });

      it("should scan module directory first when module is provided", async () => {
        // Create file in module directory with different name
        const moduleDir = path.join(testDir, TASKS_DIR, "asset.dashboard");
        await fs.mkdir(moduleDir, { recursive: true });
        await fs.writeFile(
          path.join(moduleDir, "01-overview.md"),
          "---\nid: asset.dashboard.overview\n---\n# Overview"
        );

        const result = await resolveFeaturePath(
          testDir,
          "asset.dashboard.overview",
          { module: "asset.dashboard" }
        );

        expect(result).toBe("asset.dashboard/01-overview.md");
      });

      it("should return null for single-part ID in scan", async () => {
        const result = await resolveFeaturePath(testDir, "standalone");
        expect(result).toBeNull();
      });

      it("should skip files that cannot be read", async () => {
        const moduleDir = path.join(testDir, TASKS_DIR, "auth");
        await fs.mkdir(moduleDir, { recursive: true });
        // Create a valid file
        await fs.writeFile(
          path.join(moduleDir, "valid.md"),
          "---\nid: auth.valid\n---\n# Valid"
        );
        // Create a subdirectory (will cause readFile to fail if accidentally read)
        await fs.mkdir(path.join(moduleDir, "subdir.md"), { recursive: true });

        const result = await resolveFeaturePath(testDir, "auth.valid");
        expect(result).toBe("auth/valid.md");
      });

      it("should handle non-existent directories gracefully", async () => {
        const result = await resolveFeaturePath(
          testDir,
          "nonexistent.module.task"
        );
        expect(result).toBeNull();
      });
    });

    describe("FeatureIndexEntry as options", () => {
      it("should accept FeatureIndexEntry directly", async () => {
        const moduleDir = path.join(testDir, TASKS_DIR, "api");
        await fs.mkdir(moduleDir, { recursive: true });
        await fs.writeFile(
          path.join(moduleDir, "users.md"),
          "---\nid: api.users\n---\n# Users API"
        );

        const indexEntry = {
          status: "failing" as const,
          priority: 1,
          module: "api",
          description: "Users API",
        };

        const result = await resolveFeaturePath(testDir, "api.users", indexEntry);
        expect(result).toBe("api/users.md");
      });

      it("should use filePath from FeatureIndexEntry when available", async () => {
        const moduleDir = path.join(testDir, TASKS_DIR, "core");
        await fs.mkdir(moduleDir, { recursive: true });
        await fs.writeFile(
          path.join(moduleDir, "01-setup.md"),
          "---\nid: core.setup\n---\n# Setup"
        );

        const indexEntry = {
          status: "passing" as const,
          priority: 1,
          module: "core",
          description: "Setup",
          filePath: "core/01-setup.md",
        };

        const result = await resolveFeaturePath(testDir, "core.setup", indexEntry);
        expect(result).toBe("core/01-setup.md");
      });
    });
  });
});
