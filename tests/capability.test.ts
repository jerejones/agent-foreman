/**
 * Tests for the extensible capability detection system
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import {
  loadCachedCapabilities,
  saveCapabilities,
  invalidateCache,
  isStale,
  CACHE_VERSION,
} from "../src/capability-cache.js";

import {
  detectWithPresets,
  formatExtendedCapabilities,
} from "../src/capability-detector.js";

import {
  collectProjectContext,
  buildCapabilityDiscoveryPrompt,
  parseCapabilityResponse,
} from "../src/ai-capability-discovery.js";

import type { ExtendedCapabilities, CapabilityCache } from "../src/verification-types.js";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a minimal ExtendedCapabilities object for testing
 */
function createTestCapabilities(
  overrides: Partial<ExtendedCapabilities> = {}
): ExtendedCapabilities {
  return {
    hasTests: true,
    testCommand: "npm test",
    testFramework: "vitest",
    hasTypeCheck: true,
    typeCheckCommand: "npx tsc --noEmit",
    hasLint: false,
    hasBuild: true,
    buildCommand: "npm run build",
    hasGit: true,
    source: "preset",
    confidence: 0.95,
    languages: ["typescript", "nodejs"],
    detectedAt: new Date().toISOString(),
    testInfo: { available: true, command: "npm test", framework: "vitest", confidence: 0.95 },
    typeCheckInfo: { available: true, command: "npx tsc --noEmit", confidence: 0.9 },
    lintInfo: { available: false, confidence: 0 },
    buildInfo: { available: true, command: "npm run build", confidence: 0.9 },
    ...overrides,
  };
}

// ============================================================================
// Cache Tests
// ============================================================================

