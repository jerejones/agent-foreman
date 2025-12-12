# uninstall Command

Remove the agent-foreman Claude Code plugin.

> 移除 agent-foreman Claude Code 插件。

## Synopsis

```bash
agent-foreman uninstall
```

## Description

The `uninstall` command completely removes the agent-foreman plugin from Claude Code. It disables the plugin, removes registrations, and deletes cached files.

> `uninstall` 命令从 Claude Code 完全移除 agent-foreman 插件。它禁用插件、删除注册信息并删除缓存文件。

## Options

This command has no options.

## Execution Flow

```mermaid
flowchart TD
    Start([Start]) --> GetInfo[getPluginInstallInfo]

    subgraph Status["Check Current Status"]
        GetInfo --> ShowStatus[Display Current Status]
        ShowStatus --> CheckInstalled{Anything<br/>Installed?}
    end

    CheckInstalled -->|No| NotInstalled[Show Not Installed]
    NotInstalled --> End([End])

    CheckInstalled -->|Yes| Uninstall

    subgraph Uninstall["Uninstallation Process"]
        Uninstall[fullUninstall] --> CheckEnabled{Plugin Enabled?}
        CheckEnabled -->|Yes| Step1[Disable in settings.json]
        CheckEnabled -->|No| CheckPlugin

        Step1 --> CheckPlugin{Plugin Installed?}
        CheckPlugin -->|Yes| Step2[Remove from installed_plugins_v2.json]
        CheckPlugin -->|No| CheckMarketplace

        Step2 --> Step3[Delete Plugin Cache]
        Step3 --> CheckMarketplace{Marketplace<br/>Registered?}

        CheckMarketplace -->|Yes| Step4[Remove from known_marketplaces.json]
        CheckMarketplace -->|No| Success

        Step4 --> Step5[Delete Marketplace Files]
        Step5 --> Success
    end

    Success[Show Success] --> Restart[Prompt: Restart Claude Code]
    Restart --> End

    style NotInstalled fill:#999999
    style Success fill:#00cc00
```

## Uninstallation Steps Detail

```mermaid
flowchart TD
    subgraph Step1["Step 1: Disable Plugin"]
        S1A[Read settings.json] --> S1B[Remove from enabledPlugins]
        S1B --> S1C[Write settings.json]
    end

    subgraph Step2["Step 2: Unregister Plugin"]
        S2A[Read installed_plugins_v2.json] --> S2B[Remove plugin entry]
        S2B --> S2C[Write installed_plugins_v2.json]
    end

    subgraph Step3["Step 3: Delete Plugin Cache"]
        S3A[Find cache directory] --> S3B[Delete plugin files]
    end

    subgraph Step4["Step 4: Unregister Marketplace"]
        S4A[Read known_marketplaces.json] --> S4B[Remove marketplace entry]
        S4B --> S4C[Write known_marketplaces.json]
    end

    subgraph Step5["Step 5: Delete Marketplace Files"]
        S5A[Find marketplace directory] --> S5B[Delete marketplace files]
    end

    Step1 --> Step2
    Step2 --> Step3
    Step3 --> Step4
    Step4 --> Step5
```

## State Cleanup

```mermaid
flowchart LR
    subgraph Before["Before Uninstall"]
        B1[settings.json<br/>enabledPlugins: agent-foreman]
        B2[installed_plugins_v2.json<br/>plugin entry]
        B3[known_marketplaces.json<br/>marketplace entry]
        B4[cache/plugins/agent-foreman/]
        B5[marketplaces/agent-foreman/]
    end

    subgraph After["After Uninstall"]
        A1[settings.json<br/>enabledPlugins: removed]
        A2[installed_plugins_v2.json<br/>entry removed]
        A3[known_marketplaces.json<br/>entry removed]
        A4[cache/plugins/agent-foreman/<br/>deleted]
        A5[marketplaces/agent-foreman/<br/>deleted]
    end

    B1 -->|Clean| A1
    B2 -->|Clean| A2
    B3 -->|Clean| A3
    B4 -->|Clean| A4
    B5 -->|Clean| A5
```

