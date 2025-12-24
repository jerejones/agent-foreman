/**
 * Tests for GitHub API client for gitignore templates
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir, homedir } from "node:os";
import {
  getCacheDir,
  getCacheTTL,
  fetchGitignoreTemplate,
  listGitignoreTemplates,
  clearCache,
  getCacheStats,
} from "../../src/gitignore/github-api.js";

describe("github-api", () => {
  describe("getCacheDir", () => {
    it("should return path in home directory", () => {
      const cacheDir = getCacheDir();
      expect(cacheDir).toContain(".agent-foreman");
      expect(cacheDir).toContain("gitignore-cache");
      expect(cacheDir).toContain(homedir());
    });
  });

  describe("getCacheTTL", () => {
    it("should return 7 days in milliseconds", () => {
      const ttl = getCacheTTL();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(ttl).toBe(sevenDaysMs);
    });
  });

  describe("fetchGitignoreTemplate", () => {
    const originalFetch = global.fetch;
    let tempCacheDir: string;

    beforeEach(() => {
      tempCacheDir = fs.mkdtempSync(path.join(tmpdir(), "gitignore-cache-test-"));
    });

    afterEach(() => {
      global.fetch = originalFetch;
      fs.rmSync(tempCacheDir, { recursive: true, force: true });
      vi.unstubAllGlobals();
    });

    it("should use bundled template as fallback when API fails", async () => {
      // Clear cache to ensure no stale entry exists for "Node"
      clearCache();

      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Network error"))
      );

      const result = await fetchGitignoreTemplate("Node");
      expect(result.source).toContain("node_modules");
      expect(result.fallback).toBe(true);
    });

    it("should throw error for unknown template when offline", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Network error"))
      );

      await expect(fetchGitignoreTemplate("UnknownTemplate123")).rejects.toThrow(
        "not found and no fallback available"
      );
    });

    it("should fetch template from API successfully", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: () => Promise.resolve({ source: "# Node gitignore\nnode_modules/" }),
        headers: new Map([["etag", '"abc123"']]),
      };
      (mockResponse.headers as any).get = (key: string) =>
        key === "etag" ? '"abc123"' : null;

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      // Clear any existing cache to ensure API is called
      clearCache();

      const result = await fetchGitignoreTemplate("TestTemplate");
      expect(result.source).toContain("node_modules");
      expect(result.fromCache).toBe(false);
      expect(result.fallback).toBe(false);
    });

    it("should handle 304 Not Modified response", async () => {
      // First, set up a cached entry
      const cacheDir = getCacheDir();
      fs.mkdirSync(cacheDir, { recursive: true });
      const cacheEntry = {
        source: "# Cached content\nnode_modules/",
        cachedAt: Date.now(),
        etag: '"abc123"',
      };
      fs.writeFileSync(
        path.join(cacheDir, "CachedTemplate.json"),
        JSON.stringify(cacheEntry)
      );

      const mockResponse = {
        ok: false,
        status: 304,
        json: () => Promise.resolve({}),
        headers: new Map(),
      };
      (mockResponse.headers as any).get = () => null;

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      const result = await fetchGitignoreTemplate("CachedTemplate");
      expect(result.source).toContain("Cached content");
      expect(result.fromCache).toBe(true);
    });

    it("should handle API errors and fall back to bundled", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
        headers: new Map(),
      };
      (mockResponse.headers as any).get = () => null;

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      const result = await fetchGitignoreTemplate("Node");
      expect(result.source).toContain("node_modules");
      expect(result.fallback).toBe(true);
    });
  });

  describe("listGitignoreTemplates", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("should return array of template names", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve(["Node", "Python", "Go"]),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      const templates = await listGitignoreTemplates();
      expect(templates).toContain("Node");
      expect(templates).toContain("Python");
      expect(templates).toContain("Go");
    });

    it("should return empty array on API error", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

      const templates = await listGitignoreTemplates();
      expect(templates).toEqual([]);
    });

    it("should return empty array on non-ok response", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      const templates = await listGitignoreTemplates();
      expect(templates).toEqual([]);
    });
  });

  describe("clearCache", () => {
    it("should remove all cached files", () => {
      const cacheDir = getCacheDir();
      fs.mkdirSync(cacheDir, { recursive: true });

      // Create some test cache files
      fs.writeFileSync(path.join(cacheDir, "Node.json"), "{}");
      fs.writeFileSync(path.join(cacheDir, "Python.json"), "{}");

      clearCache();

      const files = fs.existsSync(cacheDir)
        ? fs.readdirSync(cacheDir).filter((f) => f.endsWith(".json"))
        : [];
      expect(files).toEqual([]);
    });

    it("should handle non-existent cache directory", () => {
      // Just make sure it doesn't throw
      expect(() => clearCache()).not.toThrow();
    });
  });

  describe("getCacheStats", () => {
    beforeEach(() => {
      clearCache();
    });

    it("should return zero stats for empty cache", () => {
      const stats = getCacheStats();
      expect(stats.count).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.oldestFile).toBeUndefined();
    });

    it("should return correct stats for cached files", () => {
      const cacheDir = getCacheDir();
      fs.mkdirSync(cacheDir, { recursive: true });

      // Create test cache files
      const content1 = JSON.stringify({ source: "test1", cachedAt: Date.now() });
      const content2 = JSON.stringify({ source: "test2", cachedAt: Date.now() });
      fs.writeFileSync(path.join(cacheDir, "Template1.json"), content1);
      fs.writeFileSync(path.join(cacheDir, "Template2.json"), content2);

      const stats = getCacheStats();
      expect(stats.count).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it("should identify oldest file", () => {
      const cacheDir = getCacheDir();
      fs.mkdirSync(cacheDir, { recursive: true });

      // Create files with different modification times
      const oldContent = JSON.stringify({ source: "old", cachedAt: Date.now() - 10000 });
      fs.writeFileSync(path.join(cacheDir, "OldTemplate.json"), oldContent);

      // Wait a bit and create a newer file
      const newContent = JSON.stringify({ source: "new", cachedAt: Date.now() });
      fs.writeFileSync(path.join(cacheDir, "NewTemplate.json"), newContent);

      // Touch the old file to make it older
      const oldTime = new Date(Date.now() - 86400000); // 1 day ago
      fs.utimesSync(path.join(cacheDir, "OldTemplate.json"), oldTime, oldTime);

      const stats = getCacheStats();
      expect(stats.oldestFile).toBe("OldTemplate");
    });
  });
});