describe("Capability Cache", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cap-cache-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("loadCachedCapabilities", () => {
    it("should return null for non-existent cache", async () => {
      const result = await loadCachedCapabilities(tempDir);
      expect(result).toBeNull();
    });

    it("should load valid cached capabilities", async () => {
      const capabilities = createTestCapabilities();
      const cache: CapabilityCache = {
        version: CACHE_VERSION,
        capabilities,
      };

      // Create cache file
      const cacheDir = path.join(tempDir, "ai");
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(
        path.join(cacheDir, "capabilities.json"),
        JSON.stringify(cache)
      );

      const result = await loadCachedCapabilities(tempDir);

      expect(result).not.toBeNull();
      expect(result?.source).toBe("cached");
      expect(result?.languages).toContain("typescript");
    });

    it("should return null for corrupted cache", async () => {
      const cacheDir = path.join(tempDir, "ai");
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(
        path.join(cacheDir, "capabilities.json"),
        "{ invalid json"
      );

      const result = await loadCachedCapabilities(tempDir);
      expect(result).toBeNull();
    });

    it("should return null for outdated cache version", async () => {
      const cache: CapabilityCache = {
        version: "0.0.1", // Old version
        capabilities: createTestCapabilities(),
      };

      const cacheDir = path.join(tempDir, "ai");
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(
        path.join(cacheDir, "capabilities.json"),
        JSON.stringify(cache)
      );

      const result = await loadCachedCapabilities(tempDir);
      expect(result).toBeNull();
    });
  });

  describe("saveCapabilities", () => {
    it("should create cache file and directory", async () => {
      const capabilities = createTestCapabilities();

      await saveCapabilities(tempDir, capabilities);

      const cachePath = path.join(tempDir, "ai", "capabilities.json");
      const exists = await fs.access(cachePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it("should save with current version", async () => {
      const capabilities = createTestCapabilities();

      await saveCapabilities(tempDir, capabilities);

      const cachePath = path.join(tempDir, "ai", "capabilities.json");
      const content = await fs.readFile(cachePath, "utf-8");
      const cache = JSON.parse(content) as CapabilityCache;

      expect(cache.version).toBe(CACHE_VERSION);
    });

    it("should update detectedAt timestamp", async () => {
      const capabilities = createTestCapabilities({
        detectedAt: "2020-01-01T00:00:00.000Z",
      });

      await saveCapabilities(tempDir, capabilities);

      const cachePath = path.join(tempDir, "ai", "capabilities.json");
      const content = await fs.readFile(cachePath, "utf-8");
      const cache = JSON.parse(content) as CapabilityCache;

      // Should have updated timestamp (not 2020)
      expect(cache.capabilities.detectedAt).not.toBe("2020-01-01T00:00:00.000Z");
    });
  });

  describe("invalidateCache", () => {
    it("should remove cache file", async () => {
      // Create cache first
      const cacheDir = path.join(tempDir, "ai");
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(
        path.join(cacheDir, "capabilities.json"),
        "{}"
      );

      await invalidateCache(tempDir);

      const exists = await fs.access(path.join(cacheDir, "capabilities.json"))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it("should not throw for non-existent cache", async () => {
      await expect(invalidateCache(tempDir)).resolves.not.toThrow();
    });
  });

  describe("isStale", () => {
    it("should return true for non-existent cache", async () => {
      const result = await isStale(tempDir);
      expect(result).toBe(true);
    });

    it("should return true for cache without commit hash", async () => {
      const cache: CapabilityCache = {
        version: CACHE_VERSION,
        capabilities: createTestCapabilities(),
        // No commitHash
      };

      const cacheDir = path.join(tempDir, "ai");
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(
        path.join(cacheDir, "capabilities.json"),
        JSON.stringify(cache)
      );

      const result = await isStale(tempDir);
      expect(result).toBe(true);
    });
  });
});

// ============================================================================
// Preset Detection Tests
// ============================================================================

describe("Preset Detection", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "preset-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("detectWithPresets", () => {
    it("should return low confidence for empty directory", async () => {
      const result = await detectWithPresets(tempDir);

      expect(result.source).toBe("preset");
      expect(result.confidence).toBe(0);
      expect(result.languages).toHaveLength(0);
    });

    it("should detect Node.js project from package.json", async () => {
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "test-project",
          scripts: { test: "vitest run" },
          devDependencies: { vitest: "^1.0.0" },
        })
      );

      const result = await detectWithPresets(tempDir);

      expect(result.source).toBe("preset");
      expect(result.languages).toContain("nodejs");
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.hasTests).toBe(true);
      expect(result.testFramework).toBe("vitest");
    });

    it("should detect TypeScript project", async () => {
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "test" })
      );
      await fs.writeFile(
        path.join(tempDir, "tsconfig.json"),
        JSON.stringify({ compilerOptions: {} })
      );

      const result = await detectWithPresets(tempDir);

      expect(result.languages).toContain("typescript");
      expect(result.hasTypeCheck).toBe(true);
    });

    it("should detect Python project from pyproject.toml", async () => {
      await fs.writeFile(
        path.join(tempDir, "pyproject.toml"),
        `[tool.pytest]
testpaths = ["tests"]`
      );

      const result = await detectWithPresets(tempDir);

      expect(result.languages).toContain("python");
      expect(result.hasTests).toBe(true);
      expect(result.testFramework).toBe("pytest");
    });

    it("should detect Go project", async () => {
      await fs.writeFile(
        path.join(tempDir, "go.mod"),
        "module example.com/test\n\ngo 1.21"
      );

      const result = await detectWithPresets(tempDir);

      expect(result.languages).toContain("go");
      expect(result.hasTests).toBe(true);
      expect(result.testCommand).toBe("go test ./...");
    });

    it("should detect Rust project", async () => {
      await fs.writeFile(
        path.join(tempDir, "Cargo.toml"),
        `[package]
name = "test"
version = "0.1.0"`
      );

      const result = await detectWithPresets(tempDir);

      expect(result.languages).toContain("rust");
      expect(result.hasTests).toBe(true);
      expect(result.testCommand).toBe("cargo test");
      expect(result.hasLint).toBe(true);
      expect(result.lintCommand).toBe("cargo clippy");
    });

    it("should calculate high confidence for complete project setup", async () => {
      // Create a fully configured Node.js/TypeScript project
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          scripts: { test: "vitest", build: "tsc" },
          devDependencies: { vitest: "^1.0.0", typescript: "^5.0.0" },
        })
      );
      await fs.writeFile(
        path.join(tempDir, "tsconfig.json"),
        JSON.stringify({ compilerOptions: {} })
      );

      // Initialize git
      const { execSync } = await import("node:child_process");
      try {
        execSync("git init", { cwd: tempDir, stdio: "pipe" });
      } catch {
        // Git might not be available in all test environments
      }

      const result = await detectWithPresets(tempDir);

      // Should have high confidence with all capabilities
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });
  });
});

// ============================================================================
// AI Discovery Tests
// ============================================================================

