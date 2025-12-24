# agents Command

Show available AI agents status and priority.

## Command Syntax

```bash
agent-foreman agents
```

## Description

The `agents` command displays the status of available AI agents (Claude, Codex, Gemini) and their priority order for use in analysis, verification, and other AI-powered operations.

## Execution Flow

```mermaid
flowchart TD
    A[Start: agents command] --> B[printAgentStatus]
    B --> C[Check Claude Availability]
    B --> D[Check Codex Availability]
    B --> E[Check Gemini Availability]

    C --> F[Display Status]
    D --> F
    E --> F

    F --> G[Show Priority Order]
    G --> H[End]
```

## Data Flow Diagram

```mermaid
graph TB
    subgraph Detection["Agent Detection"]
        A1[commandExists: claude]
        A2[commandExists: codex]
        A3[commandExists: gemini]
    end

    subgraph Status["Status Check"]
        B1[Check PATH]
        B2[Verify Executable]
        B3[Test Invocation]
    end

    subgraph Output
        C1[Agent List]
        C2[Availability Status]
        C3[Priority Order]
    end

    A1 --> B1
    A2 --> B1
    A3 --> B1

    B1 --> B2
    B2 --> B3

    B3 --> C1
    B3 --> C2
    B3 --> C3
```

## Key Functions

### `printAgentStatus()`

**Location**: `src/agents/orchestrator.ts:127`

Prints the status of all configured AI agents.

**Output**:
- Lists each agent with availability status
- Shows current priority order
- Indicates which agent will be used

### `commandExists(command)`

**Location**: `src/agents/detection.ts:21`

Checks if a command is available in the system PATH.

**Returns**: `boolean`

### `getAvailableAgent()`

**Location**: `src/agents/detection.ts:32`

Gets the first available agent based on priority.

**Returns**: `AgentConfig | null`

### `getAgentPriorityString()`

**Location**: `src/agents/orchestrator.ts:140`

Returns a string representation of agent priority.

**Returns**: `string` (e.g., "claude → codex → gemini")

## Agent Configuration

```typescript
const DEFAULT_AGENTS: AgentConfig[] = [
  {
    name: 'claude',
    command: 'claude',
    priority: 1,
  },
  {
    name: 'codex',
    command: 'codex',
    priority: 2,
  },
  {
    name: 'gemini',
    command: 'gemini',
    priority: 3,
  },
];
```

## Agent Priority Order

```mermaid
graph LR
    A[Agent Selection] --> B{Claude Available?}
    B -->|Yes| C[Use Claude]
    B -->|No| D{Codex Available?}
    D -->|Yes| E[Use Codex]
    D -->|No| F{Gemini Available?}
    F -->|Yes| G[Use Gemini]
    F -->|No| H[Error: No Agent]

    style C fill:#4CAF50
    style E fill:#2196F3
    style G fill:#FF9800
    style H fill:#f44336
```

| Priority | Agent | Command | Description |
|----------|-------|---------|-------------|
| 1 | Claude | `claude` | Anthropic's Claude CLI |
| 2 | Codex | `codex` | OpenAI's Codex CLI |
| 3 | Gemini | `gemini` | Google's Gemini CLI |

## Output Example

```
🤖 AI Agent Status

Available Agents:
  ✓ claude (priority: 1) - ACTIVE
  ✓ codex (priority: 2)
  ✗ gemini (priority: 3) - not found

Priority Order: claude → codex → gemini

Current Agent: claude
```

### All Agents Available

```
🤖 AI Agent Status

Available Agents:
  ✓ claude (priority: 1) - ACTIVE
  ✓ codex (priority: 2)
  ✓ gemini (priority: 3)

Priority Order: claude → codex → gemini

Current Agent: claude
```

### Only Gemini Available

```
🤖 AI Agent Status

Available Agents:
  ✗ claude (priority: 1) - not found
  ✗ codex (priority: 2) - not found
  ✓ gemini (priority: 3) - ACTIVE

Priority Order: claude → codex → gemini

Current Agent: gemini
```

### No Agents Available

```
🤖 AI Agent Status

Available Agents:
  ✗ claude (priority: 1) - not found
  ✗ codex (priority: 2) - not found
  ✗ gemini (priority: 3) - not found

Priority Order: claude → codex → gemini

⚠ No AI agents available!
Install at least one: claude, codex, or gemini
```

## Agent Usage

Agents are used by these commands:

| Command | Agent Usage |
|---------|-------------|
| `init` | Project analysis |
| `init --analyze` | Architecture analysis |
| `check` | AI verification |
| `done` | Verification (when enabled) |

## Examples

### Check Agent Status

```bash
# View all agent status
agent-foreman agents
```

## Installing Agents

### Claude CLI

```bash
# macOS
brew install anthropic/tap/claude

# Other platforms
# Visit: https://claude.ai/download
```

### Codex CLI

```bash
# Via npm
npm install -g @openai/codex
```

### Gemini CLI

```bash
# Via pip
pip install google-generativeai
```

## Agent Selection API

```typescript
// Get first available agent
const agent = getAvailableAgent();
if (agent) {
  console.log(`Using: ${agent.name}`);
}

// Check specific agent
if (commandExists('claude')) {
  // Claude is available
}

// Get all available agents
const agents = filterAvailableAgents(DEFAULT_AGENTS);
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| "No AI agents available" | No CLIs installed | Install claude, codex, or gemini |
| Agent not found | CLI not in PATH | Check installation and PATH |

## Related Commands

- [`init`](./init.md) - Uses agents for analysis
- [`check`](./check.md) - Uses agents for verification
