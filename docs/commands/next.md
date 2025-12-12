# next Command

Show next feature to work on or specific feature details with TDD guidance.

> 显示下一个要处理的功能或特定功能的详情及 TDD 指导。

## Synopsis

```bash
agent-foreman next [feature_id] [options]
```

## Description

The `next` command displays the next feature to implement based on priority order. It provides comprehensive context including git history, progress log, feature statistics, and AI-generated TDD guidance. When a specific feature ID is provided, it shows details for that feature instead of auto-selecting.

> `next` 命令根据优先级顺序显示下一个要实现的功能。它提供全面的上下文，包括 git 历史、进度日志、功能统计和 AI 生成的 TDD 指导。当提供特定功能 ID 时，它会显示该功能的详细信息而不是自动选择。

## Arguments

| Argument | Description |
|----------|-------------|
| `feature_id` | (Optional) Specific feature to display |

## Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--dry-run` | `-d` | `false` | Show plan without changes |
| `--check` | `-c` | `false` | Run basic tests before showing next |
| `--allow-dirty` | - | `false` | Allow running with uncommitted changes |
| `--json` | - | `false` | Output as JSON for scripting |
| `--quiet` | `-q` | `false` | Suppress decorative output |
| `--refresh-guidance` | - | `false` | Force regenerate TDD guidance (ignore cache) |

## Execution Flow

```mermaid
flowchart TD
    Start([Start]) --> CheckDirty{Allow Dirty?}
    CheckDirty -->|No| CheckGitStatus{Git Clean?}
    CheckGitStatus -->|No| DirtyError[Show Error & Exit]
    CheckGitStatus -->|Yes| LoadFeatures
    CheckDirty -->|Yes| LoadFeatures

    LoadFeatures[Load Feature List] --> CheckLoaded{Loaded?}
    CheckLoaded -->|No| NoListError[Show Error & Exit]
    CheckLoaded -->|Yes| SelectFeature

    SelectFeature{Feature ID<br/>Provided?} -->|Yes| FindById[Find Feature by ID]
    SelectFeature -->|No| AutoSelect[selectNextFeature]

    FindById --> CheckFound{Found?}
    CheckFound -->|No| NotFoundError[Show Error & Exit]
    CheckFound -->|Yes| CheckOutputMode
    AutoSelect --> CheckAuto{Any Pending?}
    CheckAuto -->|No| AllComplete[Show All Complete]
    CheckAuto -->|Yes| CheckOutputMode

    AllComplete --> End([End])

    CheckOutputMode{Output Mode?}
    CheckOutputMode -->|JSON| GenerateJSON
    CheckOutputMode -->|Quiet| QuietOutput
    CheckOutputMode -->|Normal| NormalOutput

    subgraph JSON["JSON Output Mode"]
        GenerateJSON[Suppress Console] --> DetectCaps1[Detect Capabilities]
        DetectCaps1 --> GenTDDGuide1[Generate TDD Guidance]
        GenTDDGuide1 --> OutputJSON[Output JSON]
    end

    subgraph Quiet["Quiet Output Mode"]
        QuietOutput[Print Feature ID] --> PrintDesc[Print Description]
        PrintDesc --> PrintAcceptance[Print Acceptance]
    end

    subgraph Normal["Normal Output Mode"]
        NormalOutput[Print Header] --> PrintCWD[Print Current Directory]
        PrintCWD --> PrintGitLog[Print Recent Git Commits]
        PrintGitLog --> PrintProgress[Print Recent Progress]
        PrintProgress --> PrintStats[Print Feature Stats]
        PrintStats --> CheckRunCheck{--check Flag?}
        CheckRunCheck -->|Yes| RunTests[Run ai/init.sh check]
        CheckRunCheck -->|No| DisplayFeature
        RunTests --> DisplayFeature[Display Feature Details]
        DisplayFeature --> GenerateTDD
    end

    subgraph TDDGen["TDD Guidance Generation"]
        GenerateTDD{Cache Valid?} -->|Yes| UseCached[Use Cached Guidance]
        GenerateTDD -->|No| DetectCaps2[Detect Capabilities]
        DetectCaps2 --> TryAIGen[Try AI Generation]
        TryAIGen --> AISuccess{Success?}
        AISuccess -->|Yes| SaveCache[Save to Feature]
        AISuccess -->|No| FallbackRegex[Fallback to Regex]
        SaveCache --> DisplayTDD
        FallbackRegex --> DisplayTDD
        UseCached --> DisplayTDD[Display TDD Guidance]
    end

    OutputJSON --> End
    QuietOutput --> End
    DisplayTDD --> End

    DirtyError --> Exit([Exit 1])
    NoListError --> Exit
    NotFoundError --> Exit
```

