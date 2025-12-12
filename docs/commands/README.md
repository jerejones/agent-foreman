# Agent Foreman CLI Commands

Complete reference documentation for all agent-foreman CLI commands.

> agent-foreman CLI 所有命令的完整参考文档。

## Command Overview

```mermaid
flowchart TB
    subgraph Setup["Setup Commands"]
        init[init]
        install[install]
        uninstall[uninstall]
    end

    subgraph Workflow["Workflow Commands"]
        next[next]
        check[check]
        done[done]
    end

    subgraph Status["Status Commands"]
        status[status]
        impact[impact]
    end

    subgraph Discovery["Discovery Commands"]
        analyze[analyze]
        scan[scan]
        agents[agents]
    end

    init --> next
    next --> check
    check --> done
    done --> next

    style init fill:#4CAF50
    style next fill:#2196F3
    style check fill:#FF9800
    style done fill:#4CAF50
```

## Commands by Category

### Setup Commands

| Command | Description |
|---------|-------------|
| [init](./init.md) | Initialize or upgrade the long-task harness |
| [install](./install.md) | Install Claude Code plugin |
| [uninstall](./uninstall.md) | Remove Claude Code plugin |

### Core Workflow Commands

| Command | Description |
|---------|-------------|
| [next](./next.md) | Show next feature to work on with TDD guidance |
| [check](./check.md) | AI-powered verification of feature completion |
| [done](./done.md) | Mark feature as complete with auto-commit |

### Status & Analysis Commands

| Command | Description |
|---------|-------------|
| [status](./status.md) | Show current harness status |
| [impact](./impact.md) | Analyze impact of changes to a feature |

### Discovery Commands

| Command | Description |
|---------|-------------|
| [analyze](./analyze.md) | Generate AI-powered project analysis report |
| [scan](./scan.md) | Detect project verification capabilities |
| [agents](./agents.md) | Show available AI agents status |

## Standard Workflow

```mermaid
flowchart LR
    subgraph Phase1["Phase 1: Setup"]
        A1[agent-foreman init]
    end

    subgraph Phase2["Phase 2: Development Loop"]
        B1[agent-foreman next] --> B2[Implement Feature]
        B2 --> B3[agent-foreman check]
        B3 --> B4[agent-foreman done]
        B4 --> B1
    end

    subgraph Phase3["Phase 3: Monitoring"]
        C1[agent-foreman status]
        C2[agent-foreman impact]
    end

    A1 --> B1
    B4 --> C1
```

### Recommended Workflow Steps

1. **Initialize**: `agent-foreman init` - Set up the harness
2. **Get Task**: `agent-foreman next` - View next feature
3. **Implement**: Write code to satisfy acceptance criteria
4. **Verify**: `agent-foreman check <feature_id>` - Verify implementation
5. **Complete**: `agent-foreman done <feature_id>` - Mark as complete
6. **Repeat**: Go back to step 2

## TDD Workflow (Strict Mode)

```mermaid
flowchart LR
    subgraph RED["RED Phase"]
        R1[Create test file]
        R2[Write failing tests]
        R3[Verify tests fail]
    end

    subgraph GREEN["GREEN Phase"]
        G1[Write minimum code]
        G2[Make tests pass]
    end

    subgraph REFACTOR["REFACTOR Phase"]
        F1[Clean up code]
        F2[Tests still pass]
    end

    subgraph COMPLETE["COMPLETE Phase"]
        C1[agent-foreman check]
        C2[agent-foreman done]
    end

    R1 --> R2 --> R3 --> G1 --> G2 --> F1 --> F2 --> C1 --> C2
```

## Quick Reference

### Most Common Commands

```bash
# Initialize harness
agent-foreman init

# Get next feature
agent-foreman next

# Verify feature
agent-foreman check <feature_id>

# Complete feature
agent-foreman done <feature_id>

# View status
agent-foreman status
```

### Output Modes

Most commands support multiple output modes:

| Flag | Description |
|------|-------------|
| (default) | Human-readable formatted output |
| `--json` | Machine-readable JSON output |
| `--quiet` | Minimal output |

### Common Options

| Option | Description |
|--------|-------------|
| `-v, --verbose` | Show detailed output |
| `--help` | Show command help |

## Data Files

Commands interact with these files in the `ai/` directory:

| File | Purpose | Commands |
|------|---------|----------|
| `ai/feature_list.json` | Feature backlog | All workflow commands |
| `ai/progress.log` | Activity log | next, check, done, status |
| `ai/capabilities.json` | Tool detection cache | scan, check, done |
| `ai/init.sh` | Bootstrap script | init |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (missing feature list, feature not found, verification failed) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_FOREMAN_AGENTS` | `claude,codex,gemini` | AI agent priority order |

## See Also

- [USAGE.md](../USAGE.md) - Detailed usage guide
- [ARCHITECTURE.md](../ARCHITECTURE.md) - Project architecture
- [TECH.md](../TECH.md) - Technical details
