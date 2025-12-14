# Agent Foreman Usage Guide

This guide provides detailed usage instructions for agent-foreman.

> 本指南提供 agent-foreman 的详细使用说明。

---

## Claude Code Plugin (Recommended)

agent-foreman is designed as a Claude Code plugin. This is the recommended way to use it.

> agent-foreman 设计为 Claude Code 插件，这是推荐的使用方式。

### Installation

```
/plugin marketplace add mylukin/agent-foreman
/plugin install agent-foreman
```

### Slash Commands Reference

| Command | Description |
|---------|-------------|
| `/agent-foreman:status` | View project status and progress |
| `/agent-foreman:init` | Initialize harness with project goal |
| `/agent-foreman:analyze` | Analyze existing project structure |
| `/agent-foreman:next` | Get next priority feature to work on |
| `/agent-foreman:run` | Auto-complete all pending features |

---

### `/agent-foreman:init`

Initialize or upgrade the long-task harness.

> 初始化或升级长任务框架。

**Usage:**
```
/agent-foreman:init <goal>
/agent-foreman:init <goal> --mode new
/agent-foreman:init <goal> --mode scan
```

**Parameters:**
- `<goal>` - Project goal in natural language (supports English and Chinese)
- `--mode merge` - (default) Merge new features with existing list
- `--mode new` - Replace existing feature list entirely
- `--mode scan` - Preview only, don't save

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

Get the next priority feature to work on.

> 获取下一个优先任务。

**Usage:**
```
/agent-foreman:next
/agent-foreman:next <feature_id>
```

**Parameters:**
- `<feature_id>` - (optional) Work on specific feature
- `--dry-run` / `-d` - Preview only, don't select
- `--check` / `-c` - Run basic tests before showing next task
- `--allow-dirty` - Allow running with uncommitted changes
- `--json` - Output as JSON for scripting
- `--quiet` / `-q` - Suppress decorative output
- `--refresh-guidance` - Force regenerate TDD guidance

**Priority Order:**
1. `needs_review` status (highest priority)
2. `failing` status
3. Lower priority number

**Examples:**
```
/agent-foreman:next
/agent-foreman:next auth.login
/agent-foreman:next --json
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
- Feature counts by status
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
/agent-foreman:run                  # Auto-complete all features
/agent-foreman:run auth.login       # Work on specific feature
```

**Parameters:**
- No argument: Auto-complete all pending features in priority order
- `<feature_id>`: Work on the specified feature only

**Examples:**
```
/agent-foreman:run                  # Complete all pending tasks
/agent-foreman:run api.users.create # Work on specific feature
```

**Execution loop (when no feature_id):**
1. Check status
2. Get next feature (auto-selected by priority)
3. Implement feature (satisfy ALL acceptance criteria)
4. Complete feature with verification
5. Repeat until all done

**Exit conditions:**
- All features `passing`/`deprecated` → Success
- Verification fails → Stop and report
- User interrupts → Stop with clean state

---

## Feature Completion

After implementing a feature, mark it complete using the CLI:

```bash
agent-foreman done <feature_id>
```

**Options:**
| Flag | Description |
|------|-------------|
| `--quick` / `-q` | Run only related tests (default) |
| `--full` | Run complete test suite |
| `--test-pattern <pattern>` | Use explicit test pattern |
| `--skip-e2e` | Skip E2E tests |
| `--no-skip-check` | Run verification (default skips) |
| `--no-commit` | Skip auto-commit |
| `--verbose` / `-v` | Show detailed verification output |
| `--ai` | Enable AI autonomous exploration for verification |
| `--loop` / `--no-loop` | Enable/disable loop mode (continuation reminder) |
| `--notes` / `-n` | Add completion notes |

**Examples:**
```bash
# Quick mode (default) - runs only related tests
agent-foreman done auth.login

# Full mode - runs all tests
agent-foreman done auth.login --full --no-skip-check

# Explicit pattern
agent-foreman done auth.login --test-pattern "tests/auth/*.test.ts"

# With verification
agent-foreman done auth.login --no-skip-check --verbose
```

---

## Feature Verification

Preview verification without completing a feature:

```bash
agent-foreman check <feature_id>
```