## Feature Selection Priority

```mermaid
flowchart TD
    AllFeatures[All Features] --> FilterStatus[Filter by Status]

    FilterStatus --> NeedsReview[needs_review]
    FilterStatus --> Failing[failing]

    NeedsReview --> Sort[Sort by Priority Number]
    Failing --> Sort

    Sort --> |Lower = Higher| Selected[Selected Feature]

    style NeedsReview fill:#ffcc00
    style Failing fill:#ff6666
```

Priority order:
1. **Status first**: `needs_review` > `failing` (other statuses excluded)
2. **Then priority number**: Lower number = higher priority (1 is highest)

## Detailed Step-by-Step Flow

### 1. Clean Working Directory Check
- If not `--allow-dirty`, verify git working directory is clean
- Error if uncommitted changes exist (prevents context confusion)

### 2. Load Feature List
- Load `ai/feature_list.json`
- Validate against schema
- Auto-migrate to strict TDD if enabled

### 3. Feature Selection
**If feature_id provided:**
- Find feature by ID using `findFeatureById()`
- Error if not found

**If no feature_id:**
- Call `selectNextFeature()` to auto-select:
  - Filter features with status `needs_review` or `failing`
  - Sort by status priority, then by priority number

### 4. Output Generation

**JSON Mode (`--json`):**
- Suppress all console output
- Detect capabilities quietly
- Generate TDD guidance
- Output structured JSON object

**Quiet Mode (`--quiet`):**
- Minimal output: ID, description, status, acceptance criteria

**Normal Mode:**
- **External Memory Sync Section:**
  - Current working directory
  - Recent git commits (last 5)
  - Recent progress log entries (last 5)
  - Feature statistics with progress bar
- **Optional Test Check** (if `--check`):
  - Run `ai/init.sh check`
  - Show pass/fail status
- **Feature Details Section:**
  - Feature ID, module, priority, status
  - Description
  - Acceptance criteria
  - Dependencies (if any)
  - Notes (if any)
- **Next Actions:**
  - Show `check` and `done` command examples
- **TDD Guidance Section:**
  - TDD enforcement warning (if strict mode)
  - Suggested test files
  - Test cases with assertions
  - E2E scenarios (if applicable)

### 5. TDD Guidance Generation

```mermaid
flowchart LR
    Check{Cache Valid?} -->|Yes| UseCached[Use Cached]
    Check -->|No| Detect[Detect Capabilities]
    Detect --> AIGen[AI Generation]
    AIGen -->|Success| Save[Save to Feature]
    AIGen -->|Fail| Regex[Regex Fallback]
    Save --> Display
    Regex --> Display
    UseCached --> Display[Display Guidance]
```

Guidance includes:
- Suggested test file paths (unit and E2E)
- Unit test cases with assertions
- E2E scenarios with steps
- Test skeleton preview (for supported frameworks)

## Data Flow Diagram

```mermaid
flowchart LR
    subgraph Input
        FeatureList[ai/feature_list.json]
        GitLog[Git Log]
        ProgressLog[ai/progress.log]
        Capabilities[ai/capabilities.json]
    end

    subgraph Processing
        Selector[Feature Selector]
        TDDGen[TDD Generator]
        Formatter[Output Formatter]
    end

    subgraph Output
        Console[Console Output]
        JSON[JSON Output]
        UpdatedFL[Updated feature_list.json<br/>with TDD guidance]
    end

    FeatureList --> Selector
    Selector --> Formatter

    Capabilities --> TDDGen
    Selector --> TDDGen
    TDDGen --> Formatter
    TDDGen --> UpdatedFL

    GitLog --> Formatter
    ProgressLog --> Formatter

    Formatter --> Console
    Formatter --> JSON
```

## JSON Output Schema

```json
{
  "feature": {
    "id": "string",
    "description": "string",
    "module": "string",
    "priority": "number",
    "status": "string",
    "acceptance": ["string"],
    "dependsOn": ["string"],
    "notes": "string | null"
  },
  "stats": {
    "passing": "number",
    "failing": "number",
    "needsReview": "number",
    "total": "number"
  },
  "completion": "number",
  "cwd": "string",
  "tddGuidance": {
    "suggestedTestFiles": {
      "unit": ["string"],
      "e2e": ["string"]
    },
    "unitTestCases": [{
      "name": "string",
      "assertions": ["string"]
    }],
    "e2eScenarios": [{
      "name": "string",
      "steps": ["string"]
    }]
  }
}
```

