# impact Command

Analyze the impact of changes to a task/feature on other tasks.

## Command Syntax

```bash
agent-foreman impact <feature_id>
```

## Description

The `impact` command analyzes how changes to a specific task might affect other tasks in the project. It identifies directly dependent tasks and tasks in the same module that may need review.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `feature_id` | string | Yes | Task ID to analyze impact for |

## Execution Flow

```mermaid
flowchart TD
    A[Start: runImpact] --> B[Load Feature List]
    B --> C{Feature List Exists?}
    C -->|No| D[Exit: No task list]
    C -->|Yes| E[Find Feature by ID]

    E --> F{Feature Found?}
    F -->|No| G[Exit: Task not found]
    F -->|Yes| H[Analyze Dependencies]

    H --> I[Find Dependent Tasks]
    H --> J[Find Same-Module Tasks]

    I --> K[dependents array]
    J --> L[sameModule array]

    K --> M[Display Impact Analysis]
    L --> M

    M --> N{Has Affected Tasks?}
    N -->|Yes| O[Display Recommendations]
    N -->|No| P[Display: No affected tasks]

    O --> Q[End]
    P --> Q
```

## Data Flow Diagram

```mermaid
graph TB
    subgraph Input
        A1[feature_id]
        A2[Working Directory]
    end

    subgraph DataLoad["Data Loading"]
        B1[loadFeatureList]
        B2[findFeatureById]
    end

    subgraph Analysis["Impact Analysis"]
        C1[Find Dependents]
        C2[Find Same Module]
        C3[Filter Active Tasks]
    end

    subgraph DependentSearch["Dependent Task Search"]
        D1[Iterate All Features]
        D2[Check dependsOn Array]
        D3[Match feature_id]
    end

    subgraph ModuleSearch["Same Module Search"]
        E1[Get Feature Module]
        E2[Filter by Module]
        E3[Exclude Current Feature]
        E4[Exclude Deprecated]
    end

    subgraph Output
        F1[Directly Affected Tasks]
        F2[Same-Module Tasks]
        F3[Recommendations]
    end

    A1 --> B1
    A2 --> B1
    B1 --> B2

    B2 --> C1
    B2 --> C2

    C1 --> D1
    D1 --> D2
    D2 --> D3
    D3 --> F1

    C2 --> E1
    E1 --> E2
    E2 --> E3
    E3 --> E4
    E4 --> F2

    F1 --> F3
    F2 --> F3
```

## Key Functions

### `runImpact(featureId)`

**Location**: `src/commands/impact.ts:12`

Main entry point for the impact command.

**Process**:
1. Loads the feature list
2. Finds the specified feature
3. Identifies all features that depend on this one
4. Identifies all features in the same module
5. Displays impact analysis with recommendations

## Dependency Analysis

The command identifies two types of related tasks:

### Directly Affected Tasks

Tasks that explicitly list the analyzed feature in their `dependsOn` array.

```mermaid
graph LR
    A[auth.login] --> B[dashboard.home]
    A --> C[profile.settings]
    A --> D[admin.users]

    style A fill:#f9f,stroke:#333
    style B fill:#bbf,stroke:#333
    style C fill:#bbf,stroke:#333
    style D fill:#bbf,stroke:#333
```

**Example**: If `auth.login` is modified, any task with `dependsOn: ["auth.login"]` is directly affected.

### Same-Module Tasks

Tasks in the same module that might be affected by shared code or patterns.

```mermaid
graph TB
    subgraph AuthModule["Module: auth"]
        A[auth.login]
        B[auth.logout]
        C[auth.register]
        D[auth.password-reset]
    end

    A -.->|same module| B
    A -.->|same module| C
    A -.->|same module| D

    style A fill:#f9f,stroke:#333
```

## Output Example

```
🔍 Impact Analysis: auth.login

   ⚠ Directly Affected Tasks:
   → dashboard.home (failing) - depends on this task
   → profile.settings (passing) - depends on this task
   → admin.users (needs_review) - depends on this task

   📁 Same Module (review recommended):
   → auth.logout (passing)
   → auth.register (failing)
   → auth.password-reset (blocked)
   → auth.session-refresh (failing)
   ... and 2 more

   💡 Recommendations:
   1. Review and test dependent tasks (highest priority)
   2. Mark uncertain dependent tasks as 'needs_review'
   3. Consider reviewing same-module tasks for side effects
   4. Update task notes with impact details
   5. Run 'agent-foreman check <task_id>' to verify affected tasks
```

## Recommendations Logic

Recommendations are generated based on findings:

| Condition | Recommendation |
|-----------|----------------|
| Has dependents | Review and test dependent tasks (highest priority) |
| Has dependents | Mark uncertain dependent tasks as 'needs_review' |
| Has same-module | Consider reviewing same-module tasks for side effects |
| Any affected | Update task notes with impact details |
| Any affected | Run `agent-foreman check` to verify affected tasks |

## Use Cases

### Before Making Changes

```bash
# Check what might be affected before modifying
agent-foreman impact auth.login
```

### After Completing a Task

```bash
# Identify tasks that might need review
agent-foreman done auth.login
agent-foreman impact auth.login
# Review/update dependent tasks
```

### During Refactoring

```bash
# Understand full impact of refactoring
agent-foreman impact core.utils
```

## Integration with Other Commands

### Workflow Example

```mermaid
flowchart TD
    A[Complete Task] --> B[Run Impact Analysis]
    B --> C{Has Affected Tasks?}
    C -->|Yes| D[Mark as needs_review]
    C -->|No| E[Continue to Next Task]

    D --> F[For Each Affected]
    F --> G[agent-foreman check]
    G --> H{Passes?}
    H -->|Yes| I[Mark as passing]
    H -->|No| J[Fix Issues]
    J --> G
    I --> E
```

## Limitations

1. **Static Analysis Only**: Does not analyze actual code dependencies
2. **Explicit Dependencies**: Only finds tasks with `dependsOn` declarations
3. **Module Heuristic**: Same-module analysis is a heuristic, not guarantee
4. **No Transitive Dependencies**: Does not trace chains of dependencies

## Best Practices

1. **Declare Dependencies**: Use `dependsOn` in feature definitions
2. **Module Organization**: Group related features in modules
3. **Regular Impact Checks**: Run after significant changes
4. **Update Status**: Mark affected tasks as `needs_review`

## Related Commands

- [`check`](./check.md) - Verify affected tasks
- [`done`](./done.md) - Complete tasks
- [`status`](./status.md) - View all task statuses
