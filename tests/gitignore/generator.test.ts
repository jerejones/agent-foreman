/**
 * Tests for gitignore generator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import {
  CONFIG_TO_TEMPLATE,
  LANGUAGE_TO_TEMPLATE,
  MINIMAL_GITIGNORE,
  detectTemplatesFromConfigFiles,
  detectTemplatesFromLanguages,
  getTemplate,
  generateGitignoreContent,
  generateGitignore,
  ensureMinimalGitignore,
  ensureComprehensiveGitignore,
} from "../../src/gitignore/generator.js";

describe("generator", () => {
  describe("CONFIG_TO_TEMPLATE mapping", () => {
    it("should map common config files to templates", () => {
      expect(CONFIG_TO_TEMPLATE["package.json"]).toBe("Node");
      expect(CONFIG_TO_TEMPLATE["go.mod"]).toBe("Go");
      expect(CONFIG_TO_TEMPLATE["Cargo.toml"]).toBe("Rust");
      expect(CONFIG_TO_TEMPLATE["pyproject.toml"]).toBe("Python");
      expect(CONFIG_TO_TEMPLATE["pom.xml"]).toBe("Java");
    });

    it("should map Next.js config files", () => {
      expect(CONFIG_TO_TEMPLATE["next.config.js"]).toBe("Nextjs");
      expect(CONFIG_TO_TEMPLATE["next.config.ts"]).toBe("Nextjs");
      expect(CONFIG_TO_TEMPLATE["next.config.mjs"]).toBe("Nextjs");
    });
  });

  describe("LANGUAGE_TO_TEMPLATE mapping", () => {
    it("should map language names to templates", () => {
      expect(LANGUAGE_TO_TEMPLATE["typescript"]).toBe("Node");
      expect(LANGUAGE_TO_TEMPLATE["javascript"]).toBe("Node");
      expect(LANGUAGE_TO_TEMPLATE["python"]).toBe("Python");
      expect(LANGUAGE_TO_TEMPLATE["go"]).toBe("Go");
      expect(LANGUAGE_TO_TEMPLATE["golang"]).toBe("Go");
      expect(LANGUAGE_TO_TEMPLATE["rust"]).toBe("Rust");
      expect(LANGUAGE_TO_TEMPLATE["java"]).toBe("Java");
    });
  });

  describe("MINIMAL_GITIGNORE", () => {
    it("should contain essential patterns", () => {
      expect(MINIMAL_GITIGNORE).toContain(".env");
      expect(MINIMAL_GITIGNORE).toContain("node_modules/");
      expect(MINIMAL_GITIGNORE).toContain("dist/");
      expect(MINIMAL_GITIGNORE).toContain(".DS_Store");
      expect(MINIMAL_GITIGNORE).toContain("__pycache__/");
      expect(MINIMAL_GITIGNORE).toContain(".next/");
      expect(MINIMAL_GITIGNORE).toContain("target/");
    });
  });

  describe("detectTemplatesFromConfigFiles", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(tmpdir(), "gitignore-test-"));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should detect Node template from package.json", () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), "{}");
      const templates = detectTemplatesFromConfigFiles(tempDir);
      expect(templates).toContain("Node");
    });

    it("should detect Go template from go.mod", () => {
      fs.writeFileSync(path.join(tempDir, "go.mod"), "module test");
      const templates = detectTemplatesFromConfigFiles(tempDir);
      expect(templates).toContain("Go");
    });

    it("should detect Python template from pyproject.toml", () => {
      fs.writeFileSync(path.join(tempDir, "pyproject.toml"), "[tool.poetry]");
      const templates = detectTemplatesFromConfigFiles(tempDir);
      expect(templates).toContain("Python");
    });

    it("should detect multiple templates", () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), "{}");
      fs.writeFileSync(path.join(tempDir, "pyproject.toml"), "[tool.poetry]");
      const templates = detectTemplatesFromConfigFiles(tempDir);
      expect(templates).toContain("Node");
      expect(templates).toContain("Python");
    });

    it("should return empty array for empty directory", () => {
      const templates = detectTemplatesFromConfigFiles(tempDir);
      expect(templates).toEqual([]);
    });

    it("should return unique templates", () => {
      fs.writeFileSync(path.join(tempDir, "requirements.txt"), "flask");
      fs.writeFileSync(path.join(tempDir, "setup.py"), "setup()");
      const templates = detectTemplatesFromConfigFiles(tempDir);
      expect(templates).toEqual(["Python"]);
    });
  });

  describe("detectTemplatesFromLanguages", () => {
    it("should detect templates from language names", () => {
      const templates = detectTemplatesFromLanguages(["typescript", "python"]);
      expect(templates).toContain("Node");
      expect(templates).toContain("Python");
    });

    it("should handle case-insensitive language names", () => {
      const templates = detectTemplatesFromLanguages(["TypeScript", "PYTHON"]);
      expect(templates).toContain("Node");
      expect(templates).toContain("Python");
    });

    it("should handle trimmed language names", () => {
      const templates = detectTemplatesFromLanguages(["  go  ", "  rust  "]);
      expect(templates).toContain("Go");
      expect(templates).toContain("Rust");
    });

    it("should return empty array for unknown languages", () => {
      const templates = detectTemplatesFromLanguages(["unknown", "fake"]);
      expect(templates).toEqual([]);
    });

    it("should return unique templates", () => {
      const templates = detectTemplatesFromLanguages([
        "typescript",
        "javascript",
        "go",
        "golang",
      ]);
      expect(templates).toEqual(["Node", "Go"]);
    });
  });

  describe("getTemplate", () => {
    it("should return bundled template content", async () => {
      const content = await getTemplate("Node");
      expect(content).not.toBeNull();
      expect(content).toContain("node_modules");
    });

    it("should return null for unknown templates (fallback failed)", async () => {
      // Mock fetch to simulate offline scenario
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
      const content = await getTemplate("UnknownTemplate123");
      expect(content).toBeNull();
      vi.unstubAllGlobals();
    });
  });

  describe("generateGitignoreContent", () => {
    it("should return minimal gitignore for empty templates array", async () => {
      const content = await generateGitignoreContent([]);
      expect(content).toBe(MINIMAL_GITIGNORE);
    });

    it("should include header with template names", async () => {
      const content = await generateGitignoreContent(["Node"]);
      expect(content).toContain("Generated by agent-foreman");
      expect(content).toContain("Templates: Node");
    });

    it("should include template sections", async () => {
      const content = await generateGitignoreContent(["Node"]);
      expect(content).toContain("─── Node ───");
      expect(content).toContain("node_modules");
    });

    it("should include agent-foreman patterns", async () => {
      const content = await generateGitignoreContent(["Node"]);
      expect(content).toContain("─── Agent Foreman ───");
      expect(content).toContain("ai/verification/");
      expect(content).toContain(".agent-foreman/");
    });

    it("should combine multiple templates", async () => {
      const content = await generateGitignoreContent(["Node", "Python"]);
      expect(content).toContain("Templates: Node, Python");
      expect(content).toContain("node_modules");
      expect(content).toContain("__pycache__");
    });
  });

  describe("generateGitignore", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(tmpdir(), "gitignore-test-"));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should skip if .gitignore already exists", async () => {
      fs.writeFileSync(path.join(tempDir, ".gitignore"), "existing content");
      const result = await generateGitignore(tempDir);
      expect(result.success).toBe(true);
      expect(result.action).toBe("skipped");
      expect(result.reason).toBe(".gitignore already exists");
    });

    it("should create .gitignore with auto-detection", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), "{}");
      const result = await generateGitignore(tempDir);
      expect(result.success).toBe(true);
      expect(result.action).toBe("created");
      expect(result.templates).toContain("Node");

      const content = fs.readFileSync(path.join(tempDir, ".gitignore"), "utf-8");
      expect(content).toContain("node_modules");
    });

    it("should overwrite existing .gitignore when overwrite=true", async () => {
      fs.writeFileSync(path.join(tempDir, ".gitignore"), "old content");
      fs.writeFileSync(path.join(tempDir, "package.json"), "{}");
      const result = await generateGitignore(tempDir, { overwrite: true });
      expect(result.success).toBe(true);
      expect(result.action).toBe("updated");
    });

    it("should use explicit templates", async () => {
      const result = await generateGitignore(tempDir, { templates: ["Go"] });
      expect(result.success).toBe(true);
      expect(result.templates).toContain("Go");

      const content = fs.readFileSync(path.join(tempDir, ".gitignore"), "utf-8");
      expect(content).toContain("*.exe");
    });

    it("should use language detection", async () => {
      const result = await generateGitignore(tempDir, {
        languages: ["rust"],
        autoDetect: false,
      });
      expect(result.success).toBe(true);
      expect(result.templates).toContain("Rust");
    });

    it("should disable auto-detection when autoDetect=false", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), "{}");
      const result = await generateGitignore(tempDir, {
        autoDetect: false,
        templates: [],
      });
      expect(result.success).toBe(true);
      // Should create minimal gitignore since no templates specified
      const content = fs.readFileSync(path.join(tempDir, ".gitignore"), "utf-8");
      expect(content).toBe(MINIMAL_GITIGNORE);
    });
  });

  describe("ensureMinimalGitignore", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(tmpdir(), "gitignore-test-"));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should create minimal .gitignore if not exists", () => {
      const result = ensureMinimalGitignore(tempDir);
      expect(result.success).toBe(true);
      expect(result.action).toBe("created");

      const content = fs.readFileSync(path.join(tempDir, ".gitignore"), "utf-8");
      expect(content).toBe(MINIMAL_GITIGNORE);
    });

    it("should skip if .gitignore already exists", () => {
      fs.writeFileSync(path.join(tempDir, ".gitignore"), "existing");
      const result = ensureMinimalGitignore(tempDir);
      expect(result.success).toBe(true);
      expect(result.action).toBe("skipped");
      expect(result.reason).toBe(".gitignore exists");
    });
  });

  describe("ensureComprehensiveGitignore", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(tmpdir(), "gitignore-test-"));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should create comprehensive .gitignore with auto-detection", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), "{}");
      const result = await ensureComprehensiveGitignore(tempDir);
      expect(result.success).toBe(true);
      // Action is "created" if no .gitignore exists, or "updated" if overwriting minimal one
      expect(["created", "updated"]).toContain(result.action);

      const content = fs.readFileSync(path.join(tempDir, ".gitignore"), "utf-8");
      expect(content).toContain("Generated by agent-foreman");
    });

    it("should skip if .gitignore has substantial content", async () => {
      // Create a .gitignore with more than 50 characters
      const existingContent = "# My custom gitignore\nnode_modules/\ndist/\n.env\n.env.local";
      fs.writeFileSync(path.join(tempDir, ".gitignore"), existingContent);
      const result = await ensureComprehensiveGitignore(tempDir);
      expect(result.success).toBe(true);
      expect(result.action).toBe("skipped");
      expect(result.reason).toBe(".gitignore already has content");
    });

    it("should overwrite if .gitignore has minimal content", async () => {
      fs.writeFileSync(path.join(tempDir, ".gitignore"), ".env\n");
      fs.writeFileSync(path.join(tempDir, "package.json"), "{}");
      const result = await ensureComprehensiveGitignore(tempDir);
      expect(result.success).toBe(true);
      expect(result.action).toBe("updated");
    });
  });
});
