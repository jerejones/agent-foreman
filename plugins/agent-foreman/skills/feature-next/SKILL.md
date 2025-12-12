---
name: feature-next
description: Implements a single feature following the next → implement → check → done workflow with TDD support. Use when working on one specific feature, implementing a single feature from the backlog, or following TDD red-green-refactor cycle. Triggers on 'next feature', 'next task', 'implement feature', 'work on feature', 'single feature mode', 'what should I work on'.
---

# Feature Next

**One command**: `agent-foreman next`

## Quick Start

```bash
agent-foreman next           # Auto-select next priority
agent-foreman next auth.login  # Specific feature
```

## Workflow

```
next → implement → check → done
```

```bash
agent-foreman next              # 1. Get feature + acceptance criteria
# ... implement the feature ... # 2. Write code
agent-foreman check <id>        # 3. Verify implementation
agent-foreman done <id>         # 4. Mark complete + commit
```

### Check TDD Mode First

Look for "!!! TDD ENFORCEMENT ACTIVE !!!" in `agent-foreman next` output.

### TDD Workflow (when strict mode active)

```bash
# STEP 1: Get feature + TDD guidance
agent-foreman next <feature_id>

# STEP 2: RED - Write failing tests FIRST
# Create test file at suggested path
# Run tests: <your-test-command>
# Verify tests FAIL (confirms tests are valid)

# STEP 3: GREEN - Implement minimum code
# Write minimum code to pass tests
# Run tests: <your-test-command>
# Verify tests PASS

# STEP 4: REFACTOR - Clean up
# Clean up code while keeping tests passing

# STEP 5: Verify + Complete
agent-foreman check <feature_id>
agent-foreman done <feature_id>
```

**CRITICAL: DO NOT write implementation code before tests exist in strict TDD mode!**

## Priority Order

1. `needs_review` → may be broken
2. `failing` → not implemented
3. Lower `priority` number → higher priority

## Options

| Flag | Effect |
|------|--------|
| `--check` | Run tests before showing feature |
| `--dry-run` | Preview without changes |
| `--json` | Output as JSON for scripting |
| `--quiet` | Suppress decorative output |
| `--allow-dirty` | Allow with uncommitted changes |
| `--refresh-guidance` | Force regenerate TDD guidance |

## Complete Options

```bash
agent-foreman done <id>            # Mark complete + commit
agent-foreman done <id> --full     # Run all tests
agent-foreman done <id> --skip-e2e # Skip E2E tests
agent-foreman done <id> --no-commit # Manual commit
```
