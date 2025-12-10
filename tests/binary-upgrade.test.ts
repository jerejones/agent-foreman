/**
 * Tests for binary self-update module
 * Covers platform detection, version parsing, and upgrade functionality
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  getBinaryName,
  getCurrentExecutablePath,
  validateExecutablePath,
  parseVersionFromTag,
  fetchLatestRelease,
  fetchLatestGitHubVersion,
  canWriteToExecutable,
  performBinaryUpgrade,
  replaceBinary,
} from "../src/binary-upgrade.js";

// ============================================================================
// Mock setup
// ============================================================================

// Mock os module for platform/arch testing
vi.mock("node:os", async () => {
  const actual = await vi.importActual("node:os");
  return {
    ...actual,
    platform: vi.fn().mockReturnValue("darwin"),
    arch: vi.fn().mockReturnValue("arm64"),
    tmpdir: vi.fn().mockReturnValue("/tmp"),
  };
});

// Mock fs module
vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    realpathSync: vi.fn().mockReturnValue("/usr/local/bin/agent-foreman"),
    existsSync: vi.fn().mockReturnValue(true),
    renameSync: vi.fn(),
    chmodSync: vi.fn(),
    unlinkSync: vi.fn(),
    writeFileSync: vi.fn(),
    accessSync: vi.fn(),
    constants: (actual as typeof fs).constants,
  };
});

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Binary Upgrade Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // getBinaryName Tests
  // ============================================================================

  describe("getBinaryName", () => {
    it("should return correct name for macOS arm64", () => {
      (os.platform as ReturnType<typeof vi.fn>).mockReturnValue("darwin");
      (os.arch as ReturnType<typeof vi.fn>).mockReturnValue("arm64");

      const name = getBinaryName();
      expect(name).toBe("agent-foreman-darwin-arm64");
    });

    it("should return correct name for macOS x64", () => {
      (os.platform as ReturnType<typeof vi.fn>).mockReturnValue("darwin");
      (os.arch as ReturnType<typeof vi.fn>).mockReturnValue("x64");

      const name = getBinaryName();
      expect(name).toBe("agent-foreman-darwin-x64");
    });

    it("should return correct name for Linux x64", () => {
      (os.platform as ReturnType<typeof vi.fn>).mockReturnValue("linux");
      (os.arch as ReturnType<typeof vi.fn>).mockReturnValue("x64");

      const name = getBinaryName();
      expect(name).toBe("agent-foreman-linux-x64");
    });

    it("should return correct name for Linux arm64", () => {
      (os.platform as ReturnType<typeof vi.fn>).mockReturnValue("linux");
      (os.arch as ReturnType<typeof vi.fn>).mockReturnValue("arm64");

      const name = getBinaryName();
      expect(name).toBe("agent-foreman-linux-arm64");
    });

    it("should return .exe extension for Windows", () => {
      (os.platform as ReturnType<typeof vi.fn>).mockReturnValue("win32");
      (os.arch as ReturnType<typeof vi.fn>).mockReturnValue("x64");

      const name = getBinaryName();
      expect(name).toBe("agent-foreman-windows-x64.exe");
    });

    it("should handle unknown architecture by defaulting to x64", () => {
      (os.platform as ReturnType<typeof vi.fn>).mockReturnValue("darwin");
      (os.arch as ReturnType<typeof vi.fn>).mockReturnValue("unknown");

      const name = getBinaryName();
      expect(name).toBe("agent-foreman-darwin-x64");
    });

    it("should handle unknown platform by using platform name directly", () => {
      (os.platform as ReturnType<typeof vi.fn>).mockReturnValue("freebsd");
      (os.arch as ReturnType<typeof vi.fn>).mockReturnValue("x64");

      const name = getBinaryName();
      expect(name).toBe("agent-foreman-freebsd-x64");
    });
  });

  // ============================================================================
  // getCurrentExecutablePath Tests
  // ============================================================================

  describe("getCurrentExecutablePath", () => {
    it("should return resolved path", () => {
      (fs.realpathSync as ReturnType<typeof vi.fn>).mockReturnValue(
        "/usr/local/bin/agent-foreman"
      );

      const execPath = getCurrentExecutablePath();
      expect(execPath).toBe("/usr/local/bin/agent-foreman");
    });

    it("should return original path if realpath fails", () => {
      (fs.realpathSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("realpath failed");
      });

      const execPath = getCurrentExecutablePath();
      // Falls back to process.execPath
      expect(typeof execPath).toBe("string");
    });
  });

  // ============================================================================
  // validateExecutablePath Tests - Critical Safety Checks
  // ============================================================================

  describe("validateExecutablePath", () => {
    it("should return null (safe) for valid agent-foreman paths", () => {
      expect(validateExecutablePath("/usr/local/bin/agent-foreman")).toBeNull();
      expect(validateExecutablePath("/home/user/.local/bin/agent-foreman")).toBeNull();
      expect(validateExecutablePath("/opt/agent-foreman-darwin-arm64")).toBeNull();
      expect(validateExecutablePath("C:\\Program Files\\agent-foreman.exe")).toBeNull();
      expect(validateExecutablePath("/Users/test/Downloads/agent-foreman-linux-x64")).toBeNull();
    });

    it("should return null (safe) for paths containing foreman", () => {
      expect(validateExecutablePath("/usr/bin/foreman")).toBeNull();
      expect(validateExecutablePath("/home/user/foreman-cli")).toBeNull();
    });

    it("should block node binary - CRITICAL SAFETY CHECK", () => {
      const error = validateExecutablePath("/usr/local/bin/node");
      expect(error).not.toBeNull();
      expect(error).toContain("Refusing to replace node binary");
    });

    it("should block bun binary - CRITICAL SAFETY CHECK", () => {
      const error = validateExecutablePath("/home/user/.bun/bin/bun");
      expect(error).not.toBeNull();
      expect(error).toContain("Refusing to replace");
    });

    it("should block node.exe on Windows - CRITICAL SAFETY CHECK", () => {
      const error = validateExecutablePath("C:\\Program Files\\nodejs\\node.exe");
      expect(error).not.toBeNull();
      // May match either the forbidden binary check or the forbidden path check
      expect(error).toContain("Refusing to replace");
    });

    it("should block deno binary", () => {
      const error = validateExecutablePath("/usr/bin/deno");
      expect(error).not.toBeNull();
      expect(error).toContain("Refusing to replace deno binary");
    });

    it("should block npm binary", () => {
      const error = validateExecutablePath("/usr/local/bin/npm");
      expect(error).not.toBeNull();
      expect(error).toContain("Refusing to replace npm binary");
    });

    it("should block npx binary", () => {
      const error = validateExecutablePath("/usr/local/bin/npx");
      expect(error).not.toBeNull();
      expect(error).toContain("Refusing to replace npx binary");
    });

    it("should block pnpm binary", () => {
      const error = validateExecutablePath("/usr/local/bin/pnpm");
      expect(error).not.toBeNull();
      expect(error).toContain("Refusing to replace pnpm binary");
    });

    it("should block yarn binary", () => {
      const error = validateExecutablePath("/usr/local/bin/yarn");
      expect(error).not.toBeNull();
      expect(error).toContain("Refusing to replace yarn binary");
    });

    it("should block paths inside node_modules", () => {
      const error = validateExecutablePath("/home/user/project/node_modules/.bin/something");
      expect(error).not.toBeNull();
      expect(error).toContain("Refusing to replace binary in /node_modules/");
    });

    it("should block paths inside .nvm directory", () => {
      const error = validateExecutablePath("/home/user/.nvm/versions/node/v18.0.0/bin/node");
      expect(error).not.toBeNull();
      expect(error).toContain("Refusing to replace");
    });

    it("should block paths inside .bun directory", () => {
      const error = validateExecutablePath("/home/user/.bun/bin/bun");
      expect(error).not.toBeNull();
      expect(error).toContain("Refusing to replace");
    });

    it("should block unrecognized binaries without agent-foreman in name", () => {
      const error = validateExecutablePath("/usr/local/bin/some-other-tool");
      expect(error).not.toBeNull();
      expect(error).toContain("does not appear to be agent-foreman");
    });

    it("should be case-insensitive for safety checks", () => {
      expect(validateExecutablePath("/usr/local/bin/NODE")).not.toBeNull();
      expect(validateExecutablePath("/usr/local/bin/Node.exe")).not.toBeNull();
      expect(validateExecutablePath("/usr/local/bin/AGENT-FOREMAN")).toBeNull();
    });
  });

  // ============================================================================
  // parseVersionFromTag Tests
  // ============================================================================

  describe("parseVersionFromTag", () => {
    it("should remove v prefix from version", () => {
      expect(parseVersionFromTag("v1.0.0")).toBe("1.0.0");
      expect(parseVersionFromTag("v0.1.91")).toBe("0.1.91");
    });

    it("should handle version without v prefix", () => {
      expect(parseVersionFromTag("1.0.0")).toBe("1.0.0");
      expect(parseVersionFromTag("2.3.4")).toBe("2.3.4");
    });

    it("should only remove first v", () => {
      expect(parseVersionFromTag("vv1.0.0")).toBe("v1.0.0");
    });
  });

  // ============================================================================
  // fetchLatestRelease Tests
  // ============================================================================

  describe("fetchLatestRelease", () => {
    it("should return release data on success", async () => {
      const mockRelease = {
        tag_name: "v1.0.0",
        assets: [
          { name: "agent-foreman-darwin-arm64", browser_download_url: "https://example.com/download", size: 1000000 },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRelease),
      });

      const release = await fetchLatestRelease();
      expect(release).toEqual(mockRelease);
    });

    it("should return null on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const release = await fetchLatestRelease();
      expect(release).toBeNull();
    });

    it("should return null on fetch error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const release = await fetchLatestRelease();
      expect(release).toBeNull();
    });
  });

  // ============================================================================
  // fetchLatestGitHubVersion Tests
  // ============================================================================

  describe("fetchLatestGitHubVersion", () => {
    it("should return version from release tag", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tag_name: "v1.2.3", assets: [] }),
      });

      const version = await fetchLatestGitHubVersion();
      expect(version).toBe("1.2.3");
    });

    it("should return null when no release found", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const version = await fetchLatestGitHubVersion();
      expect(version).toBeNull();
    });
  });

  // ============================================================================
  // canWriteToExecutable Tests
  // ============================================================================

  describe("canWriteToExecutable", () => {
    it("should return true when write access is available", () => {
      (fs.accessSync as ReturnType<typeof vi.fn>).mockImplementation(() => {});

      const canWrite = canWriteToExecutable();
      expect(canWrite).toBe(true);
    });

    it("should return false when write access is denied", () => {
      (fs.accessSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("EACCES: permission denied");
      });

      const canWrite = canWriteToExecutable();
      expect(canWrite).toBe(false);
    });
  });

  // ============================================================================
  // replaceBinary Tests
  // ============================================================================

  describe("replaceBinary", () => {
    beforeEach(() => {
      // Reset fs mocks for clean state
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.renameSync as ReturnType<typeof vi.fn>).mockImplementation(() => {});
      (fs.chmodSync as ReturnType<typeof vi.fn>).mockImplementation(() => {});
      (fs.unlinkSync as ReturnType<typeof vi.fn>).mockImplementation(() => {});
      (fs.writeFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {});
      (os.platform as ReturnType<typeof vi.fn>).mockReturnValue("darwin");
    });

    it("should download and replace binary successfully", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });

      await replaceBinary("https://example.com/binary", "agent-foreman-darwin-arm64");

      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(fs.renameSync).toHaveBeenCalled();
      expect(fs.chmodSync).toHaveBeenCalled();
    });

    it("should throw on download failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(
        replaceBinary("https://example.com/binary", "agent-foreman-darwin-arm64")
      ).rejects.toThrow("Download failed: 404 Not Found");
    });

    it("should throw when backup fails", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });

      (fs.renameSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("EPERM: operation not permitted");
      });

      await expect(
        replaceBinary("https://example.com/binary", "agent-foreman-darwin-arm64")
      ).rejects.toThrow("Cannot backup current binary");
    });

    it("should skip chmod on Windows", async () => {
      (os.platform as ReturnType<typeof vi.fn>).mockReturnValue("win32");

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });

      // Make existsSync return false for current path to skip backup
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      await replaceBinary("https://example.com/binary", "agent-foreman-windows-x64.exe");

      expect(fs.chmodSync).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // performBinaryUpgrade Tests
  // ============================================================================

  describe("performBinaryUpgrade", () => {
    beforeEach(() => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
      (fs.renameSync as ReturnType<typeof vi.fn>).mockImplementation(() => {});
      (fs.chmodSync as ReturnType<typeof vi.fn>).mockImplementation(() => {});
      (fs.writeFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {});
      (os.platform as ReturnType<typeof vi.fn>).mockReturnValue("darwin");
      (os.arch as ReturnType<typeof vi.fn>).mockReturnValue("arm64");
      // Default to safe agent-foreman path
      (fs.realpathSync as ReturnType<typeof vi.fn>).mockReturnValue("/usr/local/bin/agent-foreman");
    });

    it("should return error when safety validation fails - blocks node replacement", async () => {
      // Simulate the bug scenario: process.execPath returns node
      (fs.realpathSync as ReturnType<typeof vi.fn>).mockReturnValue("/usr/local/bin/node");
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const result = await performBinaryUpgrade("1.0.0", "2.0.0");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Safety check failed");
      expect(result.error).toContain("Refusing to replace node binary");
    });

    it("should return error when safety validation fails - blocks bun replacement", async () => {
      // Simulate bun runtime being detected
      (fs.realpathSync as ReturnType<typeof vi.fn>).mockReturnValue("/home/user/.bun/bin/bun");
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const result = await performBinaryUpgrade("1.0.0", "2.0.0");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Safety check failed");
    });

    it("should return error when safety validation fails - unrecognized binary", async () => {
      // Simulate unrecognized binary
      (fs.realpathSync as ReturnType<typeof vi.fn>).mockReturnValue("/usr/bin/some-random-binary");
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const result = await performBinaryUpgrade("1.0.0", "2.0.0");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Safety check failed");
      expect(result.error).toContain("does not appear to be agent-foreman");
    });

    it("should return error when release fetch fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await performBinaryUpgrade("1.0.0", "2.0.0");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Could not fetch release information");
    });

    it("should return error when no matching asset found", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tag_name: "v2.0.0",
            assets: [
              { name: "agent-foreman-linux-x64", browser_download_url: "https://example.com", size: 1000000 },
            ],
          }),
      });

      const result = await performBinaryUpgrade("1.0.0", "2.0.0");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No binary available for your platform");
    });

    it("should succeed when matching asset found and download succeeds", async () => {
      // First call for release info
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tag_name: "v2.0.0",
            assets: [
              {
                name: "agent-foreman-darwin-arm64",
                browser_download_url: "https://example.com/download",
                size: 1000000,
              },
            ],
          }),
      });

      // Second call for download
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });

      const result = await performBinaryUpgrade("1.0.0", "2.0.0");

      expect(result.success).toBe(true);
    });

    it("should return error when download fails", async () => {
      // First call for release info
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tag_name: "v2.0.0",
            assets: [
              {
                name: "agent-foreman-darwin-arm64",
                browser_download_url: "https://example.com/download",
                size: 1000000,
              },
            ],
          }),
      });

      // Second call for download fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = await performBinaryUpgrade("1.0.0", "2.0.0");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Download failed");
    });

    it("should handle unexpected errors during fetch", async () => {
      // When fetch throws, fetchLatestRelease catches and returns null
      // So performBinaryUpgrade returns the "Could not fetch" error
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await performBinaryUpgrade("1.0.0", "2.0.0");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Could not fetch release information");
    });
  });
});