## Data Flow Diagram

```mermaid
flowchart LR
    subgraph Input
        ClaudeConfig[Claude Code Config Dir]
    end

    subgraph Processing
        StatusCheck[Status Checker]
        Uninstaller[Plugin Uninstaller]
    end

    subgraph Output
        Settings[settings.json - plugin disabled]
        Plugins[installed_plugins_v2.json - entry removed]
        Marketplaces[known_marketplaces.json - entry removed]
        Deleted[Cached files deleted]
    end

    ClaudeConfig --> StatusCheck
    StatusCheck --> Uninstaller

    Uninstaller --> Settings
    Uninstaller --> Plugins
    Uninstaller --> Marketplaces
    Uninstaller --> Deleted
```

## Dependencies

### Internal Modules

- `src/plugin-installer.ts` - Plugin uninstall logic
  - `fullUninstall()` - Complete uninstallation
  - `getPluginInstallInfo()` - Get installation status

### External Dependencies

- Claude Code installation (for config access)

## Files Read

| File | Purpose |
|------|---------|
| `~/.claude-code/known_marketplaces.json` | Check marketplace registration |
| `~/.claude-code/installed_plugins_v2.json` | Check plugin installation |
| `~/.claude-code/settings.json` | Check if enabled |

## Files Modified/Deleted

| File | Action |
|------|--------|
| `~/.claude-code/settings.json` | Remove from enabledPlugins |
| `~/.claude-code/installed_plugins_v2.json` | Remove plugin entry |
| `~/.claude-code/known_marketplaces.json` | Remove marketplace entry |
| `~/.claude-code/cache/plugins/agent-foreman/` | Delete directory |
| `~/.claude-code/marketplaces/agent-foreman/` | Delete directory |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (or nothing to uninstall) |
| 1 | Uninstallation failed |

## Examples

### Basic Uninstall

```bash
# Remove the plugin
agent-foreman uninstall
```

## Console Output Example

### Successful Uninstall

```
Agent Foreman Plugin Uninstaller
────────────────────────────────────────

Current Status:
  Marketplace: ✓ registered
  Plugin:      ✓ installed (0.1.100)
  Enabled:     ✓ yes

Uninstalling plugin...

✓ Plugin uninstalled successfully!

Steps completed:
  • Disabled in settings.json
  • Removed from installed_plugins_v2.json
  • Deleted plugin cache
  • Removed from known_marketplaces.json
  • Deleted marketplace files

⚡ Restart Claude Code to complete removal
```

### Nothing to Uninstall

```
Agent Foreman Plugin Uninstaller
────────────────────────────────────────

Current Status:
  Marketplace: not registered
  Plugin:      not installed
  Enabled:     no

Nothing to uninstall - plugin is not installed.

To install the plugin:
  agent-foreman install
```

### Partial Uninstall

```
Agent Foreman Plugin Uninstaller
────────────────────────────────────────

Current Status:
  Marketplace: ✓ registered
  Plugin:      not installed
  Enabled:     no

Uninstalling plugin...

✓ Plugin uninstalled successfully!

Steps completed:
  • Removed from known_marketplaces.json
  • Deleted marketplace files

⚡ Restart Claude Code to complete removal
```

## Post-Uninstall State

After uninstallation:

1. **Claude Code** will no longer show agent-foreman commands
2. **Slash commands** (`/agent-foreman:*`) will be unavailable
3. **Skills** will be removed from skill list
4. **Plugin files** are deleted from disk

Note: Uninstalling the plugin does NOT affect:
- Project files (`ai/feature_list.json`, etc.)
- The `agent-foreman` CLI itself
- Any work done using the harness

## Reinstallation

To reinstall after uninstalling:

```bash
# Restart Claude Code first
# Then reinstall
agent-foreman install
```

## Related Commands

- `agent-foreman install` - Install the plugin
