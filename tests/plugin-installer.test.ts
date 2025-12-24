/**
 * Tests for plugin-installer module
 *
 * Tests the new marketplace registry-based plugin installation system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import {
  isCompiledBinary,
  isMarketplaceRegistered,
  isPluginInstalled,
  isPluginEnabled,
  getPluginInstallInfo,
  fullInstall,
  fullUninstall,
  checkAndInstallPlugins,
} from "../src/plugin-installer.js";

describe("plugin-installer", () => {
  let originalHome: string | undefined;
  let tempHome: string;

  beforeEach(() => {
    // Create a temporary home directory for testing
    tempHome = fs.mkdtempSync(path.join(tmpdir(), "plugin-test-home-"));
    originalHome = process.env.HOME;
    process.env.HOME = tempHome;

    // Ensure .claude directory structure exists
    fs.mkdirSync(path.join(tempHome, ".claude", "plugins"), { recursive: true });
  });

  afterEach(() => {
    // Restore original HOME
    if (originalHome) {
      process.env.HOME = originalHome;
    }
    // Clean up temp directory
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  describe("isCompiledBinary", () => {
    it("should return false in development mode (no embedded plugins)", () => {
      // In development mode, EMBEDDED_PLUGINS is empty
      const result = isCompiledBinary();
      expect(typeof result).toBe("boolean");
      // In test environment, we expect false since no compiled bundle
      expect(result).toBe(false);
    });
  });

  describe("isMarketplaceRegistered", () => {
    it("should return false when known_marketplaces.json doesn't exist", () => {
      const result = isMarketplaceRegistered();
      expect(result).toBe(false);
    });

    it("should return false when marketplace is not in registry", () => {
      const knownMarketplacesPath = path.join(tempHome, ".claude", "plugins", "known_marketplaces.json");
      fs.writeFileSync(knownMarketplacesPath, JSON.stringify({}));

      const result = isMarketplaceRegistered();
      expect(result).toBe(false);
    });

    it("should return true when marketplace is registered", () => {
      const knownMarketplacesPath = path.join(tempHome, ".claude", "plugins", "known_marketplaces.json");
      fs.writeFileSync(knownMarketplacesPath, JSON.stringify({
        "agent-foreman-plugins": {
          source: { source: "directory", path: "/some/path" },
          installLocation: "/some/path",
          lastUpdated: new Date().toISOString()
        }
      }));

      const result = isMarketplaceRegistered();
      expect(result).toBe(true);
    });

    it("should handle invalid JSON gracefully", () => {
      const knownMarketplacesPath = path.join(tempHome, ".claude", "plugins", "known_marketplaces.json");
      fs.writeFileSync(knownMarketplacesPath, "invalid json");

      const result = isMarketplaceRegistered();
      expect(result).toBe(false);
    });
  });

  describe("isPluginInstalled", () => {
    it("should return false when installed_plugins_v2.json doesn't exist", () => {
      const result = isPluginInstalled();
      expect(result).toBe(false);
    });

    it("should return false when plugin is not in registry", () => {
      const installedPluginsPath = path.join(tempHome, ".claude", "plugins", "installed_plugins_v2.json");
      fs.writeFileSync(installedPluginsPath, JSON.stringify({ version: 2, plugins: {} }));

      const result = isPluginInstalled();
      expect(result).toBe(false);
    });

    it("should return true when plugin is installed", () => {
      const installedPluginsPath = path.join(tempHome, ".claude", "plugins", "installed_plugins_v2.json");
      fs.writeFileSync(installedPluginsPath, JSON.stringify({
        version: 2,
        plugins: {
          "agent-foreman@agent-foreman-plugins": [{
            scope: "user",
            installPath: "/some/path",
            version: "1.0.0",
            installedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            isLocal: true
          }]
        }
      }));

      const result = isPluginInstalled();
      expect(result).toBe(true);
    });

    it("should return false when plugins array is empty", () => {
      const installedPluginsPath = path.join(tempHome, ".claude", "plugins", "installed_plugins_v2.json");
      fs.writeFileSync(installedPluginsPath, JSON.stringify({
        version: 2,
        plugins: {
          "agent-foreman@agent-foreman-plugins": []
        }
      }));

      const result = isPluginInstalled();
      expect(result).toBe(false);
    });
  });

  describe("isPluginEnabled", () => {
    it("should return false when settings.json doesn't exist", () => {
      const result = isPluginEnabled();
      expect(result).toBe(false);
    });

    it("should return false when enabledPlugins is not set", () => {
      const settingsPath = path.join(tempHome, ".claude", "settings.json");
      fs.writeFileSync(settingsPath, JSON.stringify({}));

      const result = isPluginEnabled();
      expect(result).toBe(false);
    });

    it("should return false when plugin is not enabled", () => {
      const settingsPath = path.join(tempHome, ".claude", "settings.json");
      fs.writeFileSync(settingsPath, JSON.stringify({
        enabledPlugins: {
          "other-plugin@other-marketplace": true
        }
      }));

      const result = isPluginEnabled();
      expect(result).toBe(false);
    });

    it("should return true when plugin is enabled", () => {
      const settingsPath = path.join(tempHome, ".claude", "settings.json");
      fs.writeFileSync(settingsPath, JSON.stringify({
        enabledPlugins: {
          "agent-foreman@agent-foreman-plugins": true
        }
      }));

      const result = isPluginEnabled();
      expect(result).toBe(true);
    });

    it("should return false when plugin is explicitly disabled", () => {
      const settingsPath = path.join(tempHome, ".claude", "settings.json");
      fs.writeFileSync(settingsPath, JSON.stringify({
        enabledPlugins: {
          "agent-foreman@agent-foreman-plugins": false
        }
      }));

      const result = isPluginEnabled();
      expect(result).toBe(false);
    });
  });

  describe("getPluginInstallInfo", () => {
    it("should return correct info when nothing is installed", () => {
      const info = getPluginInstallInfo();

      expect(info.isMarketplaceRegistered).toBe(false);
      expect(info.isPluginInstalled).toBe(false);
      expect(info.isPluginEnabled).toBe(false);
      expect(info.installedVersion).toBeNull();
      expect(info.bundledVersion).toBeDefined();
      expect(info.marketplaceDir).toContain("agent-foreman-plugins");
    });

    it("should return correct version when plugin is installed", () => {
      const installedPluginsPath = path.join(tempHome, ".claude", "plugins", "installed_plugins_v2.json");
      fs.writeFileSync(installedPluginsPath, JSON.stringify({
        version: 2,
        plugins: {
          "agent-foreman@agent-foreman-plugins": [{
            scope: "user",
            installPath: "/some/path",
            version: "1.2.3",
            installedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            isLocal: true
          }]
        }
      }));

      const info = getPluginInstallInfo();
      expect(info.isPluginInstalled).toBe(true);
      expect(info.installedVersion).toBe("1.2.3");
    });

    it("should return combined status correctly", () => {
      // Set up all three: marketplace, plugin, and enabled
      const knownMarketplacesPath = path.join(tempHome, ".claude", "plugins", "known_marketplaces.json");
      fs.writeFileSync(knownMarketplacesPath, JSON.stringify({
        "agent-foreman-plugins": {
          source: { source: "directory", path: "/some/path" },
          installLocation: "/some/path",
          lastUpdated: new Date().toISOString()
        }
      }));

      const installedPluginsPath = path.join(tempHome, ".claude", "plugins", "installed_plugins_v2.json");
      fs.writeFileSync(installedPluginsPath, JSON.stringify({
        version: 2,
        plugins: {
          "agent-foreman@agent-foreman-plugins": [{
            scope: "user",
            installPath: "/some/path",
            version: "1.0.0",
            installedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            isLocal: true
          }]
        }
      }));

      const settingsPath = path.join(tempHome, ".claude", "settings.json");
      fs.writeFileSync(settingsPath, JSON.stringify({
        enabledPlugins: {
          "agent-foreman@agent-foreman-plugins": true
        }
      }));

      const info = getPluginInstallInfo();
      expect(info.isMarketplaceRegistered).toBe(true);
      expect(info.isPluginInstalled).toBe(true);
      expect(info.isPluginEnabled).toBe(true);
    });
  });

  describe("fullInstall", () => {
    it("should create marketplace directory structure", () => {
      // In development mode (no embedded plugins), fullInstall should still work
      // but won't have embedded files to write
      fullInstall();

      // Check that marketplace directory was created
      const marketplaceDir = path.join(tempHome, ".claude", "plugins", "marketplaces", "agent-foreman-plugins");
      expect(fs.existsSync(marketplaceDir)).toBe(true);

      // Check that marketplace.json was created
      const marketplaceJsonPath = path.join(marketplaceDir, ".claude-plugin", "marketplace.json");
      expect(fs.existsSync(marketplaceJsonPath)).toBe(true);
    });

    it("should register marketplace in known_marketplaces.json", () => {
      fullInstall();

      const knownMarketplacesPath = path.join(tempHome, ".claude", "plugins", "known_marketplaces.json");
      expect(fs.existsSync(knownMarketplacesPath)).toBe(true);

      const marketplaces = JSON.parse(fs.readFileSync(knownMarketplacesPath, "utf-8"));
      expect(marketplaces["agent-foreman-plugins"]).toBeDefined();
      expect(marketplaces["agent-foreman-plugins"].source.source).toBe("directory");
    });

    it("should register plugin in installed_plugins_v2.json", () => {
      fullInstall();

      const installedPluginsPath = path.join(tempHome, ".claude", "plugins", "installed_plugins_v2.json");
      expect(fs.existsSync(installedPluginsPath)).toBe(true);

      const registry = JSON.parse(fs.readFileSync(installedPluginsPath, "utf-8"));
      expect(registry.version).toBe(2);
      expect(registry.plugins["agent-foreman@agent-foreman-plugins"]).toBeDefined();
      expect(registry.plugins["agent-foreman@agent-foreman-plugins"].length).toBeGreaterThan(0);
    });

    it("should enable plugin in settings.json", () => {
      fullInstall();

      const settingsPath = path.join(tempHome, ".claude", "settings.json");
      expect(fs.existsSync(settingsPath)).toBe(true);

      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      expect(settings.enabledPlugins["agent-foreman@agent-foreman-plugins"]).toBe(true);
    });

    it("should preserve existing settings", () => {
      // Create existing settings
      const settingsPath = path.join(tempHome, ".claude", "settings.json");
      fs.writeFileSync(settingsPath, JSON.stringify({
        someOtherSetting: "value",
        enabledPlugins: {
          "other-plugin": true
        }
      }));

      fullInstall();

      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      expect(settings.someOtherSetting).toBe("value");
      expect(settings.enabledPlugins["other-plugin"]).toBe(true);
      expect(settings.enabledPlugins["agent-foreman@agent-foreman-plugins"]).toBe(true);
    });
  });

  describe("fullUninstall", () => {
    beforeEach(() => {
      // First install the plugin
      fullInstall();
    });

    it("should remove plugin from settings.json", () => {
      fullUninstall();

      const settingsPath = path.join(tempHome, ".claude", "settings.json");
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      expect(settings.enabledPlugins["agent-foreman@agent-foreman-plugins"]).toBeUndefined();
    });

    it("should remove plugin from installed_plugins_v2.json", () => {
      fullUninstall();

      const installedPluginsPath = path.join(tempHome, ".claude", "plugins", "installed_plugins_v2.json");
      const registry = JSON.parse(fs.readFileSync(installedPluginsPath, "utf-8"));
      expect(registry.plugins["agent-foreman@agent-foreman-plugins"]).toBeUndefined();
    });

    it("should remove marketplace from known_marketplaces.json", () => {
      fullUninstall();

      const knownMarketplacesPath = path.join(tempHome, ".claude", "plugins", "known_marketplaces.json");
      const marketplaces = JSON.parse(fs.readFileSync(knownMarketplacesPath, "utf-8"));
      expect(marketplaces["agent-foreman-plugins"]).toBeUndefined();
    });

    it("should remove marketplace directory", () => {
      fullUninstall();

      const marketplaceDir = path.join(tempHome, ".claude", "plugins", "marketplaces", "agent-foreman-plugins");
      expect(fs.existsSync(marketplaceDir)).toBe(false);
    });

    it("should remove cache directory", () => {
      fullUninstall();

      const cacheDir = path.join(tempHome, ".claude", "plugins", "cache", "agent-foreman-plugins");
      expect(fs.existsSync(cacheDir)).toBe(false);
    });

    it("should preserve other plugins settings", () => {
      // Add another plugin setting before uninstall
      const settingsPath = path.join(tempHome, ".claude", "settings.json");
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      settings.enabledPlugins["other-plugin"] = true;
      fs.writeFileSync(settingsPath, JSON.stringify(settings));

      fullUninstall();

      const updatedSettings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      expect(updatedSettings.enabledPlugins["other-plugin"]).toBe(true);
    });

    it("should handle uninstall when nothing is installed", () => {
      // Uninstall once
      fullUninstall();

      // Uninstall again - should not throw
      expect(() => fullUninstall()).not.toThrow();
    });
  });

  describe("checkAndInstallPlugins", () => {
    it("should skip if not in compiled mode", async () => {
      // In development mode, checkAndInstallPlugins should skip
      await checkAndInstallPlugins();

      // Since we're not in compiled mode, nothing should be installed automatically
      expect(isMarketplaceRegistered()).toBe(false);
    });

    it("should skip if marketplace is already registered", async () => {
      // First, manually register the marketplace
      const knownMarketplacesPath = path.join(tempHome, ".claude", "plugins", "known_marketplaces.json");
      fs.writeFileSync(knownMarketplacesPath, JSON.stringify({
        "agent-foreman-plugins": {
          source: { source: "directory", path: "/some/path" },
          installLocation: "/some/path",
          lastUpdated: new Date().toISOString()
        }
      }));

      // Spy on console to check if installation message is printed
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await checkAndInstallPlugins();

      // Should not print installation message since marketplace is already registered
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining("Registering"));

      consoleSpy.mockRestore();
    });
  });

  describe("install/uninstall cycle", () => {
    it("should properly cycle through install and uninstall", () => {
      // Initial state - nothing installed
      expect(getPluginInstallInfo().isMarketplaceRegistered).toBe(false);
      expect(getPluginInstallInfo().isPluginInstalled).toBe(false);
      expect(getPluginInstallInfo().isPluginEnabled).toBe(false);

      // Install
      fullInstall();
      expect(getPluginInstallInfo().isMarketplaceRegistered).toBe(true);
      expect(getPluginInstallInfo().isPluginInstalled).toBe(true);
      expect(getPluginInstallInfo().isPluginEnabled).toBe(true);

      // Uninstall
      fullUninstall();
      expect(getPluginInstallInfo().isMarketplaceRegistered).toBe(false);
      expect(getPluginInstallInfo().isPluginInstalled).toBe(false);
      expect(getPluginInstallInfo().isPluginEnabled).toBe(false);

      // Reinstall
      fullInstall();
      expect(getPluginInstallInfo().isMarketplaceRegistered).toBe(true);
      expect(getPluginInstallInfo().isPluginInstalled).toBe(true);
      expect(getPluginInstallInfo().isPluginEnabled).toBe(true);
    });
  });
});
