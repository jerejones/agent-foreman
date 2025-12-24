# init Command

Initialize or upgrade the long-task harness for AI-driven development.

## Command Syntax

```bash
agent-foreman init [goal] [options]
```

## Description

The `init` command sets up the agent-foreman harness in a project. It performs AI-powered project analysis, generates a task list, and creates the necessary infrastructure files for task-driven development.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `goal` | string | No | Project goal description. Auto-detected from package.json or README if not provided |

## Options

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--mode` | `-m` | string | `merge` | Init mode: `merge`, `new`, or `scan` |
| `--task-type` | `-t` | string | - | Default verification type: `code`, `ops`, `data`, `infra`, `manual` |
| `--verbose` | `-v` | boolean | `false` | Show detailed output |

### Init Modes

- **merge**: Combines AI-detected features with existing features (default)
- **new**: Creates a fresh feature list from AI analysis, discarding existing
- **scan**: Only scans project capabilities without generating features

### Task Types

- **code**: Software development tasks (unit tests, build verification)
- **ops**: Operational tasks (manual checklist verification)
- **data**: Data processing tasks (output validation)
- **infra**: Infrastructure tasks (resource state checks)
- **manual**: Manual verification only (no automation)

## Execution Flow

```mermaid
flowchart TD
    A[Start: runInit] --> B{Is Git Repository?}
    B -->|No| C[Initialize Git Repository]
    C --> D{Git Init Success?}
    D -->|No| E[Exit with Error]
    D -->|Yes| F[Continue]
    B -->|Yes| F

    F --> G[Detect and Analyze Project]
    G --> H[AI Agent Analysis]
    H --> I{Analysis Success?}
    I -->|No| J[Exit: AI analysis failed]
    I -->|Yes| K[Display Analysis Results]

    K --> L{Mode = scan?}
    L -->|Yes| M[Skip TDD Prompt]
    L -->|No| N[Prompt TDD Mode Selection]
    N --> O[10s Timeout with Default]
    O --> P[User Selection or Default]
    M --> Q[Merge or Create Features]
    P --> Q

    Q --> R[Apply Task Type if Specified]
    R --> S[Save Feature List]
    S --> T[Generate Harness Files]
    T --> U[Create init.sh]
    T --> V[Create .claude/rules]
    T --> W[Create progress.log]
    T --> X[Create ai/tasks/ structure]

    U --> Y[Display Success Message]
    V --> Y
    W --> Y
    X --> Y

    Y --> Z{TDD Mode = strict?}
    Z -->|Yes| AA[Display TDD Warning]
    Z -->|No| AB[Display Next Steps]
    AA --> AB
    AB --> AC[End]
