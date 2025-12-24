# status Command

Show current task/feature harness status overview.

## Command Syntax

```bash
agent-foreman status [options]
```

## Description

The `status` command displays a comprehensive overview of the project's task status, including counts by status, completion percentage, recent activity, and the next task to work on.

## Options

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--json` | - | boolean | `false` | Output as JSON for scripting |
| `--quiet` | `-q` | boolean | `false` | Suppress decorative output |

## Execution Flow

```mermaid
flowchart TD
    A[Start: runStatus] --> B[Load Feature Index]
    B --> C[Load Feature List]
    C --> D{Feature List Exists?}
    D -->|No| E[Exit: Run init first]
    D -->|Yes| F{Index Exists?}

    F -->|Yes| G[getFeatureStatsQuick]
    F -->|No| H[getFeatureStats]
    G --> I[Calculate Statistics]
    H --> I

    F -->|Yes| J[selectNextFeatureQuick]
    F -->|No| K[selectNextFeature]
    J --> L[Next Feature]
    K --> L

    I --> M[getCompletionPercentage]
    M --> N[getRecentEntries]
    N --> O{Output Mode?}

    O -->|JSON| P[Output JSON]
    O -->|Quiet| Q[Output Minimal]
    O -->|Normal| R[Output Full Dashboard]

    P --> S[End]
    Q --> S
    R --> S
```

## Data Flow Diagram

```mermaid
graph TB
    subgraph Input
        A1[Working Directory]
        A2[CLI Options]
    end

    subgraph DataLoad["Data Loading"]
        B1[loadFeatureIndex]
        B2[loadFeatureList]
        B3[getRecentEntries]
    end

    subgraph Statistics["Statistics Calculation"]
        C1[Feature Stats]
        C2[Completion Percentage]
        C3[Next Feature Selection]
    end

    subgraph StatsBreakdown["Stats Breakdown"]
        D1[passing count]
        D2[failing count]
        D3[failed count]
        D4[needs_review count]
        D5[blocked count]
        D6[deprecated count]
    end

    subgraph Output["Output Generation"]
        E1[JSON Mode]
        E2[Quiet Mode]
        E3[Normal Dashboard]
    end

    subgraph Dashboard["Dashboard Components"]
        F1[Project Goal]
        F2[Last Updated]
        F3[Status Breakdown]
        F4[Progress Bar]
        F5[Recent Activity]
        F6[Next Up]
    end

    A1 --> B1
    A1 --> B2
    A1 --> B3
    A2 --> E1
    A2 --> E2
    A2 --> E3

    B1 --> C1
    B2 --> C1
    B2 --> C2
    B2 --> C3

    C1 --> D1
    C1 --> D2
    C1 --> D3
    C1 --> D4
    C1 --> D5
    C1 --> D6

    D1 --> E1
    D1 --> E2
    D1 --> E3
    C2 --> E3
    C3 --> E3
    B3 --> E3

    E3 --> F1
    E3 --> F2
    E3 --> F3
    E3 --> F4
    E3 --> F5
    E3 --> F6
```

## Key Functions

### `runStatus(outputJson, quiet)`

**Location**: `src/commands/status.ts:21`

Main entry point for the status command.

**Parameters**:
- `outputJson: boolean` - Enable JSON output mode
- `quiet: boolean` - Enable minimal output mode

### `getFeatureStats(features)` / `getFeatureStatsQuick(cwd)`

**Location**: `src/features/stats.ts`

Calculates task statistics by status.

**Returns**:
```typescript
{
  passing: number;
  failing: number;
  failed: number;
  needs_review: number;
  blocked: number;
  deprecated: number;
}
```

### `getCompletionPercentage(features)`

**Location**: `src/features/stats.ts`

Calculates overall completion percentage.

**Formula**: `(passing / (total - deprecated)) * 100`

### `getRecentEntries(cwd, count)`

**Location**: `src/progress-log.ts`

Retrieves recent progress log entries.

**Parameters**:
- `cwd: string` - Working directory
- `count: number` - Number of entries to retrieve

**Returns**: `ProgressLogEntry[]`

## Output Modes

### Normal Mode (Default)

```
📊 Project Status
   Goal: Build a REST API for user management
   Last updated: 2025-01-15T10:00:00Z

   Task Status:
   ✓ Passing: 5
   ⚠ Needs Review: 2
   ✗ Failing: 8
   ⚡ Failed: 1
   ⏸ Blocked: 0
   ⊘ Deprecated: 1

   Completion: [████████░░░░░░░░░░░░░░░░░░░░░░] 29%

   Recent Activity:
   2025-01-15 [STEP] Completed auth.login
   2025-01-14 [VERIFY] Verified auth.register: pass
   2025-01-14 [INIT] Initialized harness

   Next Up:
   → auth.logout: User can log out
