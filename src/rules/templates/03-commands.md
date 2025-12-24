# Commands

## Core Workflow Commands

```bash
# View project status
agent-foreman status

# Work on next priority task
agent-foreman next

# Work on specific task
agent-foreman next <task_id>

# Fast check (default) - git diff based verification
agent-foreman check
# → Runs: typecheck + lint + selective tests (based on changed files)
# → Skips: build, E2E, AI analysis
# → Shows: Task impact notification

# Fast check with AI task verification
agent-foreman check --ai
# → Fast checks + AI verification for affected tasks

# Full verification - all tests + build + E2E
agent-foreman check --full

# Task-specific verification (no AI by default)
agent-foreman check <task_id>
# → Runs: typecheck + lint + tests + build
# → Skips: AI analysis (use --ai to enable)

# Task-specific verification with AI exploration
agent-foreman check <task_id> --ai
# → Full checks + AI autonomous exploration

# Mark task as done (skips verification by default, use after check)
agent-foreman done <task_id>

# Mark task as done (with verification, for manual use)
agent-foreman done <task_id> --no-skip-check

# Mark task as done with AI verification
agent-foreman done <task_id> --no-skip-check --ai

# Mark task as failed (when verification fails and you want to continue)
agent-foreman fail <task_id> --reason "Brief failure description"

# Full mode - run all tests (slower, for final verification)
agent-foreman done <task_id> --full --no-skip-check

# Skip E2E tests (faster iterations)
agent-foreman done <task_id> --skip-e2e

# Skip auto-commit (manual commit)
agent-foreman done <task_id> --no-commit

# Disable loop mode (no continuation reminder)
agent-foreman done <task_id> --no-loop

# Analyze impact of changes on dependent tasks
agent-foreman impact <task_id>
```

## Analysis & Setup Commands

```bash
# Full harness initialization (default behavior)
agent-foreman init

# Generate ARCHITECTURE.md only (skip harness setup)
agent-foreman init --analyze
agent-foreman init --analyze --analyze-output custom/path.md

# Detect verification capabilities only (skip harness setup)
agent-foreman init --scan
agent-foreman init --scan --scan-force  # Force re-detection (ignore cache)

# Show AI agent status (claude, codex, gemini)
agent-foreman agents
```

## TDD Mode Commands

```bash
# View current TDD mode
agent-foreman tdd

# Enable strict TDD (tests required, workflow mandatory)
agent-foreman tdd strict

# Enable recommended TDD (tests suggested, default)
agent-foreman tdd recommended

# Disable TDD guidance
agent-foreman tdd disabled
```

## Plugin Commands

```bash
# Install Claude Code plugin
agent-foreman install

# Uninstall Claude Code plugin
agent-foreman uninstall
```

## Bootstrap Scripts

```bash
# Bootstrap/development/testing
./ai/init.sh bootstrap
./ai/init.sh dev
./ai/init.sh check                # Fast mode (git diff based)
./ai/init.sh check --ai           # Fast + AI task verification
./ai/init.sh check --full         # Full verification (all tests + build + E2E)
./ai/init.sh check <task_id>      # Task-specific verification
```