**Options:**
| Flag | Description |
|------|-------------|
| `--verbose` / `-v` | Show detailed AI reasoning |
| `--skip-checks` / `-s` | Skip automated checks, AI only |
| `--ai` | Enable AI autonomous exploration for verification |
| `--quick` / `-q` | Run only related tests (default) |
| `--full` | Run complete test suite |
| `--test-pattern <pattern>` | Explicit test pattern |
| `--skip-e2e` | Skip E2E tests |

**Examples:**

```bash
# Standard verification
agent-foreman check auth.login

# Verbose mode with full tests
agent-foreman check auth.login --verbose --full

# AI-only verification (skip automated checks)
agent-foreman check auth.login --skip-checks
```

---

## CLI Reference

For users not using Claude Code, agent-foreman is available as a standalone CLI.

### Installation

```bash
# Global installation
npm install -g agent-foreman

# Or use with npx
npx agent-foreman <command>
```

### Commands

| Command | Description |
|---------|-------------|
| `analyze [output]` | Generate project architecture report |
| `init [goal]` | Initialize or upgrade the harness |
| `next [feature_id]` | Show next feature to work on |
| `status` | Show current project status |
| `check <feature_id>` | Verify implementation (without marking complete) |
| `done <feature_id>` | Mark complete and auto-commit |
| `fail <feature_id>` | Mark as failed and continue to next |
| `impact <feature_id>` | Analyze impact of changes |
| `tdd [mode]` | View or change TDD mode |
| `agents` | Show available AI agents |
| `scan` | Scan project verification capabilities |
| `install` | Install Claude Code plugin |
| `uninstall` | Uninstall Claude Code plugin |

### Plugin Installation

```bash
# Install plugin (registers marketplace + installs + enables)
agent-foreman install

# Force reinstall
agent-foreman install --force

# Uninstall (removes all registrations)
agent-foreman uninstall
```

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
agent-foreman next             # Get next task
# ... implement feature ...
agent-foreman check cli.init   # Verify implementation
agent-foreman done cli.init    # Mark complete + commit
agent-foreman next             # Continue
```

---

## Command Relationships

Understanding when to use each command:

### `analyze` vs `init`

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `analyze` | **Documentation only** - Generate ARCHITECTURE.md | Before init (for existing projects), or anytime you want updated docs |
| `init` | **Setup harness** - Create feature list + rules | Once per project, or to add new features |

**Typical flow for existing projects:**

```bash
# Step 1: Analyze first (creates ARCHITECTURE.md)
agent-foreman analyze

# Step 2: Init reads ARCHITECTURE.md to generate features
agent-foreman init "Add new features"
```

**Typical flow for new projects:**

```bash
# Just init - it will scan the codebase if needed
agent-foreman init "Build a REST API"
```

### `scan` Command Role

The `scan` command detects project verification capabilities:

```bash
agent-foreman scan          # Detect and cache capabilities
agent-foreman scan --force  # Force re-detection
```

**When to use:**

- After `init` to verify capabilities were detected correctly
- After changing package.json, tsconfig, or test configuration
- When `check`/`done` verification commands fail unexpectedly

**What it detects:**

- Test framework (Jest, Vitest, pytest, etc.)
- Test command
- Linter (ESLint, Biome, etc.)
- Type checker
- Build command
- E2E framework (Playwright, Cypress, etc.)

### `impact` for Re-verification

Use `impact` to analyze dependency chains before modifying shared code:

```bash
agent-foreman impact auth.login
```

**Workflow for modifying passing features:**

```bash
# 1. Check impact first
agent-foreman impact auth.login
# Shows: dashboard.profile, api.protected-routes depend on this

# 2. Make your changes

# 3. Re-verify the changed feature
agent-foreman check auth.login

# 4. If check passes, dependent features may need review
# Manually mark them as needs_review or re-run check on them
```

---

## Error Recovery

When verification fails, use the `fail` command to continue the loop:

### Using `fail` Command

```bash
# After check fails
agent-foreman check auth.login
# Output: ✗ Verification failed

# Mark as failed and continue
agent-foreman fail auth.login --reason "Tests failing: API not implemented"

