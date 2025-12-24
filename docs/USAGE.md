# Agent Foreman Usage Guide

This guide provides detailed usage instructions for agent-foreman.

> 本指南提供 agent-foreman 的详细使用说明。

---

## Claude Code Plugin (Recommended)

agent-foreman is designed as a Claude Code plugin. This is the recommended way to use it.

> agent-foreman 设计为 Claude Code 插件，这是推荐的使用方式。

### Installation

```bash
# Install plugin (auto-registers with Claude Code)
agent-foreman install

# Restart Claude Code to activate
```

> 通过 `agent-foreman install` 命令自动安装插件，然后重启 Claude Code 即可。

### Slash Commands Reference

| Command | Description |
|---------|-------------|
| `/agent-foreman:status` | View project status and progress |
| `/agent-foreman:init` | Initialize harness with project goal |
| `/agent-foreman:analyze` | Analyze existing project structure |
| `/agent-foreman:next` | Get next priority task to work on |
| `/agent-foreman:run` | Auto-complete all pending tasks |

---

### `/agent-foreman:init`

Initialize or upgrade the long-task harness.

> 初始化或升级长任务框架。

**Usage:**
```
/agent-foreman:init <goal>
/agent-foreman:init <goal> --mode new
/agent-foreman:init <goal> --mode scan
/agent-foreman:init <goal> --task-type ops
```

**Parameters:**
- `<goal>` - Project goal in natural language (supports English and Chinese)
- `--mode` / `-m` - Init mode (default: merge)
  - `merge` - Merge new features with existing list
  - `new` - Replace existing task list entirely
  - `scan` - Preview only, don't save
- `--task-type` / `-t` - Default verification type for tasks:
  - `code` - Software development tasks (unit tests, build)
  - `ops` - Operational tasks (manual checklist verification)
  - `data` - Data processing tasks (output validation)
  - `infra` - Infrastructure tasks (resource state checks)
  - `manual` - Manual verification only (no automation)
- `--verbose` / `-v` - Show detailed output

**Examples:**
```
/agent-foreman:init Build a REST API for user management
/agent-foreman:init 搭建一个电商后端 API
/agent-foreman:init Add authentication --mode new
```

**Auto-detection behavior:**
| Condition | Action |
|-----------|--------|
| `ARCHITECTURE.md` exists | Uses it to generate features (fast) |
| Has source code, no arch doc | Scans codebase + auto-generates ARCHITECTURE.md |
| Empty project | Generates features from goal |

---

### `/agent-foreman:next`

Get the next priority task to work on.

> 获取下一个优先任务。

**Usage:**
```
/agent-foreman:next
/agent-foreman:next <task_id>
/agent-foreman:next --json
```

**Parameters:**
- `<task_id>` - (optional) Work on specific task
- `--dry-run` / `-d` - Preview only, don't make changes
- `--check` / `-c` - Run basic tests before showing next task
- `--allow-dirty` - Allow running with uncommitted changes
- `--json` - Output as JSON for scripting
- `--quiet` / `-q` - Suppress decorative output
- `--refresh-guidance` - Force regenerate TDD guidance (ignore cache)

**Priority Order:**
1. `needs_review` status (highest priority)
2. `failing` status
3. Lower priority number

**Examples:**
```
/agent-foreman:next
/agent-foreman:next auth.login
```

---

### `/agent-foreman:status`

View project status and progress.

> 查看项目状态和进度。

**Usage:**
```
/agent-foreman:status
/agent-foreman:status --json
/agent-foreman:status --quiet
```

**Output includes:**
- Project goal
- Task counts by status
- Completion percentage with progress bar
- Recent activity from progress log

---

### `/agent-foreman:analyze`

Analyze existing project structure and generate documentation.

> 分析现有项目结构并生成文档。

**Usage:**
```
/agent-foreman:analyze
/agent-foreman:analyze <output_path>
/agent-foreman:analyze --verbose
```