## Dependencies

### Internal Modules
- `src/feature-list.ts` - Feature operations
  - `loadFeatureList()`, `saveFeatureList()`
  - `selectNextFeature()`, `findFeatureById()`
  - `getFeatureStats()`, `getCompletionPercentage()`
- `src/progress-log.ts` - Progress tracking
  - `getRecentEntries()`
- `src/capabilities/index.ts` - Capability detection
  - `detectCapabilities()`
- `src/tdd-guidance/index.ts` - TDD guidance generation
  - `generateTDDGuidance()`
- `src/tdd-ai-generator.ts` - AI-powered guidance
  - `generateTDDGuidanceWithAI()`
- `src/git-utils.ts` - Git operations
  - `isGitRepo()`, `hasUncommittedChanges()`

### External Dependencies
- `chalk` - Console output styling
- `child_process` - Git command execution

## Files Read

| File | Purpose |
|------|---------|
| `ai/feature_list.json` | Feature backlog |
| `ai/progress.log` | Recent activity |
| `ai/capabilities.json` | Test framework detection |
| `.git/` | Git status and history |

## Files Written

| File | Purpose |
|------|---------|
| `ai/feature_list.json` | Cache TDD guidance in feature |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (or all features complete) |
| 1 | Working directory not clean / Feature not found / No feature list |

## Examples

### Auto-Select Next Feature
```bash
# Get highest priority pending feature
agent-foreman next
```

### Specific Feature
```bash
# Get details for specific feature
agent-foreman next auth.login
```

### JSON Output for Scripting
```bash
# Output as JSON
agent-foreman next --json | jq '.feature.id'
```

### Allow Dirty Working Directory
```bash
# Bypass clean directory check
agent-foreman next --allow-dirty
```

### Refresh TDD Guidance
```bash
# Force regenerate guidance (ignore cache)
agent-foreman next auth.login --refresh-guidance
```

### Run Tests Before Showing
```bash
# Run basic checks first
agent-foreman next --check
```

## Console Output Example

```
═══════════════════════════════════════════════════════════════
                    EXTERNAL MEMORY SYNC
═══════════════════════════════════════════════════════════════

📁 Current Directory:
   /Users/dev/my-project

📜 Recent Git Commits:
   abc1234 feat(auth): add login endpoint
   def5678 fix(api): handle timeout errors
   ghi9012 docs: update README

📝 Recent Progress:
   2024-01-15 10:30 [STEP] Completed auth.login
   2024-01-15 09:15 [INIT] Initialized harness

📊 Feature Status:
   ✓ Passing: 5 | ✗ Failing: 7 | ⚠ Review: 2 | Blocked: 1
   Progress: [████████░░░░░░░░░░░░░░░░░░░░░░] 33%

═══════════════════════════════════════════════════════════════
                     NEXT TASK
═══════════════════════════════════════════════════════════════

📋 Feature: auth.register
   Module: auth | Priority: 2
   Status: failing

   Description:
   User registration with email verification

   Acceptance Criteria:
   1. User can register with email and password
   2. Validation errors display correctly
   3. Confirmation email is sent

═══════════════════════════════════════════════════════════════
   When done:
     1. Verify:   agent-foreman check auth.register
     2. Complete: agent-foreman done auth.register
═══════════════════════════════════════════════════════════════

!!! TDD ENFORCEMENT ACTIVE !!!
   Tests are REQUIRED for this feature to pass verification.
   The 'check' and 'done' commands will fail without tests.

═══════════════════════════════════════════════════════════════
                    TDD GUIDANCE (REQUIRED)
═══════════════════════════════════════════════════════════════

   (AI-generated by claude)

📝 Suggested Test Files:
   Unit: tests/auth/register.test.ts
   E2E:  e2e/auth/register.spec.ts

📋 Unit Test Cases:
   1. should register user with valid email and password
      → expect user to be created in database
      → expect password to be hashed
   2. should return validation errors for invalid input
      → expect error for invalid email format
      → expect error for weak password
   3. should send confirmation email after registration
      → expect email service to be called
      → expect email to contain verification link

🎭 E2E Scenarios:
   1. user completes registration flow
      → navigate to registration page
      → fill in email and password
      → submit form
      → ... 2 more steps

═══════════════════════════════════════════════════════════════
```

## Related Commands

- `agent-foreman status` - View overall project status
- `agent-foreman check` - Verify feature implementation
- `agent-foreman done` - Mark feature as complete
- `agent-foreman impact` - Analyze feature dependencies
