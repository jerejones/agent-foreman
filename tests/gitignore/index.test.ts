/**
 * Tests for gitignore module index exports
 */

import { describe, it, expect } from "vitest";
import * as gitignoreModule from "../../src/gitignore/index.js";

describe("gitignore/index", () => {
  describe("bundled-templates exports", () => {
    it("should export BUNDLED_TEMPLATES", () => {
      expect(gitignoreModule.BUNDLED_TEMPLATES).toBeDefined();
      expect(Array.isArray(gitignoreModule.BUNDLED_TEMPLATES)).toBe(true);
    });

    it("should export isBundledTemplate function", () => {
      expect(gitignoreModule.isBundledTemplate).toBeDefined();
      expect(typeof gitignoreModule.isBundledTemplate).toBe("function");
    });

    it("should export getBundledTemplate function", () => {
      expect(gitignoreModule.getBundledTemplate).toBeDefined();
      expect(typeof gitignoreModule.getBundledTemplate).toBe("function");
    });

    it("should export getBundledTemplateAsync function", () => {
      expect(gitignoreModule.getBundledTemplateAsync).toBeDefined();
      expect(typeof gitignoreModule.getBundledTemplateAsync).toBe("function");
    });

    it("should export getAllBundledTemplates function", () => {
      expect(gitignoreModule.getAllBundledTemplates).toBeDefined();
      expect(typeof gitignoreModule.getAllBundledTemplates).toBe("function");
    });

    it("should export verifyBundledTemplates function", () => {
      expect(gitignoreModule.verifyBundledTemplates).toBeDefined();
      expect(typeof gitignoreModule.verifyBundledTemplates).toBe("function");
    });
  });

  describe("github-api exports", () => {
    it("should export getCacheDir function", () => {
      expect(gitignoreModule.getCacheDir).toBeDefined();
      expect(typeof gitignoreModule.getCacheDir).toBe("function");
    });

    it("should export getCacheTTL function", () => {
      expect(gitignoreModule.getCacheTTL).toBeDefined();
      expect(typeof gitignoreModule.getCacheTTL).toBe("function");
    });

    it("should export fetchGitignoreTemplate function", () => {
      expect(gitignoreModule.fetchGitignoreTemplate).toBeDefined();
      expect(typeof gitignoreModule.fetchGitignoreTemplate).toBe("function");
    });

    it("should export listGitignoreTemplates function", () => {
      expect(gitignoreModule.listGitignoreTemplates).toBeDefined();
      expect(typeof gitignoreModule.listGitignoreTemplates).toBe("function");
    });

    it("should export clearCache function", () => {
      expect(gitignoreModule.clearCache).toBeDefined();
      expect(typeof gitignoreModule.clearCache).toBe("function");
    });

    it("should export getCacheStats function", () => {
      expect(gitignoreModule.getCacheStats).toBeDefined();
      expect(typeof gitignoreModule.getCacheStats).toBe("function");
    });
  });

  describe("generator exports", () => {
    it("should export CONFIG_TO_TEMPLATE mapping", () => {
      expect(gitignoreModule.CONFIG_TO_TEMPLATE).toBeDefined();
      expect(typeof gitignoreModule.CONFIG_TO_TEMPLATE).toBe("object");
    });

    it("should export LANGUAGE_TO_TEMPLATE mapping", () => {
      expect(gitignoreModule.LANGUAGE_TO_TEMPLATE).toBeDefined();
      expect(typeof gitignoreModule.LANGUAGE_TO_TEMPLATE).toBe("object");
    });

    it("should export MINIMAL_GITIGNORE constant", () => {
      expect(gitignoreModule.MINIMAL_GITIGNORE).toBeDefined();
      expect(typeof gitignoreModule.MINIMAL_GITIGNORE).toBe("string");
    });

    it("should export detectTemplatesFromConfigFiles function", () => {
      expect(gitignoreModule.detectTemplatesFromConfigFiles).toBeDefined();
      expect(typeof gitignoreModule.detectTemplatesFromConfigFiles).toBe("function");
    });

    it("should export detectTemplatesFromLanguages function", () => {
      expect(gitignoreModule.detectTemplatesFromLanguages).toBeDefined();
      expect(typeof gitignoreModule.detectTemplatesFromLanguages).toBe("function");
    });

    it("should export getTemplate function", () => {
      expect(gitignoreModule.getTemplate).toBeDefined();
      expect(typeof gitignoreModule.getTemplate).toBe("function");
    });

    it("should export generateGitignoreContent function", () => {
      expect(gitignoreModule.generateGitignoreContent).toBeDefined();
      expect(typeof gitignoreModule.generateGitignoreContent).toBe("function");
    });

    it("should export generateGitignore function", () => {
      expect(gitignoreModule.generateGitignore).toBeDefined();
      expect(typeof gitignoreModule.generateGitignore).toBe("function");
    });

    it("should export ensureMinimalGitignore function", () => {
      expect(gitignoreModule.ensureMinimalGitignore).toBeDefined();
      expect(typeof gitignoreModule.ensureMinimalGitignore).toBe("function");
    });

    it("should export ensureComprehensiveGitignore function", () => {
      expect(gitignoreModule.ensureComprehensiveGitignore).toBeDefined();
      expect(typeof gitignoreModule.ensureComprehensiveGitignore).toBe("function");
    });
  });

  describe("functional tests", () => {
    it("should correctly identify bundled templates via re-export", () => {
      expect(gitignoreModule.isBundledTemplate("Node")).toBe(true);
      expect(gitignoreModule.isBundledTemplate("Unknown")).toBe(false);
    });

    it("should get bundled template content via re-export", () => {
      const content = gitignoreModule.getBundledTemplate("Node");
      expect(content).not.toBeNull();
      expect(content).toContain("node_modules");
    });

    it("should detect templates from languages via re-export", () => {
      const templates = gitignoreModule.detectTemplatesFromLanguages(["python"]);
      expect(templates).toContain("Python");
    });

    it("should return cache TTL via re-export", () => {
      const ttl = gitignoreModule.getCacheTTL();
      expect(ttl).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });
});