**Output:** `docs/ARCHITECTURE.md` containing:
- Tech stack detected
- Directory structure
- Modules discovered
- Completion assessment

---

### `/agent-foreman:run`

Work on features - either all pending features or a specific one.

> 处理任务 - 可以处理所有待办任务或指定任务。

**Usage:**
```
/agent-foreman:run                  # Auto-complete all tasks
/agent-foreman:run auth.login       # Work on specific task
```

**Parameters:**
- No argument: Auto-complete all pending tasks in priority order
- `<task_id>`: Work on the specified task only

**Examples:**
```
/agent-foreman:run                  # Complete all pending tasks
/agent-foreman:run api.users.create # Work on specific task
```

**Execution loop (when no task_id):**
1. Check status
2. Get next task (auto-selected by priority)
3. Implement task (satisfy ALL acceptance criteria)
4. Check implementation with verification
5. Complete task
6. Repeat until all done

**Exit conditions:**
- All tasks `passing`/`deprecated` → Success
- Verification fails → Mark as failed and continue
- User interrupts → Stop with clean state

---

## Task Verification

Before marking a task complete, verify it with AI-powered analysis:

> 在将任务标记为完成之前，使用 AI 驱动的分析进行验证。

```bash
agent-foreman check [task_id]
```

**Modes:**
| Mode | Command | Description |
|------|---------|-------------|
| Fast (default) | `check` | Git diff → selective tests + task impact (10-30s) |
| AI | `check --ai` | Fast + AI task verification (2-5 min) |
| Full | `check --full` | All tests + build + E2E (5-10 min) |
| Task | `check <task_id>` | Task-scoped full verification |

**Options:**
| Flag | Description |
|------|-------------|
| `--verbose` / `-v` | Show detailed AI reasoning |
| `--skip-checks` / `-s` | Skip automated checks, AI only |
| `--ai` | Enable AI verification (autonomous exploration for tasks, affected tasks for fast mode) |
| `--quick` | Run only related tests (default for task mode) |
| `--full` | Full verification (all tests + build + E2E) |
| `--test-pattern <pattern>` | Explicit test pattern to use |
| `--skip-e2e` | Skip E2E tests entirely |

**Examples:**
```bash
# Fast check (default) - git diff based selective tests
agent-foreman check

# Fast check with AI task verification
agent-foreman check --ai

# Full verification - runs all tests + build + E2E
agent-foreman check --full

# Task-specific verification
agent-foreman check auth.login

# Skip E2E tests for faster feedback
agent-foreman check auth.login --skip-e2e

# Verbose output with detailed AI reasoning
agent-foreman check auth.login --verbose
```

---

## Task Completion

After implementing a task, mark it complete using the CLI:

```bash
agent-foreman done <task_id>
```

**Options:**
| Flag | Description |
|------|-------------|
| `--notes` / `-n` | Additional notes to attach to the task |
| `--quick` | Run only related tests (default) |
| `--full` | Run complete test suite |
| `--test-pattern <pattern>` | Use explicit test pattern |
| `--skip-e2e` | Skip E2E tests |
| `--no-skip-check` | Run verification before marking done (default: skipped) |
| `--no-commit` | Skip auto-commit |
| `--verbose` / `-v` | Show detailed verification output |
| `--ai` | Enable AI autonomous exploration for verification |
| `--loop` | Loop mode for batch workflow (default: true, use `--no-loop` to disable) |

**Examples:**
```bash
# Quick mode (default) - runs only related tests
agent-foreman done auth.login

# Full mode - runs all tests
agent-foreman done auth.login --full

# Explicit pattern
agent-foreman done auth.login --test-pattern "tests/auth/*.test.ts"
```

---

## CLI Reference

For users not using Claude Code, agent-foreman is available as a standalone CLI.

### Installation

