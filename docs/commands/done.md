# done Command

Verify and mark a task/feature as complete.

## Command Syntax

```bash
agent-foreman done <feature_id> [options]
```

## Description

The `done` command marks a task as complete after optional verification. By default, it skips verification (assuming you ran `check` first) and updates the task status to `passing`. When AI verification returns `needs_review`, the status is set to `needs_review` instead of `passing` to preserve the AI's assessment. It also handles git commits, shows the next task, and supports loop mode for continuous task processing.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `feature_id` | string | Yes | Task ID to mark complete |

## Options

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--notes` | `-n` | string | - | Additional notes to add |
| `--no-commit` | - | boolean | `false` | Skip automatic git commit |
| `--skip-check` | - | boolean | `true` | Skip verification (use `--no-skip-check` to run) |
| `--verbose` | `-v` | boolean | `false` | Show detailed verification output |
| `--ai` | - | boolean | `false` | Enable AI autonomous exploration for verification |
| `--quick` | - | boolean | `true` | Run only related tests (selective) |
| `--full` | - | boolean | `false` | Force full test suite |
| `--test-pattern` | - | string | - | Explicit test pattern to use |
| `--skip-e2e` | - | boolean | `false` | Skip E2E tests entirely |
| `--loop` | - | boolean | `true` | Loop mode (use `--no-loop` to disable) |

## Execution Flow

```mermaid
flowchart TD
    A[Start: runDone] --> B[Load Feature List]
    B --> C{Feature List Exists?}
    C -->|No| D[Exit: No task list]
    C -->|Yes| E[Find Feature by ID]
    E --> F{Feature Found?}
    F -->|No| G[Exit: Task not found]
    F -->|Yes| H{TDD Gate Required?}

    H -->|Yes| I[TDD Verification Gate]
    I --> J{Gate Passed?}
    J -->|No| K[Exit: TDD Gate Failed]
    J -->|Yes| L[Continue]
    H -->|No| L

    L --> M{--skip-check?}
    M -->|Yes| N[Skip Verification]
    M -->|No| O[Run Verification]
    O --> P{Verification Passed?}
    P -->|No| Q[Exit: Verification Failed]
    P -->|Yes| R[Continue]
    P -->|needs_review| S[Prompt Confirmation]
    S --> T{User Confirms?}
    T -->|No| U[Exit: Not Marked]
    T -->|Yes| R
    N --> R

    R --> V[Discover Test Files]
    V --> W[Update Feature Status based on verdict]
    W --> X[Save Feature List]
    X --> Y[Append Progress Log]
    Y --> Z{autoCommit?}

    Z -->|Yes| AA[Git Add & Commit]
    Z -->|No| AB[Display Commit Suggestion]
    AA --> AC[Continue]
    AB --> AC

    AC --> AD{More Tasks?}
    AD -->|Yes| AE{Loop Mode?}
    AE -->|Yes| AF[Display Loop Instructions]
    AE -->|No| AG[Show Next Task]
    AD -->|No| AH{Loop Mode?}
    AH -->|Yes| AI[Display Loop Complete Summary]
    AH -->|No| AJ[Celebrate Completion]

    AF --> AK[End]
    AG --> AK
    AI --> AK
    AJ --> AL[Regenerate Survey]
    AL --> AK
```

## Data Flow Diagram

```mermaid
graph TB
    subgraph Input
        A1[feature_id]
        A2[CLI Options]
        A3[Working Directory]
    end

    subgraph DataLoad["Data Loading"]
        B1[loadFeatureList]
        B2[findFeatureById]
        B3[loadFeatureIndex]
    end

    subgraph TDDGate["TDD Gate (Optional)"]
        C1{Strict Mode?}
        C2{Required Tests?}
        C3[verifyTDDGate]
    end

    subgraph Verification["Verification (Optional)"]
        D1[runVerification]
        D2[verifyFeature]
        D3[verifyFeatureAutonomous]
        D4[formatVerificationResult]
    end

    subgraph StatusUpdate["Status Update"]
        E1[discoverFeatureTestFiles]
        E2[updateFeatureStatus]
        E3[updateFeatureStatusQuick]
        E4[saveFeatureList]
    end

    subgraph ProgressLog["Progress Logging"]
        F1[createStepEntry]
        F2[appendProgressLog]
    end

    subgraph GitOps["Git Operations"]
        G1[gitAdd]
        G2[gitCommit]
        G3[Commit Message Generation]
    end

    subgraph Output
        H1[Show Next Task]
        H2[Loop Mode Display]
        H3[Completion Summary]
        H4[Regenerate Survey]
    end

    A1 --> B1
    B1 --> B2
    B2 --> C1
    C1 --> C3
    C2 --> C3

    C3 -->|Pass| D1
    D1 --> D2
    D1 --> D3
    D2 --> D4
    D3 --> D4

    D4 --> E1
    E1 --> E2
    B3 -->|Exists| E3
    E2 --> E4
    E3 --> E4

    E4 --> F1
    F1 --> F2

    F2 --> G1
    G1 --> G2
    G2 --> G3

    G3 --> H1
    H1 --> H2
    H1 --> H3
    H3 --> H4
