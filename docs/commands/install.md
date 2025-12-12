# install Command

Install the agent-foreman Claude Code plugin.

> 安装 agent-foreman Claude Code 插件。

## Synopsis

```bash
agent-foreman install [options]
```

## Description

The `install` command installs and enables the agent-foreman plugin for Claude Code. This plugin provides slash commands and skills that integrate agent-foreman workflows directly into Claude Code.

> `install` 命令安装并启用 Claude Code 的 agent-foreman 插件。此插件提供斜杠命令和技能，将 agent-foreman 工作流直接集成到 Claude Code 中。

## Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--force` | `-f` | `false` | Force reinstall even if already installed |

## Execution Flow

```mermaid
flowchart TD
    Start([Start]) --> GetInfo[getPluginInstallInfo]

    subgraph Status["Check Current Status"]
        GetInfo --> ShowStatus[Display Current Status]
        ShowStatus --> CheckEmbedded{Embedded Plugins<br/>Available?}
    end

    CheckEmbedded -->|No| DevMode[Show Dev Mode Instructions]
    DevMode --> End([End])

    CheckEmbedded -->|Yes| CheckInstalled{Already Installed<br/>& Enabled?}

    CheckInstalled -->|Yes, not forced| AlreadyInstalled[Show Already Installed]
    AlreadyInstalled --> End

    CheckInstalled -->|No or forced| Install

    subgraph Install["Installation Process"]
        Install[fullInstall] --> Step1[Install Marketplace Files]
        Step1 --> Step2[Register in known_marketplaces.json]
        Step2 --> Step3[Install Plugin to Cache]
        Step3 --> Step4[Enable in settings.json]
    end

    Step4 --> Success[Show Success]
    Success --> Restart[Prompt: Restart Claude Code]
    Restart --> End

    style DevMode fill:#ffcc00
    style AlreadyInstalled fill:#00cc00
    style Success fill:#00cc00
```

## Installation Steps Detail

```mermaid
flowchart TD
    subgraph Step1["Step 1: Install Marketplace Files"]
        S1A[Copy marketplace.json] --> S1B[Copy plugin.json]
        S1B --> S1C[Copy slash commands]
        S1C --> S1D[Copy skills]
    end

    subgraph Step2["Step 2: Register Marketplace"]
        S2A[Read known_marketplaces.json] --> S2B[Add agent-foreman entry]
        S2B --> S2C[Write known_marketplaces.json]
    end

    subgraph Step3["Step 3: Install Plugin"]
        S3A[Read installed_plugins_v2.json] --> S3B[Add plugin entry]
        S3B --> S3C[Copy plugin files to cache]
        S3C --> S3D[Write installed_plugins_v2.json]
    end

    subgraph Step4["Step 4: Enable Plugin"]
        S4A[Read settings.json] --> S4B[Add to enabledPlugins]
        S4B --> S4C[Write settings.json]
    end

    Step1 --> Step2
    Step2 --> Step3
    Step3 --> Step4
```

## Claude Code Plugin Architecture

```mermaid
flowchart LR
    subgraph ClaudeCode["Claude Code"]
        Settings[settings.json]
        KnownMP[known_marketplaces.json]
        Installed[installed_plugins_v2.json]
        Cache[Plugin Cache]
    end

    subgraph Plugin["agent-foreman Plugin"]
        Marketplace[marketplace.json]
        PluginJSON[plugin.json]
        Slashes[Slash Commands]
        Skills[Skills]
    end

    Marketplace --> KnownMP
    PluginJSON --> Installed
    PluginJSON --> Cache
    Slashes --> Cache
    Skills --> Cache
    Installed --> Settings
```

## Plugin Components

### Slash Commands

| Command | Description |
|---------|-------------|
| `/agent-foreman:init` | Initialize harness |
| `/agent-foreman:next` | Get next feature |
| `/agent-foreman:status` | View project status |
| `/agent-foreman:analyze` | Analyze project |
| `/agent-foreman:run` | Run tasks |

### Skills

| Skill | Description |
|-------|-------------|
| `init-harness` | Initialize long-task harness |
| `feature-next` | Work on next priority task |
| `feature-run` | Run tasks automatically |
| `project-analyze` | Analyze project structure |

