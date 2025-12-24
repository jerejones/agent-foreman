/**
 * Tests for bundled gitignore templates
 */

import { describe, it, expect } from "vitest";
import {
  BUNDLED_TEMPLATES,
  isBundledTemplate,
  getBundledTemplate,
  getBundledTemplateAsync,
  getAllBundledTemplates,
  verifyBundledTemplates,
} from "../../src/gitignore/bundled-templates.js";

describe("bundled-templates", () => {
  describe("BUNDLED_TEMPLATES", () => {
    it("should contain expected template names", () => {
      expect(BUNDLED_TEMPLATES).toContain("Node");
      expect(BUNDLED_TEMPLATES).toContain("Python");
      expect(BUNDLED_TEMPLATES).toContain("Go");
      expect(BUNDLED_TEMPLATES).toContain("Rust");
      expect(BUNDLED_TEMPLATES).toContain("Java");
      expect(BUNDLED_TEMPLATES).toContain("Nextjs");
    });

    it("should have 6 bundled templates", () => {
      expect(BUNDLED_TEMPLATES.length).toBe(6);
    });
  });

  describe("isBundledTemplate", () => {
    it("should return true for valid bundled template names", () => {
      expect(isBundledTemplate("Node")).toBe(true);
      expect(isBundledTemplate("Python")).toBe(true);
      expect(isBundledTemplate("Go")).toBe(true);
      expect(isBundledTemplate("Rust")).toBe(true);
      expect(isBundledTemplate("Java")).toBe(true);
      expect(isBundledTemplate("Nextjs")).toBe(true);
    });

    it("should return false for non-bundled template names", () => {
      expect(isBundledTemplate("Ruby")).toBe(false);
      expect(isBundledTemplate("PHP")).toBe(false);
      expect(isBundledTemplate("node")).toBe(false); // case sensitive
      expect(isBundledTemplate("")).toBe(false);
    });
  });

  describe("getBundledTemplate", () => {
    it("should return content for Node template", () => {
      const content = getBundledTemplate("Node");
      expect(content).not.toBeNull();
      expect(content).toContain("node_modules");
      expect(content).toContain("npm-debug.log");
    });

    it("should return content for Python template", () => {
      const content = getBundledTemplate("Python");
      expect(content).not.toBeNull();
      expect(content).toContain("__pycache__");
      expect(content).toContain(".venv");
    });

    it("should return content for Go template", () => {
      const content = getBundledTemplate("Go");
      expect(content).not.toBeNull();
      expect(content).toContain("*.exe");
      expect(content).toContain("vendor/");
    });

    it("should return content for Rust template", () => {
      const content = getBundledTemplate("Rust");
      expect(content).not.toBeNull();
      expect(content).toContain("target/");
      expect(content).toContain("Cargo.lock");
    });

    it("should return content for Java template", () => {
      const content = getBundledTemplate("Java");
      expect(content).not.toBeNull();
      expect(content).toContain("*.class");
      expect(content).toContain("target/");
    });

    it("should return content for Nextjs template", () => {
      const content = getBundledTemplate("Nextjs");
      expect(content).not.toBeNull();
      expect(content).toContain(".next");
      expect(content).toContain("out/");
    });

    it("should return null for non-bundled template", () => {
      expect(getBundledTemplate("Ruby")).toBeNull();
      expect(getBundledTemplate("")).toBeNull();
    });
  });

  describe("getBundledTemplateAsync", () => {
    it("should return content asynchronously for bundled templates", async () => {
      const content = await getBundledTemplateAsync("Node");
      expect(content).not.toBeNull();
      expect(content).toContain("node_modules");
    });

    it("should return null asynchronously for non-bundled templates", async () => {
      const content = await getBundledTemplateAsync("Ruby");
      expect(content).toBeNull();
    });
  });

  describe("getAllBundledTemplates", () => {
    it("should return a Map of all bundled templates", () => {
      const templates = getAllBundledTemplates();
      expect(templates).toBeInstanceOf(Map);
      expect(templates.size).toBe(6);
    });

    it("should contain all expected template keys", () => {
      const templates = getAllBundledTemplates();
      expect(templates.has("Node")).toBe(true);
      expect(templates.has("Python")).toBe(true);
      expect(templates.has("Go")).toBe(true);
      expect(templates.has("Rust")).toBe(true);
      expect(templates.has("Java")).toBe(true);
      expect(templates.has("Nextjs")).toBe(true);
    });

    it("should return valid content for each template", () => {
      const templates = getAllBundledTemplates();
      for (const [name, content] of templates) {
        expect(content).toBeTruthy();
        expect(typeof content).toBe("string");
        expect(content.length).toBeGreaterThan(10);
      }
    });
  });

  describe("verifyBundledTemplates", () => {
    it("should verify all templates are available", () => {
      const result = verifyBundledTemplates();
      expect(result.available).toEqual(expect.arrayContaining([
        "Node",
        "Python",
        "Go",
        "Rust",
        "Java",
        "Nextjs",
      ]));
      expect(result.missing).toEqual([]);
    });

    it("should return object with available and missing arrays", () => {
      const result = verifyBundledTemplates();
      expect(result).toHaveProperty("available");
      expect(result).toHaveProperty("missing");
      expect(Array.isArray(result.available)).toBe(true);
      expect(Array.isArray(result.missing)).toBe(true);
    });
  });
});
