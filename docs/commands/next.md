# next Command

Show the next task to work on or display details of a specific task.

## Command Syntax

```bash
agent-foreman next [feature_id] [options]
```

## Description

The `next` command selects and displays the highest priority task that needs attention, or shows details for a specific task if an ID is provided. It includes external memory synchronization (git history, progress log) and TDD guidance.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `feature_id` | string | No | Specific task ID to display. If omitted, auto-selects next priority task |

## Options

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--dry-run` | `-d` | boolean | `false` | Show plan without making changes |
| `--check` | `-c` | boolean | `false` | Run basic tests before showing next task |
| `--allow-dirty` | - | boolean | `false` | Allow running with uncommitted changes |
| `--json` | - | boolean | `false` | Output as JSON for scripting |
| `--quiet` | `-q` | boolean | `false` | Suppress decorative output |
| `--refresh-guidance` | - | boolean | `false` | Force regenerate TDD guidance (ignore cache) |

## Execution Flow

```mermaid
flowchart TD
    A[Start: runNext] --> B{--allow-dirty?}
    B -->|No| C{Has Uncommitted Changes?}
    C -->|Yes| D[Exit: Working directory not clean]
    C -->|No| E[Continue]
    B -->|Yes| E

    E --> F[Load Feature List]
    F --> G{Feature List Exists?}
    G -->|No| H[Exit: Run init first]
    G -->|Yes| I{feature_id provided?}

    I -->|Yes| J[Find Feature by ID]
    J --> K{Feature Found?}
    K -->|No| L[Exit: Task not found]
    K -->|Yes| M[Selected Feature]

    I -->|No| N{Index Exists?}
    N -->|Yes| O[selectNextFeatureQuick]
    N -->|No| P[selectNextFeature]
    O --> Q{Feature Selected?}
    P --> Q
    Q -->|No| R[Exit: All tasks passing]
    Q -->|Yes| M

    M --> S{Output Mode?}
    S -->|JSON| T[outputJsonMode]
    S -->|Quiet| U[outputQuietMode]
    S -->|Normal| V[Full Display Mode]

    V --> W[Calculate Stats & Completion]
    W --> X[displayExternalMemorySync]
    X --> Y[displayFeatureInfo]
    Y --> Z[displayTDDGuidance]

    T --> AA[End]
    U --> AA
    Z --> AA
```

## Data Flow Diagram

```mermaid
graph TB
    subgraph Input
        A1[feature_id Parameter]
        A2[CLI Options]
        A3[Working Directory]
    end

    subgraph Validation
        B1[Git Status Check]
        B2[Feature List Load]
        B3[Feature Index Load]
    end

    subgraph Selection["Feature Selection"]
        C1{feature_id provided?}
        C2[findFeatureById]
        C3[selectNextFeature]
        C4[selectNextFeatureQuick]
        C5[Selected Feature]
    end

    subgraph Display["Display Components"]
        D1[External Memory Sync]
        D2[Feature Info]
        D3[TDD Guidance]
    end

    subgraph ExternalMemory["External Memory Sync Content"]
        E1[Current Directory]
        E2[Git Log - Last 5 Commits]
        E3[Progress Log - Last 5 Entries]
        E4[Task Statistics]
        E5[Progress Bar]
        E6[Basic Tests - Optional]
    end

    subgraph FeatureDisplay["Feature Display Content"]
        F1[Task ID & Module]
        F2[Description]
        F3[Acceptance Criteria]
        F4[Dependencies]
        F5[Notes]
        F6[Next Steps]
    end

    subgraph TDDContent["TDD Guidance Content"]
        G1[TDD Mode Check]
        G2[Capability Detection]
        G3[AI TDD Generation]
        G4[Suggested Test Files]
        G5[Test Case Mapping]
        G6[E2E Scenarios]
    end

    A1 --> C1
    A2 --> B1
    A3 --> B1
    B1 --> B2
    B2 --> B3

    C1 -->|Yes| C2
    C1 -->|No| C3
    B3 -->|Exists| C4
    C4 --> C5
    C2 --> C5
    C3 --> C5

    C5 --> D1
    C5 --> D2
    C5 --> D3

    D1 --> E1
    D1 --> E2
    D1 --> E3
    D1 --> E4
    D1 --> E5
    D1 --> E6

    D2 --> F1
    D2 --> F2
    D2 --> F3
    D2 --> F4
    D2 --> F5
    D2 --> F6

    D3 --> G1
    G1 --> G2
    G2 --> G3
    G3 --> G4
    G3 --> G5
    G3 --> G6