describe("AI Capability Discovery", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-discovery-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("collectProjectContext", () => {
    it("should collect config files", async () => {
      await fs.writeFile(path.join(tempDir, "pom.xml"), "<project></project>");
      await fs.writeFile(path.join(tempDir, "build.gradle"), "plugins {}");

      const context = await collectProjectContext(tempDir);

      expect(context.configFiles).toContain("pom.xml");
      expect(context.buildFiles).toContain("build.gradle");
    });

    it("should get directory structure", async () => {
      await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
      await fs.mkdir(path.join(tempDir, "tests"), { recursive: true });

      const context = await collectProjectContext(tempDir);

      expect(context.directoryStructure).toBeTruthy();
      expect(context.directoryStructure.length).toBeGreaterThan(0);
    });

    it("should sample source files", async () => {
      const srcDir = path.join(tempDir, "src");
      await fs.mkdir(srcDir, { recursive: true });
      await fs.writeFile(
        path.join(srcDir, "Main.java"),
        "public class Main { public static void main(String[] args) {} }"
      );

      const context = await collectProjectContext(tempDir);

      expect(context.sampleFiles.length).toBeGreaterThan(0);
      expect(context.sampleFiles[0].path).toContain("Main.java");
      expect(context.sampleFiles[0].content).toContain("public class Main");
    });
  });

  describe("buildCapabilityDiscoveryPrompt", () => {
    it("should include config files in prompt", () => {
      const context = {
        configFiles: ["pom.xml", "build.gradle"],
        buildFiles: ["pom.xml"],
        directoryStructure: "src/\n  Main.java",
        sampleFiles: [],
      };

      const prompt = buildCapabilityDiscoveryPrompt(context);

      expect(prompt).toContain("pom.xml");
      expect(prompt).toContain("build.gradle");
    });

    it("should include sample file content", () => {
      const context = {
        configFiles: [],
        buildFiles: [],
        directoryStructure: "",
        sampleFiles: [
          { path: "src/Main.java", content: "public class Main {}" },
        ],
      };

      const prompt = buildCapabilityDiscoveryPrompt(context);

      expect(prompt).toContain("src/Main.java");
      expect(prompt).toContain("public class Main");
    });

    it("should request JSON output", () => {
      const context = {
        configFiles: [],
        buildFiles: [],
        directoryStructure: "",
        sampleFiles: [],
      };

      const prompt = buildCapabilityDiscoveryPrompt(context);

      expect(prompt).toContain("Return ONLY valid JSON");
      expect(prompt).toContain('"languages"');
      expect(prompt).toContain('"test"');
      expect(prompt).toContain('"confidence"');
    });
  });

  describe("parseCapabilityResponse", () => {
    it("should parse valid JSON response", () => {
      const response = JSON.stringify({
        languages: ["java"],
        test: {
          available: true,
          command: "./gradlew test",
          framework: "junit",
          confidence: 0.95,
        },
        typecheck: {
          available: true,
          command: "./gradlew compileJava",
          confidence: 0.9,
        },
        lint: { available: false },
        build: {
          available: true,
          command: "./gradlew build",
          confidence: 0.95,
        },
      });

      const result = parseCapabilityResponse(response);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.languages).toContain("java");
        expect(result.data.test?.command).toBe("./gradlew test");
        expect(result.data.test?.confidence).toBe(0.95);
      }
    });

    it("should extract JSON from markdown code block", () => {
      const response = `Here is my analysis:

\`\`\`json
{
  "languages": ["ruby"],
  "test": { "available": true, "command": "bundle exec rspec" }
}
\`\`\`

That's my recommendation.`;

      const result = parseCapabilityResponse(response);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.languages).toContain("ruby");
      }
    });

    it("should return error for invalid JSON", () => {
      const response = "This is not valid JSON at all";

      const result = parseCapabilityResponse(response);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Failed to parse");
      }
    });

    it("should return error for missing languages field", () => {
      const response = JSON.stringify({
        test: { available: true },
      });

      const result = parseCapabilityResponse(response);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("languages");
      }
    });

    it("should handle custom rules", () => {
      const response = JSON.stringify({
        languages: ["java"],
        customRules: [
          {
            id: "integration-test",
            description: "Run integration tests",
            command: "./gradlew integrationTest",
            type: "test",
          },
        ],
      });

      const result = parseCapabilityResponse(response);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customRules).toHaveLength(1);
        expect(result.data.customRules![0].id).toBe("integration-test");
      }
    });
  });
});

// ============================================================================
// Format Tests
// ============================================================================

describe("Capability Formatting", () => {
  describe("formatExtendedCapabilities", () => {
    it("should include source and confidence", () => {
      const caps = createTestCapabilities({
        source: "ai-discovered",
        confidence: 0.85,
      });

      const output = formatExtendedCapabilities(caps);

      expect(output).toContain("ai-discovered");
      expect(output).toContain("85%");
    });

    it("should list detected languages", () => {
      const caps = createTestCapabilities({
        languages: ["java", "kotlin"],
      });

      const output = formatExtendedCapabilities(caps);

      expect(output).toContain("java");
      expect(output).toContain("kotlin");
    });

    it("should show available capabilities", () => {
      const caps = createTestCapabilities();

      const output = formatExtendedCapabilities(caps);

      expect(output).toContain("vitest");
      expect(output).toContain("npm test");
      expect(output).toContain("tsc --noEmit");
      expect(output).toContain("npm run build");
    });

    it("should show Not detected for unavailable capabilities", () => {
      const caps = createTestCapabilities({
        hasLint: false,
        lintInfo: { available: false, confidence: 0 },
      });

      const output = formatExtendedCapabilities(caps);

      expect(output).toContain("Lint: Not detected");
    });
  });
});