```

## TDD Gate Verification

Same as `check` command - verifies test files exist when:
- TDD mode is `strict`
- Feature has `testRequirements.*.required: true`

## Verification Process

When `--no-skip-check` is used:

```mermaid
flowchart TD
    A[Start Verification] --> B[Display Header]
    B --> C[Run Automated Checks]
    C --> D[Run AI Analysis]
    D --> E[Format Result]
    E --> F[Update Feature Summary]
    F --> G[Save & Log]
    G --> H{Verdict?}

    H -->|pass| I[Set Status: passing]
    H -->|fail| J[Exit with Error]
    H -->|needs_review| K[Prompt User]
    K --> L{Confirmed?}
    L -->|Yes| N[Set Status: needs_review]
    L -->|No| M[Exit: Not Marked]
    I --> O[Continue to Save]
    N --> O
```

## Loop Mode

When loop mode is active (default), after completing a task:

### If More Tasks Remain

```
══════════════════════════════════════════════════════════════
                   FEATURE LOOP MODE ACTIVE
══════════════════════════════════════════════════════════════

   Completed: auth.login (5/17 features)
   Next up: auth.logout
   Progress: 29% complete

   ⛔ NO QUESTIONS ALLOWED
   - NEVER ask: "Should I...", "Do you want...", "Which approach..."
   - ALWAYS make autonomous decisions and proceed
   - On ANY error: mark as failed, continue to next

   LOOP INSTRUCTION:
   1. agent-foreman next
   2. Implement task
   3. agent-foreman check <task_id>
   4. agent-foreman done <task_id>
   5. REPEAT until all tasks processed

   ➤ Do NOT stop. Do NOT ask questions. Continue NOW.
══════════════════════════════════════════════════════════════
```

### If All Tasks Complete

```
══════════════════════════════════════════════════════════════
                   FEATURE LOOP COMPLETE
══════════════════════════════════════════════════════════════

   All features have been processed.

   Summary:
   ✓ Passing: 15
   ✗ Failed: 2
   ⚠ Blocked: 0

   Run 'agent-foreman status' for details.
══════════════════════════════════════════════════════════════
```

## Git Commit Behavior

When `--no-commit` is NOT set and in a git repository:

```mermaid
flowchart TD
    A[Git Operations] --> B[gitAdd all]
    B --> C{Add Success?}
    C -->|No| D[Display Commit Suggestion]
    C -->|Yes| E[gitCommit]
    E --> F{Commit Success?}
    F -->|Yes| G[Display Commit Hash]
    F -->|No Changes| H[Display: No changes]
    F -->|Error| D
```

**Commit Message Format**:
```
feat(module): Feature description

Feature: feature.id

🤖 Generated with agent-foreman
```

## Key Functions

### `runDone(featureId, notes, autoCommit, skipCheck, verbose, ai, testMode, testPattern, skipE2E, e2eMode, loopMode)`

**Location**: `src/commands/done.ts:57`

Main entry point for the done command.

### `runVerification(...)`

**Location**: `src/commands/done.ts:279`

Internal function that runs verification when `--no-skip-check` is used.

### `handleCommit(cwd, feature, autoCommit)`

**Location**: `src/commands/done.ts:368`

Handles git add and commit operations.

### `regenerateSurvey(cwd, featureList)`

**Location**: `src/commands/done-helpers.ts:16`

Regenerates `docs/ARCHITECTURE.md` when all features complete.

## Status Update Process

```mermaid
flowchart TD
    A[Status Update] --> B{Index Exists?}
    B -->|Yes| C[updateFeatureStatusQuick]
    B -->|No| D[updateFeatureStatus]

    C --> E[Update index.json]
    C --> F[Update feature.md]
    D --> G[Update FeatureList]
    D --> H[saveFeatureList]

    E --> I[Done]
    F --> I
    G --> H
    H --> I
```

## Examples

### Basic Completion

```bash
# Mark task as done (skips verification by default)
agent-foreman done auth.login
```

### With Verification

```bash
# Run verification before marking complete
agent-foreman done auth.login --no-skip-check
```

### With Notes

```bash
# Add implementation notes
agent-foreman done auth.login --notes "Used JWT for session management"
```

### Skip Git Commit

```bash
# Don't auto-commit
agent-foreman done auth.login --no-commit
```

### Full Verification

```bash
# Run full test suite during verification
agent-foreman done auth.login --no-skip-check --full
```

### With AI Verification

```bash
# Run verification with AI autonomous exploration
agent-foreman done auth.login --no-skip-check --ai
```

### Disable Loop Mode

```bash
# Don't show loop continuation instructions
agent-foreman done auth.login --no-loop
```

## Workflow Recommendations

### Standard Workflow

```bash
# 1. Get task
agent-foreman next auth.login

# 2. Implement task
# ... coding ...

# 3. Verify implementation
agent-foreman check auth.login

# 4. Mark complete (skip re-verification)
agent-foreman done auth.login
```

### Quick Iteration

```bash
# Verify and complete in one step
agent-foreman done auth.login --no-skip-check
```

### AI Agent Loop

```bash
# For AI agents in continuous mode
agent-foreman next
# implement
agent-foreman check <task_id>
agent-foreman done <task_id>
# repeat...
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| "No task list found" | Harness not initialized | Run `agent-foreman init` |
| "Task not found" | Invalid feature ID | Check with `agent-foreman status` |
| "TDD Gate Failed" | Missing required test files | Create test files first |
| "Verification failed" | Tests or criteria not met | Fix issues and re-run |

## Survey Regeneration

When all tasks are complete:
1. AI scans project structure
2. Updates `docs/ARCHITECTURE.md`
3. Shows 100% completion status

## Related Commands

- [`next`](./next.md) - Get next task
- [`check`](./check.md) - Verify without marking done
- [`status`](./status.md) - View overall progress
- [`impact`](./impact.md) - Analyze change impact