```

### JSON Mode (`--json`)

```json
{
  "goal": "Build a REST API for user management",
  "updatedAt": "2025-01-15T10:00:00Z",
  "stats": {
    "passing": 5,
    "failing": 8,
    "failed": 1,
    "needsReview": 2,
    "blocked": 0,
    "deprecated": 1,
    "total": 17
  },
  "completion": 29,
  "recentActivity": [
    {
      "type": "STEP",
      "timestamp": "2025-01-15T10:30:00Z",
      "summary": "Completed auth.login"
    }
  ],
  "nextFeature": {
    "id": "auth.logout",
    "description": "User can log out",
    "status": "failing"
  }
}
```

### Quiet Mode (`--quiet`)

```
29% complete | 5/17 passing
Next: auth.logout
```

## Status Indicators

| Status | Icon | Color | Description |
|--------|------|-------|-------------|
| `passing` | ✓ | Green | Acceptance criteria met |
| `failing` | ✗ | Red | Not yet implemented |
| `failed` | ⚡ | Red | Implementation attempted but failed |
| `needs_review` | ⚠ | Yellow | Potentially affected by changes |
| `blocked` | ⏸ | Gray | External dependency blocking |
| `deprecated` | ⊘ | Gray | No longer needed |

## Progress Bar

Visual representation of completion:

```
[████████░░░░░░░░░░░░░░░░░░░░░░] 29%
 ^^^^^^^^                        ^^
 Filled (passing)               Percentage
         ^^^^^^^^^^^^^^^^^^^^^^
         Empty (remaining)
```

- Bar width: 30 characters
- Filled blocks (█): Proportional to completion
- Empty blocks (░): Remaining work

## Recent Activity Log Types

| Type | Color | Description |
|------|-------|-------------|
| `INIT` | Blue | Harness initialization |
| `STEP` | Green | Task status change |
| `CHANGE` | Yellow | Task modification |
| `REPLAN` | Magenta | Feature replanning |
| `VERIFY` | Magenta | Verification result |

## Examples

### Basic Status

```bash
# Show full status dashboard
agent-foreman status
```

### JSON Output

```bash
# Get status as JSON for scripting
agent-foreman status --json

# Extract specific info with jq
agent-foreman status --json | jq '.completion'
agent-foreman status --json | jq '.nextFeature.id'
```

### Quiet Mode

```bash
# Minimal output for quick checks
agent-foreman status -q
```

## Quick vs Full Operations

The status command uses optimized "quick" operations when a feature index exists:

| Operation | Quick (with index) | Full (without index) |
|-----------|-------------------|---------------------|
| Stats | `getFeatureStatsQuick` | `getFeatureStats` |
| Next Selection | `selectNextFeatureQuick` | `selectNextFeature` |
| Performance | O(1) index lookup | O(n) file loading |

The index file (`ai/tasks/index.json`) enables faster operations by caching:
- Feature statuses
- Priority numbers
- Module assignments

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| "No task list found" | Harness not initialized | Run `agent-foreman init` first |

## Related Commands

- [`init`](./init.md) - Initialize the harness
- [`next`](./next.md) - Get next task details
- [`check`](./check.md) - Verify task implementation
- [`done`](./done.md) - Mark task as complete