```

## Feature Selection Priority

Tasks are selected in this order:

1. **Status Priority**: `needs_review` > `failing`
   - Other statuses (`passing`, `blocked`, `deprecated`, `failed`) are excluded
2. **Priority Number**: Lower number = higher priority (1 is highest)

```mermaid
graph LR
    A[All Features] --> B{Status Filter}
    B -->|needs_review| C[Priority Sort]
    B -->|failing| C
    B -->|Other| D[Excluded]
    C --> E[Lowest Priority # First]
    E --> F[Selected Feature]
```

## Key Functions

### `runNext(featureId, dryRun, runCheck, allowDirty, outputJson, quiet, refreshGuidance)`

**Location**: `src/commands/next.ts:29`

Main entry point for the next command.

**Parameters**:
- `featureId?: string` - Optional specific task ID
- `dryRun: boolean` - Show without changes
- `runCheck: boolean` - Run tests first
- `allowDirty: boolean` - Skip uncommitted changes check
- `outputJson: boolean` - JSON output mode
- `quiet: boolean` - Minimal output
- `refreshGuidance: boolean` - Force regenerate TDD guidance

### `displayExternalMemorySync(cwd, stats, completion, runCheck)`

**Location**: `src/commands/next-display.ts:27`

Displays the external memory synchronization section:
- Current working directory
- Recent git commits (last 5)
- Recent progress log entries (last 5)
- Task status breakdown
- Progress bar visualization
- Optional: Run basic tests via `ai/init.sh check`

### `displayFeatureInfo(feature, dryRun)`

**Location**: `src/commands/next-display.ts:124`

Displays task information:
- Task ID, module, priority, status
- Full description
- Numbered acceptance criteria
- Dependencies (if any)
- Implementation notes (if any)
- Next steps guidance

### `displayTDDGuidance(cwd, feature, refreshGuidance, metadata)`

**Location**: `src/commands/next-display.ts:173`

Displays TDD guidance section:
- Checks TDD mode (strict/recommended/disabled)
- Uses cached guidance if valid
- Generates new AI guidance if needed
- Falls back to regex-based guidance
- Shows suggested test files
- Shows unit test cases and E2E scenarios

## Output Modes

### Normal Mode (Default)

Full decorated output with:
- External memory sync section
- Task info section
- TDD guidance section

### JSON Mode (`--json`)

```json
{
  "feature": {
    "id": "auth.login",
    "description": "User can log in",
    "module": "auth",
    "priority": 1,
    "status": "failing",
    "acceptance": ["..."],
    "dependsOn": [],
    "notes": null
  },
  "stats": {
    "passing": 5,
    "failing": 10,
    "needsReview": 2,
    "total": 17
  },
  "completion": 29,
  "cwd": "/path/to/project",
  "tddGuidance": { ... }
}
```

### Quiet Mode (`--quiet`)

```
Task: auth.login
Description: User can log in
Status: failing
Acceptance:
  1. User enters valid credentials and is logged in
  2. Invalid credentials show error message
```

## TDD Guidance Generation

```mermaid
flowchart TD
    A[Start TDD Guidance] --> B{Cache Valid?}
    B -->|Yes| C[Use Cached Guidance]
    B -->|No| D[Detect Capabilities]

    D --> E[Generate AI TDD Guidance]
    E --> F{AI Success?}
    F -->|Yes| G[Save to Feature Cache]
    F -->|No| H[Fallback: Regex Generation]

    G --> I[Display Guidance]
    H --> I
    C --> I

    I --> J{Strict TDD Mode?}
    J -->|Yes| K[Show Enforcement Warning]
    J -->|No| L[Show Standard Guidance]

    K --> M[Display Test Files]
    L --> M
    M --> N[Display Test Cases]
    N --> O[End]
```

## Examples

### Auto-Select Next Task

```bash
# Get the highest priority pending task
agent-foreman next
```

### Specific Task

```bash
# Get details for a specific task
agent-foreman next auth.login
```

### With Tests

```bash
# Run basic tests before showing next task
agent-foreman next --check
```

### JSON Output

```bash
# Output as JSON for scripting
agent-foreman next --json | jq '.feature.id'
```

### Force TDD Guidance Refresh

```bash
# Regenerate TDD guidance ignoring cache
agent-foreman next auth.login --refresh-guidance
```

### Allow Dirty Working Directory

```bash
# Skip uncommitted changes check
agent-foreman next --allow-dirty
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| "Working directory not clean" | Uncommitted git changes | Commit or stash changes, or use `--allow-dirty` |
| "No task list found" | Harness not initialized | Run `agent-foreman init` first |
| "Task not found" | Invalid feature ID | Check available tasks with `agent-foreman status` |
| "All tasks passing" | No pending tasks | All work complete! |

## Related Commands

- [`init`](./init.md) - Initialize the harness
- [`status`](./status.md) - View all tasks status
- [`check`](./check.md) - Verify task implementation
- [`done`](./done.md) - Mark task as complete