Download the latest binary for your platform from [Releases](https://foreman.lukin.net/):

```bash
# macOS (Apple Silicon)
curl -fsSL https://foreman.lukin.net/latest/agent-foreman-darwin-arm64 -o agent-foreman
chmod +x agent-foreman
sudo mv agent-foreman /usr/local/bin/
sudo xattr -dr com.apple.quarantine /usr/local/bin/agent-foreman

# macOS (Intel)
curl -fsSL https://foreman.lukin.net/latest/agent-foreman-darwin-x64 -o agent-foreman
chmod +x agent-foreman
sudo mv agent-foreman /usr/local/bin/
sudo xattr -dr com.apple.quarantine /usr/local/bin/agent-foreman

# Linux (x64)
curl -fsSL https://foreman.lukin.net/latest/agent-foreman-linux-x64 -o agent-foreman
chmod +x agent-foreman
sudo mv agent-foreman /usr/local/bin/
```

### Commands

| Command | Description |
|---------|-------------|
| `analyze [output]` | Generate project architecture report |
| `init [goal]` | Initialize or upgrade the harness |
| `next [task_id]` | Show next task to work on |
| `status` | Show current project status |
| `check [task_id]` | Verify code changes or task completion |
| `done <task_id>` | Mark complete and auto-commit |
| `fail <task_id>` | Mark task as failed |
| `tdd [mode]` | View or change TDD mode (strict/recommended/disabled) |
| `impact <task_id>` | Analyze impact of changes |
| `validate [module]` | Validate spec workflow task quality |
| `agents` | Show available AI agents |
| `scan` | Scan project verification capabilities |
| `upgrade` | Check for updates and upgrade to latest version |
| `install` | Install agent-foreman Claude Code plugin |
| `uninstall` | Uninstall agent-foreman Claude Code plugin |
| `license` | Show license status |
| `activate <key>` | Activate a license key on this device |
| `deactivate` | Deactivate the license on this device |

### CLI Examples

**New project:**
```bash
mkdir my-project && cd my-project
git init
agent-foreman init "Build a REST API for user management"
```

**Existing project:**
```bash
cd existing-project
agent-foreman analyze
agent-foreman init "Add authentication feature"
```

**Development loop:**
```bash
agent-foreman next           # Get next task
# ... implement task ...
agent-foreman check cli.init # Verify implementation
agent-foreman done cli.init  # Mark complete + commit
agent-foreman next           # Continue
```

---

## Workflow Diagrams

### New Project Flow

```text
┌─────────────────────────────────────────────────────────────┐
│                    NEW PROJECT                               │
├─────────────────────────────────────────────────────────────┤
│  mkdir project && cd project                                │
│  git init                                                    │
│           ↓                                                  │
│  /agent-foreman:init "goal" →  ai/tasks/                      │
│                                ai/progress.log               │
│                                ai/init.sh                    │
│                                CLAUDE.md                     │
│                                + git commit (auto)           │
│           ↓                                                  │
│  (after coding)                                              │
│  /agent-foreman:analyze     →  docs/ARCHITECTURE.md          │
└─────────────────────────────────────────────────────────────┘
```

### Existing Project Flow

```text
┌─────────────────────────────────────────────────────────────┐
│                  EXISTING PROJECT                            │
├─────────────────────────────────────────────────────────────┤
│  cd existing-project                                         │
│           ↓                                                  │
│  /agent-foreman:analyze    →  Analyzes existing code         │
│                               docs/ARCHITECTURE.md           │
│           ↓                                                  │
│  /agent-foreman:init       →  Reads ARCHITECTURE.md +        │
│                               ai/tasks/                      │
│                               + git commit (suggested)       │
└─────────────────────────────────────────────────────────────┘
```

### Development Loop

```text
┌─────────────────────────────────────────────────────────────┐
│                   DEVELOPMENT LOOP                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│    ┌──────────────────┐                                     │
│    │ /agent-foreman:  │                                     │
│    │     next         │  ← External memory sync             │
│    └────────┬─────────┘    - pwd                            │
│             │              - git log                         │
│             │              - progress.log                    │
│             ↓              - task status                     │
│    ┌──────────────────┐                                     │
│    │   Implement      │                                     │
│    │   Task           │  ← Human or AI agent                │
│    └────────┬─────────┘                                     │
│             │                                                │
│             ↓                                                │
│    ┌──────────────────┐                                     │
│    │ agent-foreman    │                                     │
│    │   check <id>     │  ← Verify implementation            │
│    └────────┬─────────┘                                     │
│             │                                                │
│             ↓                                                │
│    ┌──────────────────┐                                     │
│    │ agent-foreman    │                                     │
│    │   done <id>      │  ← Mark complete + auto-commit      │
│    └────────┬─────────┘                                     │
│             │                                                │
│             └──────────→ Loop back to next                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

After initialization, your project will have:

```
your-project/
├── ai/
│   ├── tasks/              # Task/feature backlog (modular markdown)
│   │   ├── index.json      # Task index (with optional filePath for custom filenames)
│   │   └── {module}/       # Module directories
│   │       └── {id}.md     # Individual tasks (or custom filename via filePath)
│   ├── progress.log        # Immutable audit log
│   └── init.sh             # Bootstrap script
├── docs/
│   └── ARCHITECTURE.md     # AI-generated documentation (optional)
├── CLAUDE.md               # Instructions for AI agents
└── ... (your project files)
```

---

## Task Schema

Tasks are stored as **Markdown files with YAML frontmatter** in `ai/tasks/{module}/{id}.md`:

```markdown
---
id: module.task.action
module: parent-module-name
priority: 1
status: failing
version: 1
origin: manual
dependsOn:
  - other.task.id
supersedes:
  - old.task.id
tags:
  - optional-tag
notes: ""
e2eTags:
  - "@feature-auth"
  - "@smoke"
testRequirements:
  unit:
    required: false
    pattern: tests/module/**/*.test.ts
testFiles:
  - tests/auth/login.test.ts
verification:
  verifiedAt: "2024-01-15T10:00:00Z"
  verdict: pass
  verifiedBy: claude
  commitHash: abc123
  summary: All acceptance criteria met
---
# Human-readable description

## Acceptance Criteria

1. First acceptance criterion
2. Second acceptance criterion
```

**Required fields:** `id`, `description`, `module`, `priority`, `status`, `acceptance`, `version`, `origin`

**Optional fields:** `dependsOn`, `supersedes`, `tags`, `notes`, `e2eTags`, `testRequirements`, `testFiles`, `verification`

**Status values:** `failing` | `passing` | `blocked` | `needs_review` | `failed` | `deprecated`

**Origin values:** `init-auto` | `init-from-routes` | `init-from-tests` | `manual` | `replan`

### testRequirements Structure

```yaml
testRequirements:
  unit:
    required: false
    pattern: tests/auth/**/*.test.ts
    cases:
      - should login
      - should logout
  e2e:
    required: false
    pattern: e2e/auth/**/*.spec.ts
    tags:
      - "@auth"
    scenarios:
      - user can login
```

### verification Structure

```yaml
verification:
  verifiedAt: "2024-01-15T10:00:00Z"
  verdict: pass
  verifiedBy: claude
  commitHash: abc123def456
  summary: All 3 acceptance criteria satisfied
```

**Verdict values:** `pass` | `fail` | `needs_review`

---

## Troubleshooting

### "No AI agents available"

Install at least one AI CLI:

```bash
# Claude
npm install -g @anthropic-ai/claude-code

# Gemini
npm install -g @google/gemini-cli

# Codex
npm install -g @openai/codex
```

### "No task list found"

Run init first:

```bash
agent-foreman init "Your project goal"
```

Or with slash command:

```
/agent-foreman:init Your project goal
```

### "AI analysis failed"

Check that your AI CLI is working:

```bash
agent-foreman agents
```

---

Generated by agent-foreman
