/**
 * Tests for uninstall command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { runUninstall } from "../../src/commands/uninstall.js";
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

describe("runUninstall", () => {
  let originalHome: string | undefined;
  let tempHome: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create a temporary home directory for testing
    tempHome = fs.mkdtempSync(path.join(tmpdir(), "uninstall-cmd-test-"));
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

  it("should display uninstaller header", async () => {
    await runUninstall();

    expect(consoleLogSpy).toHaveBeenCalledWith("Agent Foreman Plugin Uninstaller");
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("─"));
  });

  it("should show current status", async () => {
    await runUninstall();

    expect(consoleLogSpy).toHaveBeenCalledWith("Current Status:");
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Marketplace:"));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Plugin:"));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Enabled:"));
  });

  it("should show nothing to uninstall message when not installed", async () => {
    vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
      marketplaceDir: "/some/path",
      bundledVersion: "1.0.0",
      isMarketplaceRegistered: false,
      isPluginInstalled: false,
      isPluginEnabled: false,
      installedVersion: null,
    });

    await runUninstall();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Nothing to uninstall")
    );
  });

  it("should suggest install command when not installed", async () => {
    vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
      marketplaceDir: "/some/path",
      bundledVersion: "1.0.0",
      isMarketplaceRegistered: false,
      isPluginInstalled: false,
      isPluginEnabled: false,
      installedVersion: null,
    });

    await runUninstall();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("agent-foreman install")
    );
  });

  it("should perform uninstallation when plugin is installed", async () => {
    vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
      marketplaceDir: "/some/path",
      bundledVersion: "1.0.0",
      isMarketplaceRegistered: true,
      isPluginInstalled: true,
      isPluginEnabled: true,
      installedVersion: "1.0.0",
    });

    const fullUninstallSpy = vi.spyOn(pluginInstaller, "fullUninstall").mockImplementation(() => {});

    await runUninstall();

    expect(fullUninstallSpy).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Uninstalling plugin")
    );
  });

  it("should show success message after uninstallation", async () => {
    vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
      marketplaceDir: "/some/path",
      bundledVersion: "1.0.0",
      isMarketplaceRegistered: true,
      isPluginInstalled: true,
      isPluginEnabled: true,
      installedVersion: "1.0.0",
    });

    vi.spyOn(pluginInstaller, "fullUninstall").mockImplementation(() => {});

    await runUninstall();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Plugin uninstalled successfully")
    );
  });

  it("should show steps completed after uninstallation", async () => {
    vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
      marketplaceDir: "/some/path",
      bundledVersion: "1.0.0",
      isMarketplaceRegistered: true,
      isPluginInstalled: true,
      isPluginEnabled: true,
      installedVersion: "1.0.0",
    });

    vi.spyOn(pluginInstaller, "fullUninstall").mockImplementation(() => {});

    await runUninstall();

    expect(consoleLogSpy).toHaveBeenCalledWith("Steps completed:");
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Disabled in settings.json"));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Removed from installed_plugins_v2.json"));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Deleted plugin cache"));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Removed from known_marketplaces.json"));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Deleted marketplace files"));
  });

  it("should show restart message after uninstallation", async () => {
    vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
      marketplaceDir: "/some/path",
      bundledVersion: "1.0.0",
      isMarketplaceRegistered: true,
      isPluginInstalled: true,
      isPluginEnabled: true,
      installedVersion: "1.0.0",
    });

    vi.spyOn(pluginInstaller, "fullUninstall").mockImplementation(() => {});

    await runUninstall();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Restart Claude Code")
    );
  });

  it("should only show relevant steps based on initial state", async () => {
    // Only marketplace registered, not installed or enabled
    vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
      marketplaceDir: "/some/path",
      bundledVersion: "1.0.0",
      isMarketplaceRegistered: true,
      isPluginInstalled: false,
      isPluginEnabled: false,
      installedVersion: null,
    });

    vi.spyOn(pluginInstaller, "fullUninstall").mockImplementation(() => {});

    await runUninstall();

    // Should show marketplace removal but not settings/plugin removal
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Removed from known_marketplaces.json"));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Deleted marketplace files"));

    // These should not be shown because isPluginEnabled and isPluginInstalled are false
    const calls = consoleLogSpy.mock.calls.map(c => c[0]);
    const hasDisabledSettings = calls.some(c => typeof c === 'string' && c.includes("Disabled in settings.json"));
    const hasRemovedPlugins = calls.some(c => typeof c === 'string' && c.includes("Removed from installed_plugins_v2.json"));

    expect(hasDisabledSettings).toBe(false);
    expect(hasRemovedPlugins).toBe(false);
  });

  it("should handle uninstallation error", async () => {
    vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
      marketplaceDir: "/some/path",
      bundledVersion: "1.0.0",
      isMarketplaceRegistered: true,
      isPluginInstalled: true,
      isPluginEnabled: true,
      installedVersion: "1.0.0",
    });

    vi.spyOn(pluginInstaller, "fullUninstall").mockImplementation(() => {
      throw new Error("Test error");
    });

    await runUninstall();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to uninstall plugin")
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("should uninstall when only marketplace is registered", async () => {
    vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
      marketplaceDir: "/some/path",
      bundledVersion: "1.0.0",
      isMarketplaceRegistered: true,
      isPluginInstalled: false,
      isPluginEnabled: false,
      installedVersion: null,
    });

    const fullUninstallSpy = vi.spyOn(pluginInstaller, "fullUninstall").mockImplementation(() => {});

    await runUninstall();

    expect(fullUninstallSpy).toHaveBeenCalled();
  });

  it("should uninstall when only plugin is installed", async () => {
    vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
      marketplaceDir: "/some/path",
      bundledVersion: "1.0.0",
      isMarketplaceRegistered: false,
      isPluginInstalled: true,
      isPluginEnabled: false,
      installedVersion: "1.0.0",
    });

    const fullUninstallSpy = vi.spyOn(pluginInstaller, "fullUninstall").mockImplementation(() => {});

    await runUninstall();

    expect(fullUninstallSpy).toHaveBeenCalled();
  });

  it("should uninstall when only plugin is enabled", async () => {
    vi.spyOn(pluginInstaller, "getPluginInstallInfo").mockReturnValue({
      marketplaceDir: "/some/path",
      bundledVersion: "1.0.0",
      isMarketplaceRegistered: false,
      isPluginInstalled: false,
      isPluginEnabled: true,
      installedVersion: null,
    });

    const fullUninstallSpy = vi.spyOn(pluginInstaller, "fullUninstall").mockImplementation(() => {});

    await runUninstall();

    expect(fullUninstallSpy).toHaveBeenCalled();
  });
});