# Continue to next feature
agent-foreman next
```

### Error Recovery Workflow

```text
┌─────────────────────────────────────────────────────────────┐
│                    ERROR RECOVERY                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│    ┌──────────────────┐                                     │
│    │ check fails or   │                                     │
│    │ done fails       │                                     │
│    └────────┬─────────┘                                     │
│             │                                                │
│             ↓                                                │
│    ┌──────────────────┐                                     │
│    │ agent-foreman    │                                     │
│    │ fail <id>        │  ← Mark as failed with reason       │
│    │ --reason "..."   │                                     │
│    └────────┬─────────┘                                     │
│             │                                                │
│             ↓                                                │
│    ┌──────────────────┐                                     │
│    │ agent-foreman    │                                     │
│    │ next             │  ← Continue to next feature         │
│    └────────┬─────────┘                                     │
│             │                                                │
│             └──────────→ Continue loop                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Rules for AI Agents

When in loop mode (processing all features):

1. **NEVER STOP** for verification failures
2. Use `agent-foreman fail` to mark and continue
3. Only stop when all features are processed
4. Review failed features in the summary

---

## TDD Mode Configuration

Change TDD mode anytime after initialization:

```bash
# View current mode
agent-foreman tdd

# Enable strict TDD (tests required)
agent-foreman tdd strict

# Enable recommended TDD (tests suggested, default)
agent-foreman tdd recommended

# Disable TDD guidance
agent-foreman tdd disabled
```

| Mode | Effect |
|------|--------|
| `strict` | Tests REQUIRED - check/done fail without tests |
| `recommended` | Tests suggested - TDD guidance shown |
| `disabled` | No TDD guidance or requirements |

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
│  /agent-foreman:init "goal" →  ai/feature_list.json         │
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
│                               ai/feature_list.json           │
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
│    │ agent-foreman    │                                     │
│    │     next         │  ← External memory sync             │
│    └────────┬─────────┘    - pwd, git log, progress.log     │
│             │                                                │
│             ↓                                                │
│    ┌──────────────────┐                                     │
│    │   Implement      │                                     │
│    │   Feature        │  ← Human or AI agent                │
│    └────────┬─────────┘                                     │
│             │                                                │
│             ↓                                                │
│    ┌──────────────────┐                                     │
│    │ agent-foreman    │                                     │
│    │   check <id>     │  ← Verify implementation            │
│    └────────┬─────────┘                                     │
│             │                                                │
│         ┌───┴───┐                                           │
│         │       │                                           │
│       pass    fail                                          │
│         │       │                                           │
│         ↓       ↓                                           │
│    ┌────────┐ ┌────────┐                                   │
│    │  done  │ │  fail  │                                   │
│    │  <id>  │ │  <id>  │  ← Mark failed + continue         │
│    └───┬────┘ └───┬────┘                                   │
│        │          │                                         │
│        └────┬─────┘                                         │
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
│   ├── feature_list.json   # Feature backlog (JSON for AI)
│   ├── progress.log        # Immutable audit log
│   └── init.sh             # Bootstrap script
├── docs/
│   └── ARCHITECTURE.md     # AI-generated documentation (optional)
├── CLAUDE.md               # Instructions for AI agents
└── ... (your project files)
```

---

## Feature JSON Schema

```json
{
  "id": "module.feature.action",
  "description": "Human-readable description",
  "module": "parent-module-name",
  "priority": 1,
  "status": "failing",
  "acceptance": [
    "First acceptance criterion",
    "Second acceptance criterion"
  ],
  "dependsOn": ["other.feature.id"],
  "tags": ["optional-tag"],
  "version": 1,
  "origin": "manual",
  "notes": "",
  "testRequirements": {
    "unit": { "required": false, "pattern": "tests/module/**/*.test.ts" }
  }
}
```

**Status values:** `failing` | `passing` | `blocked` | `needs_review` | `failed` | `deprecated`

**Origin values:** `init-auto` | `init-from-routes` | `init-from-tests` | `manual` | `replan`

### testRequirements Structure

```json
"testRequirements": {
  "unit": {
    "required": false,
    "pattern": "tests/auth/**/*.test.ts",
    "cases": ["should login", "should logout"]
  },
  "e2e": {
    "required": false,
    "pattern": "e2e/auth/**/*.spec.ts",
    "tags": ["@auth"],
    "scenarios": ["user can login"]
  }
}
```

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

### "No feature list found"

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
