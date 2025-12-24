/**
 * Tests for install command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { runInstall } from "../../src/commands/install.js";
import * as pluginInstaller from "../../src/plugin-installer.js";

// Mock chalk to avoid color codes in test output
vi.mock("chalk", () => ({
  default: {
    cyan: (s: string) => s,
    gray: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    white: (s: string) => s,
    red: (s: string) => s,
  },
}));

describe("runInstall", () => {
  let originalHome: string | undefined;
  let tempHome: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create a temporary home directory for testing
    tempHome = fs.mkdtempSync(path.join(tmpdir(), "install-cmd-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tempHome;

    // Ensure .claude directory structure exists
    fs.mkdirSync(path.join(tempHome, ".claude", "plugins"), { recursive: true });

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    // Restore original HOME
    if (originalHome) {
      process.env.HOME = originalHome;
    }
    // Clean up temp directory
    fs.rmSync(tempHome, { recursive: true, force: true });

    // Restore spies
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("should display plugin status header", async () => {
    await runInstall();

    expect(consoleLogSpy).toHaveBeenCalledWith("Agent Foreman Plugin Installer");
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("─"));
  });

  it("should show plugin status information", async () => {
    await runInstall();

    expect(consoleLogSpy).toHaveBeenCalledWith("Plugin Status:");
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Version:"));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Marketplace:"));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Plugin:"));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Enabled:"));
  });

  describe("when no embedded plugins available", () => {
    beforeEach(() => {
      // Mock hasEmbeddedPlugins to return false
      vi.spyOn(pluginInstaller, "hasEmbeddedPlugins").mockReturnValue(false);
    });

    it("should show no embedded plugins message", async () => {
      await runInstall();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("No embedded plugins available")
      );
    });

    it("should show instructions for building with embedded plugins", async () => {
      await runInstall();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("To build with embedded plugins")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("npm run build:bin"));
    });

    it("should show alternative GitHub installation instructions", async () => {
      await runInstall();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("install from GitHub")
      );
    });
  });

  describe("when in compiled mode", () => {
    beforeEach(() => {
      // Mock isCompiledBinary to return true
      vi.spyOn(pluginInstaller, "isCompiledBinary").mockReturnValue(true);
    });

    it("should show already installed message when fully installed", async () => {
      // Mock all status checks to return true
      vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
        marketplaceDir: "/some/path",
        bundledVersion: "1.0.0",
        isMarketplaceRegistered: true,
        isPluginInstalled: true,
        isPluginEnabled: true,
        installedVersion: "1.0.0",
      });

      await runInstall();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("already installed and enabled")
      );
    });

    it("should suggest --force flag when already installed", async () => {
      vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
        marketplaceDir: "/some/path",
        bundledVersion: "1.0.0",
        isMarketplaceRegistered: true,
        isPluginInstalled: true,
        isPluginEnabled: true,
        installedVersion: "1.0.0",
      });

      await runInstall();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("--force to reinstall")
      );
    });

    it("should perform installation when not fully installed", async () => {
      vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
        marketplaceDir: "/some/path",
        bundledVersion: "1.0.0",
        isMarketplaceRegistered: false,
        isPluginInstalled: false,
        isPluginEnabled: false,
        installedVersion: null,
      });

      const fullInstallSpy = vi.spyOn(pluginInstaller, "fullInstall").mockImplementation(() => {});

      await runInstall();

      expect(fullInstallSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Installing plugin")
      );
    });

    it("should show success message after installation", async () => {
      vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
        marketplaceDir: "/some/path",
        bundledVersion: "1.0.0",
        isMarketplaceRegistered: false,
        isPluginInstalled: false,
        isPluginEnabled: false,
        installedVersion: null,
      });

      vi.spyOn(pluginInstaller, "fullInstall").mockImplementation(() => {});

      await runInstall();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Plugin installed successfully")
      );
    });

    it("should show steps completed after installation", async () => {
      vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
        marketplaceDir: "/some/path",
        bundledVersion: "1.0.0",
        isMarketplaceRegistered: false,
        isPluginInstalled: false,
        isPluginEnabled: false,
        installedVersion: null,
      });

      vi.spyOn(pluginInstaller, "fullInstall").mockImplementation(() => {});

      await runInstall();

      expect(consoleLogSpy).toHaveBeenCalledWith("Steps completed:");
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("marketplace files"));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("known_marketplaces"));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("plugin to cache"));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("settings.json"));
    });

    it("should show restart message after installation", async () => {
      vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
        marketplaceDir: "/some/path",
        bundledVersion: "1.0.0",
        isMarketplaceRegistered: false,
        isPluginInstalled: false,
        isPluginEnabled: false,
        installedVersion: null,
      });

      vi.spyOn(pluginInstaller, "fullInstall").mockImplementation(() => {});

      await runInstall();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Restart Claude Code")
      );
    });

    it("should force reinstall with force flag", async () => {
      vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
        marketplaceDir: "/some/path",
        bundledVersion: "1.0.0",
        isMarketplaceRegistered: true,
        isPluginInstalled: true,
        isPluginEnabled: true,
        installedVersion: "1.0.0",
      });

      const fullInstallSpy = vi.spyOn(pluginInstaller, "fullInstall").mockImplementation(() => {});

      await runInstall(true); // force = true

      expect(fullInstallSpy).toHaveBeenCalled();
    });

    it("should handle installation error", async () => {
      vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
        marketplaceDir: "/some/path",
        bundledVersion: "1.0.0",
        isMarketplaceRegistered: false,
        isPluginInstalled: false,
        isPluginEnabled: false,
        installedVersion: null,
      });

      vi.spyOn(pluginInstaller, "fullInstall").mockImplementation(() => {
        throw new Error("Test error");
      });

      await runInstall();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to install plugin")
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
