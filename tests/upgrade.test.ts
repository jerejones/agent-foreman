/**
 * Tests for auto-upgrade utility
 * Covers version checking, throttling, and upgrade functionality
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import {
  getCurrentVersion,
  fetchLatestVersion,
  compareVersions,
  checkForUpgrade,
  forceUpgradeCheck,
  interactiveUpgradeCheck,
  performInteractiveUpgrade,
} from "../src/upgrade.js";

// ============================================================================
// Mock setup
// ============================================================================

// Mock child_process
vi.mock("node:child_process", async () => {
  const actual = await vi.importActual("node:child_process");
  return {
    ...actual,
    spawnSync: vi.fn().mockReturnValue({
      status: 0,
      stdout: "1.0.0\n",
      stderr: "",
    }),
  };
});

// ============================================================================
// compareVersions Tests
// ============================================================================

describe("Upgrade Utils", () => {
  describe("compareVersions", () => {
    it("should return 0 for equal versions", () => {
      expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
      expect(compareVersions("2.3.4", "2.3.4")).toBe(0);
      expect(compareVersions("0.0.1", "0.0.1")).toBe(0);
    });

    it("should return 1 when first version is greater", () => {
      expect(compareVersions("2.0.0", "1.0.0")).toBe(1);
      expect(compareVersions("1.1.0", "1.0.0")).toBe(1);
      expect(compareVersions("1.0.1", "1.0.0")).toBe(1);
      expect(compareVersions("1.0.10", "1.0.9")).toBe(1);
    });

    it("should return -1 when first version is smaller", () => {
      expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
      expect(compareVersions("1.0.0", "1.1.0")).toBe(-1);
      expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
      expect(compareVersions("1.0.9", "1.0.10")).toBe(-1);
    });

    it("should handle versions with different segment counts", () => {
      expect(compareVersions("1.0", "1.0.0")).toBe(0);
      expect(compareVersions("1.0.0", "1.0")).toBe(0);
      expect(compareVersions("1.0.1", "1.0")).toBe(1);
      expect(compareVersions("1.0", "1.0.1")).toBe(-1);
    });

    it("should handle versions with leading zeros", () => {
      expect(compareVersions("01.0.0", "1.0.0")).toBe(0);
      expect(compareVersions("1.02.0", "1.2.0")).toBe(0);
    });

    it("should handle edge cases", () => {
      expect(compareVersions("0.0.0", "0.0.0")).toBe(0);
      expect(compareVersions("0.0.1", "0.0.0")).toBe(1);
      expect(compareVersions("10.20.30", "10.20.30")).toBe(0);
    });
  });

  // ============================================================================
  // getCurrentVersion Tests
  // ============================================================================

  describe("getCurrentVersion", () => {
    it("should return a version string", () => {
      const version = getCurrentVersion();
      expect(typeof version).toBe("string");
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("should match package.json version", async () => {
      const pkgPath = path.join(process.cwd(), "package.json");
      const pkgContent = await fs.readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(pkgContent);

      const version = getCurrentVersion();
      expect(version).toBe(pkg.version);
    });
  });

  // ============================================================================
  // fetchLatestVersion Tests
  // ============================================================================

  describe("fetchLatestVersion", () => {
    it("should return a version string when npm is available", async () => {
      const { spawnSync } = await import("node:child_process");
      (spawnSync as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        status: 0,
        stdout: "1.2.3\n",
        stderr: "",
      });

      const version = await fetchLatestVersion();
      expect(version).toBe("1.2.3");
    });

    it("should return null when npm fails", async () => {
      const { spawnSync } = await import("node:child_process");
      (spawnSync as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        status: 1,
        stdout: "",
        stderr: "error",
      });

      const version = await fetchLatestVersion();
      expect(version).toBeNull();
    });

    it("should return null when npm returns empty output", async () => {
      const { spawnSync } = await import("node:child_process");
      (spawnSync as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        status: 0,
        stdout: "",
        stderr: "",
      });

      const version = await fetchLatestVersion();
      expect(version).toBeNull();
    });
  });

  // ============================================================================
  // checkForUpgrade Tests
  // ============================================================================

  describe("checkForUpgrade", () => {
    it("should detect when upgrade is needed", async () => {
      const { spawnSync } = await import("node:child_process");
      (spawnSync as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        status: 0,
        stdout: "999.0.0\n", // Much higher than current version
        stderr: "",
      });

      const result = await checkForUpgrade();
      expect(result.needsUpgrade).toBe(true);
      expect(result.latestVersion).toBe("999.0.0");
    });

    it("should not upgrade when current version is latest", async () => {
      const currentVersion = getCurrentVersion();
      const { spawnSync } = await import("node:child_process");
      (spawnSync as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        status: 0,
        stdout: `${currentVersion}\n`,
        stderr: "",
      });

      const result = await checkForUpgrade();
      expect(result.needsUpgrade).toBe(false);
      expect(result.currentVersion).toBe(currentVersion);
    });

    it("should not upgrade when current version is ahead", async () => {
      const { spawnSync } = await import("node:child_process");
      (spawnSync as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        status: 0,
        stdout: "0.0.1\n", // Much lower than current version
        stderr: "",
      });

      const result = await checkForUpgrade();
      expect(result.needsUpgrade).toBe(false);
    });

    it("should handle fetch errors gracefully", async () => {
      const { spawnSync } = await import("node:child_process");
      (spawnSync as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        status: 1,
        stdout: "",
        stderr: "network error",
      });

      const result = await checkForUpgrade();
      expect(result.needsUpgrade).toBe(false);
      expect(result.latestVersion).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // interactiveUpgradeCheck Tests
  // ============================================================================

  describe("interactiveUpgradeCheck", () => {
    const cacheFile = path.join(
      process.env.HOME || process.env.USERPROFILE || "/tmp",
      ".agent-foreman-upgrade-check"
    );

    beforeEach(async () => {
      // Remove cache file before each test
      try {
        await fs.unlink(cacheFile);
      } catch {
        // File doesn't exist, ignore
      }
    });

    afterEach(async () => {
      // Clean up cache file
      try {
        await fs.unlink(cacheFile);
      } catch {
        // File doesn't exist, ignore
      }
    });

    it("should check for upgrade when cache file does not exist", async () => {
      const { spawnSync } = await import("node:child_process");
      (spawnSync as ReturnType<typeof vi.fn>).mockReturnValue({
        status: 0,
        stdout: "0.0.1\n", // Lower version, no upgrade needed
        stderr: "",
      });

      await interactiveUpgradeCheck();

      // Cache file should be created
      const stat = await fs.stat(cacheFile);
      expect(stat).toBeDefined();
    });

    it("should skip check when within throttle interval", async () => {
      // Create cache file with current timestamp
      await fs.writeFile(cacheFile, new Date().toISOString());

      const { spawnSync } = await import("node:child_process");
      (spawnSync as ReturnType<typeof vi.fn>).mockClear();

      await interactiveUpgradeCheck();

      // spawnSync should not have been called (check was skipped)
      expect(spawnSync).not.toHaveBeenCalled();
    });

    it("should check when cache file is old enough", async () => {
      // Create cache file with old timestamp (25 hours ago)
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      await fs.writeFile(cacheFile, oldDate.toISOString());
      // Update mtime
      await fs.utimes(cacheFile, oldDate, oldDate);

      const { spawnSync } = await import("node:child_process");
      (spawnSync as ReturnType<typeof vi.fn>).mockReturnValue({
        status: 0,
        stdout: "0.0.1\n",
        stderr: "",
      });

      await interactiveUpgradeCheck();

      expect(spawnSync).toHaveBeenCalled();
    });

    it("should not throw on errors", async () => {
      const { spawnSync } = await import("node:child_process");
      (spawnSync as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new Error("npm crashed");
      });

      // Should not throw
      await expect(interactiveUpgradeCheck()).resolves.toBeUndefined();
    });

    it("should skip prompt in non-TTY mode", async () => {
      // Remove cache to force check
      const { spawnSync } = await import("node:child_process");
      (spawnSync as ReturnType<typeof vi.fn>).mockReturnValue({
        status: 0,
        stdout: "999.0.0\n", // Higher version, upgrade available
        stderr: "",
      });

      // In test environment, stdin is not a TTY, so prompt should be skipped
      // This should not throw and should complete without hanging
      await interactiveUpgradeCheck();

      // Cache file should still be created
      const stat = await fs.stat(cacheFile);
      expect(stat).toBeDefined();
    });
  });

  // ============================================================================
  // performInteractiveUpgrade Tests
  // ============================================================================

  describe("performInteractiveUpgrade", () => {
    it("should return success when npm install succeeds", async () => {
      const { spawnSync } = await import("node:child_process");
      (spawnSync as ReturnType<typeof vi.fn>).mockReturnValue({
        status: 0,
        stdout: "",
        stderr: "",
      });

      const result = await performInteractiveUpgrade("1.0.0", "2.0.0");

      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe("1.0.0");
      expect(result.toVersion).toBe("2.0.0");
    });

    it("should return error when npm install fails", async () => {
      const { spawnSync } = await import("node:child_process");
      (spawnSync as ReturnType<typeof vi.fn>).mockReturnValue({
        status: 1,
        stdout: "",
        stderr: "Permission denied",
      });

      const result = await performInteractiveUpgrade("1.0.0", "2.0.0");

      expect(result.success).toBe(false);
      expect(result.error).toContain("npm upgrade failed");
    });
  });

  // ============================================================================
  // forceUpgradeCheck Tests
  // ============================================================================

  describe("forceUpgradeCheck", () => {
    it("should bypass throttle and check immediately", async () => {
      const { spawnSync } = await import("node:child_process");
      (spawnSync as ReturnType<typeof vi.fn>).mockReturnValue({
        status: 0,
        stdout: "999.0.0\n",
        stderr: "",
      });

      const result = await forceUpgradeCheck();

      expect(result.needsUpgrade).toBe(true);
      expect(result.latestVersion).toBe("999.0.0");
    });

    it("should update last check time", async () => {
      const cacheFile = path.join(
        process.env.HOME || process.env.USERPROFILE || "/tmp",
        ".agent-foreman-upgrade-check"
      );

      const { spawnSync } = await import("node:child_process");
      (spawnSync as ReturnType<typeof vi.fn>).mockReturnValue({
        status: 0,
        stdout: "0.0.1\n",
        stderr: "",
      });

      await forceUpgradeCheck();

      const stat = await fs.stat(cacheFile);
      const now = Date.now();
      expect(stat.mtime.getTime()).toBeCloseTo(now, -3); // Within 1 second
    });
  });
});
