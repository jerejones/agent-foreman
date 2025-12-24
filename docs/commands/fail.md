# fail Command

Mark a task/feature as failed with a reason.

## Command Syntax

```bash
agent-foreman fail <feature_id> [options]
```

## Description

The `fail` command marks a task as failed when verification fails and you want to continue to the next task. This is part of the AI agent loop workflow - instead of stopping on verification failure, mark the task as failed and proceed.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `feature_id` | string | Yes | Task ID to mark as failed |

## Options

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--reason` | `-r` | string | - | Reason for failure |
| `--loop` | - | boolean | `true` | Show next task instruction (use `--no-loop` to disable) |

## Execution Flow

```mermaid
flowchart TD
    A[Start: runFail] --> B[Load Feature List]
    B --> C{Feature List Exists?}
    C -->|No| D[Exit: No task list]
    C -->|Yes| E[Find Feature by ID]
    E --> F{Feature Found?}
    F -->|No| G[Exit: Task not found]
    F -->|Yes| H{Already Failed?}

    H -->|Yes| I[Display: Already failed]
    I --> J[Exit]

    H -->|No| K[Build Notes with Reason]
    K --> L[Update Status to failed]
    L --> M[Save Feature List]
    M --> N[Append Progress Log]
    N --> O[Display Failure Message]

    O --> P{Loop Mode?}
    P -->|Yes| Q{More Tasks?}
    Q -->|Yes| R[Display Loop Instructions]
    Q -->|No| S[Display: No more tasks]
    P -->|No| T[End]
    R --> T
    S --> T
```

## Data Flow Diagram

```mermaid
graph TB
    subgraph Input
        A1[feature_id]
        A2[--reason]
        A3[--loop]
    end

    subgraph DataLoad["Data Loading"]
        B1[loadFeatureList]
        B2[findFeatureById]
        B3[loadFeatureIndex]
    end

    subgraph StatusUpdate["Status Update"]
        C1[Update to failed]
        C2[Add reason to notes]
        C3[Save changes]
    end

    subgraph ProgressLog["Progress Logging"]
        D1[createVerifyEntry]
        D2[appendProgressLog]
    end

    subgraph Output
        E1[Display failure]
        E2[Loop instructions]
        E3[Next task info]
    end

    A1 --> B1
    B1 --> B2
    B2 --> C1
    A2 --> C2
    C1 --> C2
    C2 --> C3
    B3 --> C3

    C3 --> D1
    D1 --> D2

    D2 --> E1
    A3 --> E2
    E2 --> E3
```

## Key Functions

### `runFail(featureId, reason, loopMode)`

**Location**: `src/commands/fail.ts:20`

Main entry point for the fail command.

**Parameters**:
- `featureId: string` - Task ID to mark as failed
- `reason?: string` - Optional failure reason
- `loopMode: boolean` - Whether to show loop continuation instructions

## Output Examples

### Basic Failure

```
✗ Marked 'auth.login' as failed
  Reason: Tests timeout after 30 seconds

══════════════════════════════════════════════════════════════
                   CONTINUE TO NEXT TASK
══════════════════════════════════════════════════════════════

   Failed: auth.login
   Next up: auth.logout
   Progress: 5/17 passing (29%)
   Failed tasks: 1

   LOOP INSTRUCTION:
   1. agent-foreman next
   2. Implement task
   3. agent-foreman check <task_id>
   4. agent-foreman done <task_id>
   5. REPEAT until all tasks processed

   ➤ Continue to the next task NOW.
══════════════════════════════════════════════════════════════
```

### Already Failed

```
⚠ Task 'auth.login' is already marked as failed.
  Previous reason: Verification failed: Tests timeout
```

## Use Cases

### After Verification Failure

```bash
# Verification failed
agent-foreman check auth.login
# Output: ✗ Verification failed...

# Mark as failed and continue
agent-foreman fail auth.login --reason "API endpoint not responding"
```

### In AI Agent Loop

```bash
# When verification fails during loop mode
agent-foreman done auth.login
# Output: ✗ Verification failed...
# Output: 2. Mark as failed: 'agent-foreman fail auth.login -r "reason"'

# Mark and continue
agent-foreman fail auth.login -r "Database schema mismatch"
# Continue with next task
agent-foreman next
```

### Without Loop Mode

```bash
# Just mark as failed without continuation instructions
agent-foreman fail auth.login --reason "Blocked by external API" --no-loop
```

## Status Transition

```mermaid
graph LR
    A[failing] -->|agent-foreman fail| B[failed]
    C[needs_review] -->|agent-foreman fail| B
    D[passing] -->|agent-foreman fail| B

    style B fill:#f44336,color:#fff
```

## Notes Field Format

When marked as failed, the notes field is updated:

```
Verification failed: <reason provided>
```

Or if no reason:
```
Marked as failed
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| "No task list found" | Harness not initialized | Run `agent-foreman init` first |
| "Task not found" | Invalid feature ID | Check `agent-foreman status` for valid IDs |

## Related Commands

- [`done`](./done.md) - Mark task as complete (opposite action)
- [`check`](./check.md) - Verify task (may suggest using fail)
- [`next`](./next.md) - Get next task (failed tasks are excluded)
- [`status`](./status.md) - View all task statuses including failed
