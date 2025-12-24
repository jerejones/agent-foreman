# Long-Task Harness

This project uses the **agent-foreman** harness for feature-driven development with AI agents.

> **Note**: Tasks and features are used interchangeably in this harness. The term "task" is preferred for the Universal Verification Strategy (UVS), while "feature" remains for backward compatibility.

## Core Files

| File | Purpose |
|------|---------|
| `ai/tasks/index.json` | Task/feature index with status summary |
| `ai/tasks/{module}/{id}.md` | Individual task definitions |
| `ai/progress.log` | Session handoff audit log |
| `ai/init.sh` | Bootstrap script (install/dev/check) |

## Task/Feature Status Values

- `failing` - Not yet implemented or incomplete
- `passing` - Acceptance criteria met
- `blocked` - External dependency blocking
- `needs_review` - Potentially affected by recent changes
- `failed` - Implementation attempted but verification failed
- `deprecated` - No longer needed

## Feature Selection Priority

When running `agent-foreman next`, features are selected in this order:
1. **Status first**: `needs_review` > `failing` (other statuses excluded)
2. **Then priority number**: Lower number = higher priority (1 is highest)

Example: A feature with `priority: 1` runs before `priority: 10`

### Excluded from Auto-Selection

The following statuses are **NOT** automatically selected by `agent-foreman next`:
- `passing` - Already complete
- `failed` - Needs manual investigation (use `agent-foreman fail` to mark)
- `blocked` - Waiting on external dependency
- `deprecated` - No longer needed

To work on a `failed` task after fixing the issue, manually run:
```bash
agent-foreman next <task_id>  # Then fix and complete it
```
