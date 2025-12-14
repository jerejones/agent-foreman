/**
 * Tests for gitignore bundled-templates module
 * Tests bundled template access and verification functionality
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import {
  BUNDLED_TEMPLATES,
  isBundledTemplate,
  getBundledTemplate,
  getBundledTemplateAsync,
  getAllBundledTemplates,
  verifyBundledTemplates,
  getBundledTemplatePath,
  type BundledTemplateName,
} from "../../src/gitignore/bundled-templates.js";

// ============================================================================
// BUNDLED_TEMPLATES Constant Tests
// ============================================================================

describe("BUNDLED_TEMPLATES constant", () => {
  it("should be a readonly array", () => {
    expect(Array.isArray(BUNDLED_TEMPLATES)).toBe(true);
  });

  it("should contain exactly 6 templates", () => {
    expect(BUNDLED_TEMPLATES).toHaveLength(6);
  });

  it("should contain Node template", () => {
    expect(BUNDLED_TEMPLATES).toContain("Node");
  });

  it("should contain Python template", () => {
    expect(BUNDLED_TEMPLATES).toContain("Python");
  });

  it("should contain Go template", () => {
    expect(BUNDLED_TEMPLATES).toContain("Go");
  });

  it("should contain Rust template", () => {
    expect(BUNDLED_TEMPLATES).toContain("Rust");
  });

  it("should contain Java template", () => {
    expect(BUNDLED_TEMPLATES).toContain("Java");
  });

  it("should contain Nextjs template", () => {
    expect(BUNDLED_TEMPLATES).toContain("Nextjs");
  });
});

// ============================================================================
// isBundledTemplate Tests
// ============================================================================

describe("isBundledTemplate", () => {
  it("should return true for all bundled template names", () => {
    for (const name of BUNDLED_TEMPLATES) {
      expect(isBundledTemplate(name)).toBe(true);
    }
  });

  it("should return false for non-bundled template names", () => {
    expect(isBundledTemplate("NonExistent")).toBe(false);
    expect(isBundledTemplate("Ruby")).toBe(false);
    expect(isBundledTemplate("PHP")).toBe(false);
    expect(isBundledTemplate("")).toBe(false);
  });

  it("should be case-sensitive", () => {
    expect(isBundledTemplate("node")).toBe(false);
    expect(isBundledTemplate("NODE")).toBe(false);
    expect(isBundledTemplate("Node")).toBe(true);
  });

  it("should work as type guard", () => {
    const name = "Node" as string;
    if (isBundledTemplate(name)) {
      // TypeScript should narrow the type to BundledTemplateName
      const bundledName: BundledTemplateName = name;
      expect(bundledName).toBe("Node");
    }
  });
});

// ============================================================================
// getBundledTemplate Tests
// ============================================================================

describe("getBundledTemplate", () => {
  it("should return Node template content", () => {
    const content = getBundledTemplate("Node");
    expect(content).not.toBeNull();
    expect(content).toContain("node_modules");
  });

  it("should return Python template content", () => {
    const content = getBundledTemplate("Python");
    expect(content).not.toBeNull();
    expect(content).toContain("__pycache__");
  });

  it("should return Go template content", () => {
    const content = getBundledTemplate("Go");
    expect(content).not.toBeNull();
    expect(content).toContain("*.exe");
  });

  it("should return Rust template content", () => {
    const content = getBundledTemplate("Rust");
    expect(content).not.toBeNull();
    expect(content).toContain("target");
  });

  it("should return Java template content", () => {
    const content = getBundledTemplate("Java");
    expect(content).not.toBeNull();
    expect(content).toContain("*.class");
  });

  it("should return Nextjs template content", () => {
    const content = getBundledTemplate("Nextjs");
    expect(content).not.toBeNull();
    expect(content).toContain(".next");
  });

  it("should return null for non-bundled template names", () => {
    expect(getBundledTemplate("NonExistent")).toBeNull();
    expect(getBundledTemplate("Ruby")).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(getBundledTemplate("")).toBeNull();
  });

  it("should return non-empty content for all bundled templates", () => {
    for (const name of BUNDLED_TEMPLATES) {
      const content = getBundledTemplate(name);
      expect(content).not.toBeNull();
      expect(content!.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// getBundledTemplateAsync Tests
// ============================================================================

describe("getBundledTemplateAsync", () => {
  it("should return Node template content asynchronously", async () => {
    const content = await getBundledTemplateAsync("Node");
    expect(content).not.toBeNull();
    expect(content).toContain("node_modules");
  });

  it("should return Python template content asynchronously", async () => {
    const content = await getBundledTemplateAsync("Python");
    expect(content).not.toBeNull();
    expect(content).toContain("__pycache__");
  });

  it("should return null for non-bundled template names", async () => {
    const content = await getBundledTemplateAsync("NonExistent");
    expect(content).toBeNull();
  });

  it("should return same content as sync version", async () => {
    for (const name of BUNDLED_TEMPLATES) {
      const syncContent = getBundledTemplate(name);
      const asyncContent = await getBundledTemplateAsync(name);
      expect(asyncContent).toBe(syncContent);
    }
  });

  it("should handle all bundled templates", async () => {
    const promises = BUNDLED_TEMPLATES.map((name) => getBundledTemplateAsync(name));
    const results = await Promise.all(promises);

    for (const content of results) {
      expect(content).not.toBeNull();
      expect(content!.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// getAllBundledTemplates Tests
// ============================================================================

describe("getAllBundledTemplates", () => {
  it("should return a Map", () => {
    const templates = getAllBundledTemplates();
    expect(templates instanceof Map).toBe(true);
  });

  it("should contain all bundled template names as keys", () => {
    const templates = getAllBundledTemplates();
    for (const name of BUNDLED_TEMPLATES) {
      expect(templates.has(name)).toBe(true);
    }
  });

  it("should have non-empty content for all templates", () => {
    const templates = getAllBundledTemplates();
    for (const [name, content] of templates) {
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it("should return same content as getBundledTemplate for each entry", () => {
    const templates = getAllBundledTemplates();
    for (const [name, content] of templates) {
      expect(content).toBe(getBundledTemplate(name));
    }
  });

  it("should return a new Map instance on each call", () => {
    const templates1 = getAllBundledTemplates();
    const templates2 = getAllBundledTemplates();
    expect(templates1).not.toBe(templates2);
    // But contents should be equal
    expect(templates1.size).toBe(templates2.size);
  });
});

// ============================================================================
// verifyBundledTemplates Tests
// ============================================================================

describe("verifyBundledTemplates", () => {
  it("should return object with available and missing arrays", () => {
    const result = verifyBundledTemplates();
    expect(result).toHaveProperty("available");
    expect(result).toHaveProperty("missing");
    expect(Array.isArray(result.available)).toBe(true);
    expect(Array.isArray(result.missing)).toBe(true);
  });

  it("should have all bundled templates in available array", () => {
    const result = verifyBundledTemplates();
    // All templates should be available (either embedded or from file system)
    for (const name of BUNDLED_TEMPLATES) {
      expect(result.available).toContain(name);
    }
  });

  it("should have empty missing array when all templates exist", () => {
    const result = verifyBundledTemplates();
    // In normal operation, all templates should be available
    expect(result.missing).toHaveLength(0);
  });

  it("should return combined count equal to BUNDLED_TEMPLATES length", () => {
    const result = verifyBundledTemplates();
    expect(result.available.length + result.missing.length).toBe(BUNDLED_TEMPLATES.length);
  });

  it("should not have duplicates in available array", () => {
    const result = verifyBundledTemplates();
    const uniqueAvailable = new Set(result.available);
    expect(uniqueAvailable.size).toBe(result.available.length);
  });

  it("should not have duplicates in missing array", () => {
    const result = verifyBundledTemplates();
    const uniqueMissing = new Set(result.missing);
    expect(uniqueMissing.size).toBe(result.missing.length);
  });
});

// ============================================================================
// Template Content Quality Tests
// ============================================================================

describe("template content quality", () => {
  it("Node template should have comprehensive patterns", () => {
    const content = getBundledTemplate("Node")!;
    expect(content).toContain("node_modules");
    // Should have common Node.js patterns
    expect(content.includes(".npm") || content.includes("npm-debug")).toBe(true);
  });

  it("Python template should have comprehensive patterns", () => {
    const content = getBundledTemplate("Python")!;
    expect(content).toContain("__pycache__");
    // Should have virtual env patterns or Python artifact patterns
    expect(content.includes("venv") || content.includes(".env") || content.includes(".pyc")).toBe(true);
  });

  it("Go template should have comprehensive patterns", () => {
    const content = getBundledTemplate("Go")!;
    expect(content).toContain("*.exe");
  });

  it("Rust template should have comprehensive patterns", () => {
    const content = getBundledTemplate("Rust")!;
    expect(content).toContain("target");
    // Rust template may or may not include Cargo.lock depending on whether it's a library or binary
    expect(content.includes("debug") || content.includes("target")).toBe(true);
  });

  it("Java template should have comprehensive patterns", () => {
    const content = getBundledTemplate("Java")!;
    expect(content).toContain("*.class");
    expect(content).toContain("*.jar");
  });

  it("Nextjs template should have comprehensive patterns", () => {
    const content = getBundledTemplate("Nextjs")!;
    expect(content).toContain(".next");
  });
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe("edge cases", () => {
  it("should handle rapid successive calls", () => {
    const results: (string | null)[] = [];
    for (let i = 0; i < 100; i++) {
      results.push(getBundledTemplate("Node"));
    }
    // All results should be identical
    const first = results[0];
    for (const result of results) {
      expect(result).toBe(first);
    }
  });

  it("should handle concurrent async calls", async () => {
    const promises = Array(50)
      .fill(null)
      .map(() => getBundledTemplateAsync("Python"));

    const results = await Promise.all(promises);
    const first = results[0];
    for (const result of results) {
      expect(result).toBe(first);
    }
  });

  it("should handle mixed sync and async calls", async () => {
    const syncResult = getBundledTemplate("Go");
    const asyncResult = await getBundledTemplateAsync("Go");
    expect(syncResult).toBe(asyncResult);
  });
});

// ============================================================================
// getBundledTemplatePath Tests
// ============================================================================

describe("getBundledTemplatePath", () => {
  it("should return a valid path for Node template", () => {
    const templatePath = getBundledTemplatePath("Node");
    expect(templatePath).toContain("templates");
    expect(templatePath).toContain("Node.gitignore");
    expect(fs.existsSync(templatePath)).toBe(true);
  });

  it("should return a valid path for Python template", () => {
    const templatePath = getBundledTemplatePath("Python");
    expect(templatePath).toContain("templates");
    expect(templatePath).toContain("Python.gitignore");
    expect(fs.existsSync(templatePath)).toBe(true);
  });

  it("should return a valid path for all bundled templates", () => {
    for (const name of BUNDLED_TEMPLATES) {
      const templatePath = getBundledTemplatePath(name);
      expect(templatePath).toContain("templates");
      expect(templatePath).toContain(`${name}.gitignore`);
      // The file should exist on disk
      expect(fs.existsSync(templatePath)).toBe(true);
    }
  });

  it("should return consistent paths across multiple calls", () => {
    const path1 = getBundledTemplatePath("Go");
    const path2 = getBundledTemplatePath("Go");
    expect(path1).toBe(path2);
  });

  it("should return absolute paths", () => {
    const templatePath = getBundledTemplatePath("Rust");
    expect(path.isAbsolute(templatePath)).toBe(true);
  });

  it("should allow reading the file content directly", () => {
    const templatePath = getBundledTemplatePath("Java");
    const content = fs.readFileSync(templatePath, "utf-8");
    expect(content).toContain("*.class");
  });
});
