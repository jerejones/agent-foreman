# agent-foreman

> Long Task Harness for AI agents - feature-driven development with external memory

[![npm version](https://img.shields.io/npm/v/agent-foreman.svg)](https://www.npmjs.com/package/agent-foreman)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Chinese](./README_zh.md) | [Detailed Usage Guide](./docs/USAGE.md)

## Problem

AI coding agents face three common failure modes:

1. **Doing too much at once** - Trying to complete everything in one session
2. **Premature completion** - Declaring victory before features actually work
3. **Superficial testing** - Not thoroughly validating implementations

## Solution

**agent-foreman** provides a structured harness that enables AI agents to:

- Maintain **external memory** via structured files
- Work on **one feature at a time** with clear acceptance criteria
- **Hand off cleanly** between sessions via progress logs
- **Track impact** of changes on other features

---

## Installation

```bash
# Quick install (binary)
curl -fsSL https://raw.githubusercontent.com/mylukin/agent-foreman/main/scripts/install.sh | bash

# Via npm
npm install -g agent-foreman

# Or use npx directly
npx agent-foreman --help
```

Manual download: [GitHub Releases](https://github.com/mylukin/agent-foreman/releases)

---

## Claude Code Plugin (Recommended)

agent-foreman is designed as a **Claude Code plugin**. This is the recommended way to use it.

### 1. Install Plugin

```
/plugin marketplace add mylukin/agent-foreman
/plugin install agent-foreman
```

### 2. Slash Commands

| Command | Description |
|---------|-------------|
| `/agent-foreman:status` | View project status and progress |
| `/agent-foreman:init` | Initialize harness with project goal |
| `/agent-foreman:analyze` | Analyze existing project structure |
| `/agent-foreman:spec` | Transform requirements into task files via Multi-Expert Council |
| `/agent-foreman:next` | Get next priority feature to work on |
| `/agent-foreman:run` | Auto-complete all pending features |

### 3. Usage Examples

**Initialize a new project:**
```
/agent-foreman:init Build a REST API for user management
```

**Check status and work on features:**
```
/agent-foreman:status
/agent-foreman:next
```

**Auto-complete all tasks:**
```
/agent-foreman:run
```

**Work on specific feature:**
```
/agent-foreman:run auth.login
```

### 4. Command Options

Commands accept natural language and flags:

```
/agent-foreman:init --mode new        # Fresh start, replace existing
/agent-foreman:init --mode scan       # Preview only, don't save
/agent-foreman:analyze --verbose      # Detailed output
```

---

## CLI Commands

For standalone CLI usage (without Claude Code):

| Command | Description |
|---------|-------------|
| `init [goal]` | Initialize or upgrade the harness |
| `init --analyze` | Generate ARCHITECTURE.md only |
| `init --scan` | Detect verification capabilities only |
| `next [feature_id]` | Show next feature to work on |
| `status` | Show current project status |
| `check [feature_id]` | Verify code changes or task completion |
| `done <feature_id>` | Verify, mark complete, and auto-commit |
| `fail <feature_id>` | Mark a task as failed |
| `impact <feature_id>` | Analyze impact of changes |
| `tdd [mode]` | View or set TDD mode (strict/recommended/disabled) |
| `agents` | Show available AI agents |
| `install` | Install Claude Code plugin |
| `uninstall` | Uninstall Claude Code plugin |

See [Detailed Usage Guide](./docs/USAGE.md) for complete options.

---

## Why It Works

The core insight: **AI agents need the same tooling that makes human engineering teams effective**.

Human engineers don't rely on memory either. We use:
- Git for version history
- Issue trackers for task management
- Documentation for handoffs
- Tests for verification

agent-foreman brings these same patterns to AI:

| Human Practice | AI Equivalent |
|----------------|---------------|
| Scrum board | `ai/tasks/index.json` |
| Sprint notes | `progress.log` |
| CI/CD pipeline | `init.sh check` |
| Code review | Acceptance criteria |

### Structured Storage Format

Each task is stored as a Markdown file with YAML frontmatter:

```yaml
---
id: auth.login
status: failing
priority: 1
---
# User can login

## Acceptance Criteria
1. Valid credentials return JWT token
2. Invalid credentials return 401 error
```

This format provides:
- **Human readability** — Easy to review and edit
- **Structured metadata** — YAML frontmatter for status tracking
- **Schema validation** — Prevents invalid states
- **Git-friendly** — Clean diffs for code review

---

## Workflow

agent-foreman embraces **TDD (Test-Driven Development)** philosophy: define acceptance criteria first, implement features second, verify at the end.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                        AGENT-FOREMAN WORKFLOW                            │
│                      (Based on TDD Principles)                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  INITIALIZE                                                              │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐                            │
│  │ analyze │───▶│   scan   │───▶│   init   │                            │
│  │         │    │          │    │ generate │                            │
│  └─────────┘    └──────────┘    └──────────┘                            │
│                                       │                                  │
│                                       ▼                                  │
│                             Define acceptance criteria (RED)             │
│                             ai/tasks/index.json                          │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  TDD DEVELOPMENT LOOP                                                    │
│                                                                          │
│      ┌──────────────────────────────────────────────────────┐           │
│      │                         LOOP                         │           │
│      ▼                                                      │           │
│  ┌──────────┐    ┌──────────────────────────────────────┐  │           │
│  │  next    │───▶│  RED: View acceptance criteria        │  │           │
│  │ get task │    │  Criteria = failing test cases        │  │           │
│  └──────────┘    └──────────────────────────────────────┘  │           │
│                                   │                         │           │
│                                   ▼                         │           │
│                  ┌──────────────────────────────────────┐  │           │
│                  │  GREEN: Implement feature             │  │           │
│                  │  Write minimum code to pass criteria  │  │           │
│                  └──────────────────────────────────────┘  │           │
│                                   │                         │           │
│                                   ▼                         │           │
│                  ┌──────────────────────────────────────┐  │           │
│                  │  check <id>                           │  │           │
│                  │  - Run tests to verify implementation │  │           │
│                  │  - AI validates acceptance criteria   │  │           │
│                  └──────────────────────────────────────┘  │           │
│                                   │                         │           │
│                                   ▼                         │           │
│                  ┌──────────────────────────────────────┐  │           │
│                  │  done <id>                            │  │           │
│                  │  - Mark feature complete              │  │           │
│                  │  - Auto-commit (REFACTOR optional)    │  │           │
│                  └──────────────────────────────────────┘  │           │
│                                   │                         │           │
│                                   ▼                         │           │
│                          ┌───────────────┐                 │           │
│                          │ More tasks?   │─────YES─────────┘           │
│                          └───────────────┘                              │
│                                   │ NO                                  │
│                                   ▼                                     │
│                  ┌───────────────────────────────────────┐             │
│                  │  All features passing! (100%)         │             │
│                  │  ARCHITECTURE.md updated              │             │
│                  └───────────────────────────────────────┘             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**TDD Core Principles:**
- **RED** — Define acceptance criteria first (equivalent to failing tests)
- **GREEN** — Write minimum code to make criteria pass
- **REFACTOR** — Optimize under test protection

---

## Core Files

| File | Purpose |
|------|---------|
| `ai/tasks/index.json` | Task index with status summary |
| `ai/tasks/{module}/{id}.md` | Individual task definitions (Markdown + YAML frontmatter) |
| `ai/progress.log` | Session handoff audit log |
| `ai/init.sh` | Environment bootstrap script |
| `ai/capabilities.json` | Cached project capabilities |
| `CLAUDE.md` | AI agent instructions |
| `docs/ARCHITECTURE.md` | AI-generated project architecture |

## Feature Status Values

| Status | Meaning |
|--------|---------|
| `failing` | Not yet implemented |
| `passing` | Acceptance criteria met |
| `blocked` | External dependency blocking |
| `needs_review` | May be affected by changes |
| `failed` | Implementation attempted but verification failed |
| `deprecated` | No longer needed |

---

## Best Practices

1. **One feature at a time** - Complete before switching
2. **Update status promptly** - Mark passing when criteria met
3. **Review impact** - Run impact analysis after changes
4. **Clean commits** - One feature = one atomic commit
5. **Read first** - Always check feature list and progress log

---

## License

MIT

## Author

Lukin ([@mylukin](https://github.com/mylukin))

---

Inspired by Anthropic's blog post: [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