## Data Flow Diagram

```mermaid
flowchart LR
    subgraph Input
        Embedded[Embedded Plugin Files]
        ClaudeConfig[Claude Code Config Dir]
    end

    subgraph Processing
        Installer[Plugin Installer]
        Validator[Status Validator]
    end

    subgraph Output
        Marketplace[Marketplace Registration]
        PluginCache[Plugin Cache Files]
        Settings[Enabled in Settings]
    end

    Embedded --> Installer
    ClaudeConfig --> Validator
    Validator --> Installer

    Installer --> Marketplace
    Installer --> PluginCache
    Installer --> Settings
```

## Dependencies

### Internal Modules

- `src/plugin-installer.ts` - Plugin installation logic
  - `fullInstall()` - Complete installation
  - `hasEmbeddedPlugins()` - Check for embedded plugins
  - `getPluginInstallInfo()` - Get installation status

### External Dependencies

- Claude Code installation (for plugin support)

## Files Read

| File | Purpose |
|------|---------|
| `~/.claude-code/known_marketplaces.json` | Existing marketplaces |
| `~/.claude-code/installed_plugins_v2.json` | Existing plugins |
| `~/.claude-code/settings.json` | Current settings |

## Files Written

| File | Purpose |
|------|---------|
| `~/.claude-code/known_marketplaces.json` | Register marketplace |
| `~/.claude-code/installed_plugins_v2.json` | Register plugin |
| `~/.claude-code/settings.json` | Enable plugin |
| `~/.claude-code/cache/plugins/...` | Plugin files |
| `~/.claude-code/marketplaces/...` | Marketplace files |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (or already installed) |
| 1 | Installation failed |

## Examples

### Basic Installation

```bash
# Install the plugin
agent-foreman install
```

### Force Reinstall

```bash
# Reinstall even if already installed
agent-foreman install --force
```

## Console Output Example

### New Installation

```
Agent Foreman Plugin Installer
────────────────────────────────────────

Plugin Status:
  Version:     0.1.100
  Marketplace: not registered
  Plugin:      not installed
  Enabled:     no

Installing plugin...

✓ Plugin installed successfully!

Steps completed:
  1. Installed marketplace files
  2. Registered in known_marketplaces.json
  3. Installed plugin to cache
  4. Enabled in settings.json

⚡ Restart Claude Code to use the plugin
```

### Already Installed

```
Agent Foreman Plugin Installer
────────────────────────────────────────

Plugin Status:
  Version:     0.1.100
  Marketplace: ✓ registered
  Plugin:      ✓ installed (0.1.100)
  Enabled:     ✓ yes

✓ Plugin is already installed and enabled
  Use --force to reinstall

To manage the plugin:
  /plugin                    # Browse plugins
  agent-foreman uninstall    # Remove plugin
```

### Development Mode

```
Agent Foreman Plugin Installer
────────────────────────────────────────

Plugin Status:
  Version:     0.1.100
  Marketplace: not registered
  Plugin:      not installed
  Enabled:     no

⚠ Running in development mode (no embedded plugins)
  Plugins are loaded directly from source in development.

To build with embedded plugins:
  npm run build        # Build npm package
  npm run build:bin    # Build standalone binary

Or install from GitHub:
  /plugin marketplace add mylukin/agent-foreman
  /plugin install agent-foreman
```

## Plugin File Structure

```
~/.claude-code/
├── known_marketplaces.json      # Marketplace registry
├── installed_plugins_v2.json    # Plugin registry
├── settings.json                # Plugin enabled here
├── cache/
│   └── plugins/
│       └── agent-foreman/
│           ├── plugin.json
│           ├── commands/
│           │   ├── init.md
│           │   ├── next.md
│           │   └── ...
│           └── skills/
│               ├── init-harness.md
│               └── ...
└── marketplaces/
    └── agent-foreman/
        ├── marketplace.json
        └── plugins/
            └── agent-foreman/
                └── plugin.json
```

## Related Commands

- `agent-foreman uninstall` - Remove the plugin
- `/plugin` - Claude Code plugin browser
