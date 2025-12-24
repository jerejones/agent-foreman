# Modular Task/Feature Storage

Agent-foreman uses a modular markdown-based storage system where each task/feature is stored in its own file.

## Directory Structure

```
ai/tasks/
├── index.json              # Lightweight index for quick lookups
├── auth/                   # Module directory
│   ├── login.md           # Task: auth.login
│   └── logout.md          # Task: auth.logout
├── chat/
│   └── message.edit.md    # Task: chat.message.edit
└── ...
```

## Index Format (`ai/tasks/index.json`)

```json
{
  "version": "2.0.0",
  "updatedAt": "2024-01-15T10:00:00Z",
  "metadata": {
    "projectGoal": "Project goal description",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z",
    "version": "1.0.0",
    "tddMode": "recommended"
  },
  "features": {
    "auth.login": {
      "status": "passing",
      "priority": 1,
      "module": "auth",
      "description": "User can log in"
    },
    "core.project-init": {
      "status": "passing",
      "priority": 1,
      "module": "core",
      "description": "Initialize project structure",
      "filePath": "core/01-project-init.md"
    }
  }
}
```

**Index Entry Fields**:
- `status` (required): Current task status
- `priority` (required): Priority number (1 = highest)
- `module` (required): Parent module name
- `description` (required): Human-readable description
- `filePath` (optional): Explicit file path when filename doesn't follow ID convention

**Note**: By default, file paths are derived from task IDs (e.g., `auth.login` → `auth/login.md`). Use `filePath` when the actual filename differs (e.g., numbered prefixes like `01-project-init.md`).

## Task/Feature Markdown Format

Each task/feature is stored as a markdown file with YAML frontmatter:

**Priority**: Determines `agent-foreman next` selection order. Lower number = selected first.

```yaml
---
id: module.task-name
module: module-name
priority: N  # Lower number = higher priority (1 is highest)
status: failing
version: 1
origin: manual
dependsOn: []
supersedes: []
tags:
  - tag-name
---
# Human-readable description

## Acceptance Criteria

1. First acceptance criterion
2. Second acceptance criterion
3. Third acceptance criterion
```

## Task/Feature ID Convention

Task/Feature IDs use dot notation: `module.submodule.action`

Examples:
- `auth.login`
- `chat.message.edit`
- `api.users.create`

## Acceptance Criteria Format

Write criteria as testable statements:
- "User can submit the form and see a success message"
- "API returns 201 status with created resource"
- "Error message displays when validation fails"

## Field Reference

### Required Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique task identifier (e.g., `auth.login`) |
| `module` | string | Parent module name |
| `priority` | integer | Priority level (lower = higher priority, 0 is highest) |
| `status` | string | Current task status |
| `version` | integer | Version number (starts at 1) |
| `origin` | string | How this task was created |

### Markdown Content (Not Frontmatter)

| Content | Location | Description |
|---------|----------|-------------|
| Description | H1 heading (`# ...`) | Human-readable task description |
| Acceptance Criteria | Numbered list under `## Acceptance Criteria` | Testable success conditions |
| Notes | Text under `## Notes` | Additional context |

### Optional Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `dependsOn` | string[] | Task IDs this task depends on |
| `supersedes` | string[] | Task IDs this task replaces |
| `tags` | string[] | Categorization tags |
| `testRequirements` | object | Test requirements for TDD workflow |
| `e2eTags` | string[] | Playwright tags for E2E filtering |
| `verification` | object | Last verification result |
| `taskType` | string | Task type: `code`, `ops`, `data`, `infra`, `manual` |
| `verificationStrategies` | array | UVS verification strategies |

### Status Values

`failing` | `passing` | `blocked` | `needs_review` | `failed` | `deprecated`

### Origin Values

`init-auto` | `init-from-routes` | `init-from-tests` | `manual` | `replan`
