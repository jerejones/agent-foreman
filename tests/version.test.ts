/**
 * Tests for version.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCurrentVersion, compareVersions } from "../src/version.js";

describe("version", () => {
  describe("getCurrentVersion()", () => {
    it("should return a valid semver version string", () => {
      const version = getCurrentVersion();
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it("should return the version from package.json", () => {
      const version = getCurrentVersion();
      // Version should be truthy and not the fallback
      expect(version).not.toBe("0.0.0");
      expect(version.length).toBeGreaterThan(0);
    });
  });

  describe("compareVersions()", () => {
    it("should return 0 for equal versions", () => {
      expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
      expect(compareVersions("2.5.3", "2.5.3")).toBe(0);
      expect(compareVersions("0.0.1", "0.0.1")).toBe(0);
    });

    it("should return positive when first version is greater (major)", () => {
      expect(compareVersions("2.0.0", "1.0.0")).toBeGreaterThan(0);
      expect(compareVersions("10.0.0", "9.0.0")).toBeGreaterThan(0);
    });

    it("should return negative when first version is smaller (major)", () => {
      expect(compareVersions("1.0.0", "2.0.0")).toBeLessThan(0);
      expect(compareVersions("9.0.0", "10.0.0")).toBeLessThan(0);
    });

    it("should return positive when first version is greater (minor)", () => {
      expect(compareVersions("1.2.0", "1.1.0")).toBeGreaterThan(0);
      expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    });

    it("should return negative when first version is smaller (minor)", () => {
      expect(compareVersions("1.1.0", "1.2.0")).toBeLessThan(0);
      expect(compareVersions("1.9.0", "1.10.0")).toBeLessThan(0);
    });

    it("should return positive when first version is greater (patch)", () => {
      expect(compareVersions("1.0.2", "1.0.1")).toBeGreaterThan(0);
      expect(compareVersions("1.0.10", "1.0.9")).toBeGreaterThan(0);
    });

    it("should return negative when first version is smaller (patch)", () => {
      expect(compareVersions("1.0.1", "1.0.2")).toBeLessThan(0);
      expect(compareVersions("1.0.9", "1.0.10")).toBeLessThan(0);
    });

    it("should handle versions with v prefix", () => {
      expect(compareVersions("v1.0.0", "1.0.0")).toBe(0);
      expect(compareVersions("1.0.0", "v1.0.0")).toBe(0);
      expect(compareVersions("v2.0.0", "v1.0.0")).toBeGreaterThan(0);
    });

    it("should handle versions with different segment counts", () => {
      // 1.0 should equal 1.0.0
      expect(compareVersions("1.0", "1.0.0")).toBe(0);
      expect(compareVersions("1.0.0", "1.0")).toBe(0);
      // 1.1 should be greater than 1.0.9
      expect(compareVersions("1.1", "1.0.9")).toBeGreaterThan(0);
    });

    it("should handle non-numeric segments gracefully", () => {
      // Non-numeric segments are treated as 0 via parseInt fallback
      expect(compareVersions("1.0.0", "1.0.alpha")).toBe(0); // alpha becomes 0
      expect(compareVersions("1.abc.0", "1.0.0")).toBe(0);   // abc becomes 0
      expect(compareVersions("1.1.0", "1.alpha.0")).toBeGreaterThan(0); // 1 > 0
    });

    it("should compare complex version scenarios correctly", () => {
      expect(compareVersions("0.1.147", "0.1.146")).toBeGreaterThan(0);
      expect(compareVersions("0.1.113", "0.1.147")).toBeLessThan(0);
      expect(compareVersions("1.0.0", "0.9.99")).toBeGreaterThan(0);
    });
  });
});
