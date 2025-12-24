/**
 * Unit tests for commands/utils.ts
 * Tests project goal detection and user confirmation prompts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import { detectProjectGoal } from "../../src/commands/utils.js";

describe("commands/utils", () => {
  describe("detectProjectGoal()", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "foreman-utils-test-"));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("should read goal from package.json description", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const packageJson = {
        name: "test-project",
        description: "A comprehensive test project for unit testing",
        version: "1.0.0",
      };
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify(packageJson)
      );

      const goal = await detectProjectGoal(tempDir);

      expect(goal).toBe("A comprehensive test project for unit testing");
      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("package.json");

      consoleSpy.mockRestore();
    });

    it("should skip short package.json descriptions (<=10 chars)", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const packageJson = {
        name: "test-project",
        description: "Short",
        version: "1.0.0",
      };
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify(packageJson)
      );

      const goal = await detectProjectGoal(tempDir);

      // Should fallback to directory name since description is too short
      expect(goal).toContain("Development of");

      consoleSpy.mockRestore();
    });

    it("should read goal from README.md when no package.json description", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Create package.json without description
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "test" })
      );

      // Create README.md
      const readmeContent = `# My Project

This is a detailed description of the project that should be detected.

## Features
- Feature 1
- Feature 2
`;
      await fs.writeFile(path.join(tempDir, "README.md"), readmeContent);

      const goal = await detectProjectGoal(tempDir);

      expect(goal).toBe(
        "This is a detailed description of the project that should be detected."
      );
      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("README.md");

      consoleSpy.mockRestore();
    });

    it("should use cleaned header text if long enough", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Headers are stripped of # prefix, and used if > 10 chars
      const readmeContent = `# This Is A Long Project Title That Exceeds Ten Characters
## Another Header
### Yet Another Header
`;
      await fs.writeFile(path.join(tempDir, "README.md"), readmeContent);

      const goal = await detectProjectGoal(tempDir);

      // The # is stripped, resulting in the cleaned header text
      expect(goal).toBe(
        "This Is A Long Project Title That Exceeds Ten Characters"
      );

      consoleSpy.mockRestore();
    });

    it("should skip image/badge lines in README", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const readmeContent = `# Project
![Badge](https://badge.svg)
[Link to docs](https://docs.example.com)
This is the actual project description.
`;
      await fs.writeFile(path.join(tempDir, "README.md"), readmeContent);

      const goal = await detectProjectGoal(tempDir);

      expect(goal).toBe("This is the actual project description.");

      consoleSpy.mockRestore();
    });

    it("should try different README filename variants", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Use lowercase readme.md with a long description line
      const readmeContent = `# Short
This project description line is long enough to be detected.
`;
      await fs.writeFile(path.join(tempDir, "readme.md"), readmeContent);

      const goal = await detectProjectGoal(tempDir);

      expect(goal).toBe(
        "This project description line is long enough to be detected."
      );
      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      // Case-insensitive check (macOS has case-insensitive filesystem)
      expect(allOutput.toLowerCase()).toContain("readme.md");

      consoleSpy.mockRestore();
    });

    it("should fallback to directory name when no description found", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Empty directory - no package.json or README
      const goal = await detectProjectGoal(tempDir);

      expect(goal).toContain("Development of");
      expect(goal).toContain(path.basename(tempDir));
      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(allOutput).toContain("No description found");

      consoleSpy.mockRestore();
    });

    it("should handle invalid JSON in package.json", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await fs.writeFile(
        path.join(tempDir, "package.json"),
        "{ invalid json }"
      );

      const goal = await detectProjectGoal(tempDir);

      // Should fallback to directory name
      expect(goal).toContain("Development of");

      consoleSpy.mockRestore();
    });

    it("should handle empty README files", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await fs.writeFile(path.join(tempDir, "README.md"), "");

      const goal = await detectProjectGoal(tempDir);

      // Should fallback to directory name
      expect(goal).toContain("Development of");

      consoleSpy.mockRestore();
    });

    it("should prefer package.json over README", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Both package.json and README exist
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({ description: "Description from package.json file" })
      );
      await fs.writeFile(
        path.join(tempDir, "README.md"),
        "Description from README file that should not be used"
      );

      const goal = await detectProjectGoal(tempDir);

      expect(goal).toBe("Description from package.json file");

      consoleSpy.mockRestore();
    });
  });
});