```

## Data Flow Diagram

```mermaid
graph LR
    subgraph Input
        A1[Project Directory]
        A2[Goal Parameter]
        A3[Mode Option]
        A4[Task Type Option]
    end

    subgraph AI_Analysis["AI Analysis Phase"]
        B1[detectAndAnalyzeProject]
        B2[Claude/Codex/Gemini Agent]
        B3[ProjectSurvey Result]
    end

    subgraph TDD_Config["TDD Configuration"]
        C1[promptTDDMode]
        C2[User Input or Timeout]
        C3[TDDMode Selection]
    end

    subgraph Feature_Generation["Feature Generation"]
        D1[mergeOrCreateFeatures]
        D2[Existing Features]
        D3[AI-Detected Features]
        D4[Merged FeatureList]
    end

    subgraph File_Generation["File Generation"]
        E1[generateHarnessFiles]
        E2[ai/tasks/index.json]
        E3[ai/tasks/module/*.md]
        E4[ai/init.sh]
        E5[ai/progress.log]
        E6[.claude/rules/]
    end

    A1 --> B1
    A2 --> B1
    B1 --> B2
    B2 --> B3

    A3 --> C1
    C1 --> C2
    C2 --> C3

    B3 --> D1
    A3 --> D1
    D2 --> D1
    D3 --> D1
    C3 --> D1
    D1 --> D4

    A4 --> D4
    D4 --> E1
    E1 --> E2
    E1 --> E3
    E1 --> E4
    E1 --> E5
    E1 --> E6
```

## Key Functions

### `runInit(goal, mode, verbose, taskType?, options?)`

**Location**: `src/commands/init.ts:201`

Main entry point for the init command.

**Parameters**:
- `goal: string` - Project goal description
- `mode: InitMode` - Init mode (merge/new/scan)
- `verbose: boolean` - Enable verbose output
- `taskType?: TaskType` - Optional default task type
- `options?: InitOptions` - Optional analyze/scan mode options

**Process**:
1. Verify/initialize git repository
2. Run AI project analysis
3. Prompt for TDD mode (interactive with 10s timeout)
4. Generate/merge features based on mode
5. Apply task type to all features
6. Generate harness infrastructure files

### `promptTDDMode()`

**Location**: `src/commands/init.ts:41`

Interactive TDD mode selection with timeout.

**Returns**: `Promise<TDDMode | undefined>`

**Options**:
- `[1] Strict` - Tests REQUIRED before marking tasks done
- `[2] Recommended` - Tests suggested but optional (default)
- `[3] Disabled` - No TDD guidance or enforcement

**Timeout**: 10 seconds, defaults to "recommended"

### `detectAndAnalyzeProject(cwd, goal, verbose)`

**Location**: `src/init/index.ts`

AI-powered project analysis using Claude, Codex, or Gemini.

**Returns**: `{ success: boolean, survey?: ProjectSurvey, agentUsed?: string, error?: string }`

### `mergeOrCreateFeatures(cwd, survey, goal, mode, verbose, tddMode)`

**Location**: `src/init/index.ts`

Generates or merges feature list based on mode.

**Returns**: `FeatureList`

### `generateHarnessFiles(cwd, survey, featureList, goal, mode)`

**Location**: `src/init/index.ts`

Creates all harness infrastructure files.

## Output Files

| File | Purpose |
|------|---------|
| `ai/tasks/index.json` | Lightweight task index for quick lookups |
| `ai/tasks/{module}/{id}.md` | Individual task definitions in Markdown |
| `ai/init.sh` | Bootstrap script with check/dev/bootstrap modes |
| `ai/progress.log` | Session handoff audit log |
| `.claude/rules/` | Rule files for Claude Code integration |

## Examples

### Basic Initialization

```bash
# Auto-detect goal and merge with existing features
agent-foreman init

# Specify goal explicitly
agent-foreman init "Build a REST API for user management"

# Start fresh with new feature list
agent-foreman init --mode new

# Only scan capabilities
agent-foreman init --mode scan
```

### With Task Type

```bash
# Initialize for infrastructure project
agent-foreman init "Deploy Kubernetes cluster" --task-type infra

# Initialize for operational tasks
agent-foreman init "Set up monitoring" --task-type ops
```

### Verbose Output

```bash
agent-foreman init -v
```

## TDD Mode Behavior

### Strict Mode

When TDD mode is set to `strict`:
- All features require tests to pass verification
- `agent-foreman check` and `done` commands will fail without test files
- TDD workflow guidance is displayed prominently
- Features auto-migrate to `testRequirements.unit.required: true`

### Recommended Mode (Default)

- TDD guidance is shown but not enforced
- Tests are suggested but optional
- Verification succeeds even without test files

### Disabled Mode

- No TDD guidance displayed
- Useful for legacy projects or non-code tasks

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| "AI analysis failed" | No AI agent available | Install gemini, codex, or claude CLI |
| "Failed to initialize git" | Git not installed or permission issue | Install git or check permissions |

## Related Commands

- [`next`](./next.md) - Get next task to work on
- [`status`](./status.md) - View project status
- [`agents`](./agents.md) - Show AI agent status

**Note**: `scan` and `analyze` are flags of the `init` command:
- `agent-foreman init --scan` - Scan project capabilities
- `agent-foreman init --analyze` - Generate architecture analysis
