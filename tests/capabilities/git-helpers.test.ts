/**
 * Tests for git-helpers.ts
 * Tests git helper functions for capability cache validation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as childProcess from "node:child_process";

import {
  getGitCommitHash,
  hasCommitChanged,
  hasBuildFileChanges,
  checkGitAvailable,
} from "../../src/capabilities/git-helpers.js";

// Mock child_process
vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

describe("git-helpers", () => {
  const mockSpawnSync = vi.mocked(childProcess.spawnSync);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getGitCommitHash()", () => {
    it("should return commit hash on success", () => {
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: "abc123def456\n",
        stderr: "",
        pid: 1,
        output: [],
        signal: null,
      });

      const result = getGitCommitHash("/test/dir");

      expect(result).toBe("abc123def456");
      expect(mockSpawnSync).toHaveBeenCalledWith("git", ["rev-parse", "HEAD"], {
        cwd: "/test/dir",
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    });

    it("should return undefined when git command fails", () => {
      mockSpawnSync.mockReturnValue({
        status: 1,
        stdout: "",
        stderr: "fatal: not a git repository",
        pid: 1,
        output: [],
        signal: null,
      });

      const result = getGitCommitHash("/test/dir");

      expect(result).toBeUndefined();
    });

    it("should return undefined when exception is thrown", () => {
      mockSpawnSync.mockImplementation(() => {
        throw new Error("spawn failed");
      });

      const result = getGitCommitHash("/test/dir");

      expect(result).toBeUndefined();
    });
  });

  describe("hasCommitChanged()", () => {
    it("should return false when commits match", () => {
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: "abc123\n",
        stderr: "",
        pid: 1,
        output: [],
        signal: null,
      });

      const result = hasCommitChanged("/test/dir", "abc123");

      expect(result).toBe(false);
    });

    it("should return true when commits differ", () => {
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: "def456\n",
        stderr: "",
        pid: 1,
        output: [],
        signal: null,
      });

      const result = hasCommitChanged("/test/dir", "abc123");

      expect(result).toBe(true);
    });

    it("should return true when git fails (assume stale)", () => {
      mockSpawnSync.mockReturnValue({
        status: 1,
        stdout: "",
        stderr: "error",
        pid: 1,
        output: [],
        signal: null,
      });

      const result = hasCommitChanged("/test/dir", "abc123");

      expect(result).toBe(true);
    });
  });

  describe("hasBuildFileChanges()", () => {
    it("should return false when no files changed", () => {
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: "",
        stderr: "",
        pid: 1,
        output: [],
        signal: null,
      });

      const result = hasBuildFileChanges("/test/dir", "abc123", [
        "package.json",
        "tsconfig.json",
      ]);

      expect(result).toBe(false);
      expect(mockSpawnSync).toHaveBeenCalledWith(
        "git",
        ["diff", "--name-only", "abc123", "HEAD", "--", "package.json", "tsconfig.json"],
        expect.any(Object)
      );
    });

    it("should return true when files changed", () => {
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: "package.json\n",
        stderr: "",
        pid: 1,
        output: [],
        signal: null,
      });

      const result = hasBuildFileChanges("/test/dir", "abc123", ["package.json"]);

      expect(result).toBe(true);
    });

    it("should return true when git diff fails", () => {
      mockSpawnSync.mockReturnValue({
        status: 128,
        stdout: "",
        stderr: "fatal: bad revision",
        pid: 1,
        output: [],
        signal: null,
      });

      const result = hasBuildFileChanges("/test/dir", "invalid", ["package.json"]);

      expect(result).toBe(true);
    });

    it("should return true when exception is thrown", () => {
      mockSpawnSync.mockImplementation(() => {
        throw new Error("spawn failed");
      });

      const result = hasBuildFileChanges("/test/dir", "abc123", ["package.json"]);

      expect(result).toBe(true);
    });
  });

  describe("checkGitAvailable()", () => {
    it("should return true when git is available", () => {
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: ".git\n",
        stderr: "",
        pid: 1,
        output: [],
        signal: null,
      });

      const result = checkGitAvailable("/test/dir");

      expect(result).toBe(true);
      expect(mockSpawnSync).toHaveBeenCalledWith("git", ["rev-parse", "--git-dir"], {
        cwd: "/test/dir",
        stdio: ["pipe", "pipe", "pipe"],
      });
    });

    it("should return false when not a git repo", () => {
      mockSpawnSync.mockReturnValue({
        status: 128,
        stdout: "",
        stderr: "fatal: not a git repository",
        pid: 1,
        output: [],
        signal: null,
      });

      const result = checkGitAvailable("/test/dir");

      expect(result).toBe(false);
    });

    it("should return false when exception is thrown", () => {
      mockSpawnSync.mockImplementation(() => {
        throw new Error("git not found");
      });

      const result = checkGitAvailable("/test/dir");

      expect(result).toBe(false);
    });
  });
});
