/**
 * Tests for src/project-scanner.ts - Directory structure scanning
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { scanDirectoryStructure, isProjectEmpty } from "../src/project-scanner.js";

describe("Project Scanner", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-foreman-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("scanDirectoryStructure", () => {
    describe("Entry points detection", () => {
      it("should find src/index.ts entry point", async () => {
        await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
        await fs.writeFile(path.join(tempDir, "src/index.ts"), "");

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.entryPoints).toContain("src/index.ts");
      });

      it("should find src/main.ts entry point", async () => {
        await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
        await fs.writeFile(path.join(tempDir, "src/main.ts"), "");

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.entryPoints).toContain("src/main.ts");
      });

      it("should find main.go entry point", async () => {
        await fs.writeFile(path.join(tempDir, "main.go"), "");

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.entryPoints).toContain("main.go");
      });

      it("should find app.py entry point", async () => {
        await fs.writeFile(path.join(tempDir, "app.py"), "");

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.entryPoints).toContain("app.py");
      });
    });

    describe("Source directories detection", () => {
      it("should find src directory", async () => {
        await fs.mkdir(path.join(tempDir, "src"), { recursive: true });

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.srcDirs).toContain("src");
      });

      it("should find lib directory", async () => {
        await fs.mkdir(path.join(tempDir, "lib"), { recursive: true });

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.srcDirs).toContain("lib");
      });

      it("should find pkg directory", async () => {
        await fs.mkdir(path.join(tempDir, "pkg"), { recursive: true });

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.srcDirs).toContain("pkg");
      });

      it("should find api directory", async () => {
        await fs.mkdir(path.join(tempDir, "api"), { recursive: true });

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.srcDirs).toContain("api");
      });

      it("should find multiple source directories", async () => {
        await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
        await fs.mkdir(path.join(tempDir, "lib"), { recursive: true });
        await fs.mkdir(path.join(tempDir, "api"), { recursive: true });

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.srcDirs).toContain("src");
        expect(structure.srcDirs).toContain("lib");
        expect(structure.srcDirs).toContain("api");
      });
    });

    describe("Test directories detection", () => {
      it("should find tests directory", async () => {
        await fs.mkdir(path.join(tempDir, "tests"), { recursive: true });

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.testDirs).toContain("tests");
      });

      it("should find __tests__ directory", async () => {
        await fs.mkdir(path.join(tempDir, "__tests__"), { recursive: true });

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.testDirs).toContain("__tests__");
      });

      it("should find spec directory", async () => {
        await fs.mkdir(path.join(tempDir, "spec"), { recursive: true });

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.testDirs).toContain("spec");
      });

      it("should find e2e directory", async () => {
        await fs.mkdir(path.join(tempDir, "e2e"), { recursive: true });

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.testDirs).toContain("e2e");
      });
    });

    describe("Config files detection", () => {
      it("should find tsconfig.json", async () => {
        await fs.writeFile(path.join(tempDir, "tsconfig.json"), "{}");

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.configFiles).toContain("tsconfig.json");
      });

      it("should find vite.config.ts", async () => {
        await fs.writeFile(path.join(tempDir, "vite.config.ts"), "");

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.configFiles).toContain("vite.config.ts");
      });

      it("should find next.config.js", async () => {
        await fs.writeFile(path.join(tempDir, "next.config.js"), "");

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.configFiles).toContain("next.config.js");
      });

      it("should find .eslintrc.json", async () => {
        await fs.writeFile(path.join(tempDir, ".eslintrc.json"), "{}");

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.configFiles).toContain(".eslintrc.json");
      });

      it("should find multiple config files", async () => {
        await fs.writeFile(path.join(tempDir, "tsconfig.json"), "{}");
        await fs.writeFile(path.join(tempDir, "vite.config.ts"), "");
        await fs.writeFile(path.join(tempDir, ".prettierrc"), "");

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.configFiles).toContain("tsconfig.json");
        expect(structure.configFiles).toContain("vite.config.ts");
        expect(structure.configFiles).toContain(".prettierrc");
      });
    });

    describe("Empty project handling", () => {
      it("should return empty arrays for empty project", async () => {
        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.entryPoints).toHaveLength(0);
        expect(structure.srcDirs).toHaveLength(0);
        expect(structure.testDirs).toHaveLength(0);
        expect(structure.configFiles).toHaveLength(0);
      });
    });

    describe("Complete project structure", () => {
      it("should detect full project structure", async () => {
        // Create a typical Node.js project structure
        await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
        await fs.mkdir(path.join(tempDir, "tests"), { recursive: true });
        await fs.writeFile(path.join(tempDir, "src/index.ts"), "");
        await fs.writeFile(path.join(tempDir, "package.json"), "{}");
        await fs.writeFile(path.join(tempDir, "tsconfig.json"), "{}");

        const structure = await scanDirectoryStructure(tempDir);

        expect(structure.entryPoints).toContain("src/index.ts");
        expect(structure.srcDirs).toContain("src");
        expect(structure.testDirs).toContain("tests");
        expect(structure.configFiles).toContain("tsconfig.json");
      });
    });
  });

  describe("isProjectEmpty", () => {
    it("should return true for empty directory", async () => {
      const result = await isProjectEmpty(tempDir);
      expect(result).toBe(true);
    });

    it("should return false when TypeScript files exist", async () => {
      await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
      await fs.writeFile(path.join(tempDir, "src/index.ts"), "console.log('hello');");

      const result = await isProjectEmpty(tempDir);
      expect(result).toBe(false);
    });

    it("should return false when JavaScript files exist", async () => {
      await fs.writeFile(path.join(tempDir, "app.js"), "module.exports = {};");

      const result = await isProjectEmpty(tempDir);
      expect(result).toBe(false);
    });

    it("should return false when Python files exist", async () => {
      await fs.writeFile(path.join(tempDir, "main.py"), "print('hello')");

      const result = await isProjectEmpty(tempDir);
      expect(result).toBe(false);
    });

    it("should return false when Go files exist", async () => {
      await fs.writeFile(path.join(tempDir, "main.go"), "package main");

      const result = await isProjectEmpty(tempDir);
      expect(result).toBe(false);
    });

    it("should return false when Rust files exist", async () => {
      await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
      await fs.writeFile(path.join(tempDir, "src/main.rs"), "fn main() {}");

      const result = await isProjectEmpty(tempDir);
      expect(result).toBe(false);
    });

    it("should return false when files exist in src directory", async () => {
      await fs.mkdir(path.join(tempDir, "src/utils"), { recursive: true });
      await fs.writeFile(path.join(tempDir, "src/utils/helper.ts"), "export {}");

      const result = await isProjectEmpty(tempDir);
      expect(result).toBe(false);
    });

    it("should return false when files exist in lib directory", async () => {
      await fs.mkdir(path.join(tempDir, "lib"), { recursive: true });
      await fs.writeFile(path.join(tempDir, "lib/core.js"), "module.exports = {};");

      const result = await isProjectEmpty(tempDir);
      expect(result).toBe(false);
    });

    it("should return false when files exist in app directory", async () => {
      await fs.mkdir(path.join(tempDir, "app"), { recursive: true });
      await fs.writeFile(path.join(tempDir, "app/page.tsx"), "export default function() {}");

      const result = await isProjectEmpty(tempDir);
      expect(result).toBe(false);
    });

    it("should return true when only config files exist (no source code)", async () => {
      await fs.writeFile(path.join(tempDir, "package.json"), "{}");
      await fs.writeFile(path.join(tempDir, "tsconfig.json"), "{}");
      await fs.writeFile(path.join(tempDir, "README.md"), "# Project");

      const result = await isProjectEmpty(tempDir);
      expect(result).toBe(true);
    });

    it("should ignore node_modules directory", async () => {
      await fs.mkdir(path.join(tempDir, "node_modules/lodash"), { recursive: true });
      await fs.writeFile(path.join(tempDir, "node_modules/lodash/index.js"), "module.exports = {};");

      const result = await isProjectEmpty(tempDir);
      expect(result).toBe(true);
    });

    it("should ignore dist directory", async () => {
      await fs.mkdir(path.join(tempDir, "dist"), { recursive: true });
      await fs.writeFile(path.join(tempDir, "dist/index.js"), "console.log('built');");

      const result = await isProjectEmpty(tempDir);
      expect(result).toBe(true);
    });

    it("should ignore build directory", async () => {
      await fs.mkdir(path.join(tempDir, "build"), { recursive: true });
      await fs.writeFile(path.join(tempDir, "build/main.js"), "console.log('built');");

      const result = await isProjectEmpty(tempDir);
      expect(result).toBe(true);
    });

    it("should detect C/C++ files", async () => {
      await fs.writeFile(path.join(tempDir, "main.c"), "int main() { return 0; }");

      const result = await isProjectEmpty(tempDir);
      expect(result).toBe(false);
    });

    it("should detect Java files", async () => {
      await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
      await fs.writeFile(path.join(tempDir, "src/Main.java"), "public class Main {}");

      const result = await isProjectEmpty(tempDir);
      expect(result).toBe(false);
    });
  });
});
