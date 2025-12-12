# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**agent-foreman** is a Long-Task Harness for AI agents - providing feature-driven development with external memory. It helps AI coding agents avoid common failure modes (doing too much at once, premature completion, superficial testing) by providing structured workflows, acceptance criteria, and verification.

## Commands

```bash
# Development
pnpm dev                          # Run CLI in dev mode (tsx)
pnpm build                        # TypeScript compile + chmod +x
pnpm test                         # Run all tests (vitest run)
pnpm test:watch                   # Watch mode testing
CI=true pnpm test -- tests/file.test.ts  # Run single test file

# CLI Usage (after build or via pnpm dev)
agent-foreman status              # View project status
agent-foreman next [feature_id]   # Get next/specific feature to work on
agent-foreman check <feature_id>  # Verify feature implementation
agent-foreman done <feature_id>   # Mark complete + auto-commit
agent-foreman scan                # Scan project verification capabilities
agent-foreman init [goal]         # Initialize harness

# Binary builds
pnpm build:bin                    # Build standalone binary (current platform)
pnpm build:all                    # Build npm + binary
```

## Architecture

### Core Flow
```
CLI (src/index.ts) → Commands (src/commands/*.ts) → Core Logic
                                                   ↓
                                    Verifier (src/verifier/*.ts)
                                    Capabilities (src/capabilities/*.ts)
                                    AI Agents (src/agents.ts)
```

### Key Modules

- **`src/commands/`**: CLI command handlers (analyze, init, next, status, check, done, scan)
- **`src/verifier/`**: Feature verification system (AI analysis, TDD checks, automated tests)
  - `core.ts`: Main verification orchestration
  - `autonomous.ts`: AI-powered autonomous verification
  - `tdd.ts`: TDD mode verification
  - `check-executor.ts`: Run tests/lint/typecheck/build
- **`src/capabilities/`**: Project capability detection (caches in `ai/capabilities.json`)
  - Uses AI discovery to detect test/lint/typecheck/build commands
  - Two-tier caching: memory → disk → AI discovery
- **`src/agents.ts`**: AI agent subprocess management (Claude, Codex, Gemini)
- **`src/types.ts`**: Core type definitions (Feature, FeatureStatus, FeatureList)
- **`src/feature-list.ts`**: Feature list CRUD operations

### Data Files (generated in target project's `ai/` directory)
- `ai/feature_list.json`: Feature backlog with status tracking
- `ai/progress.log`: Session handoff audit log
- `ai/capabilities.json`: Cached project capabilities
- `ai/init.sh`: Environment bootstrap script

### Plugin System
- `plugins/agent-foreman/`: Claude Code plugin with slash commands and skills
- `.claude-plugin/marketplace.json`: Plugin marketplace registration

## Testing

- Framework: Vitest with `pool: "forks"` for process isolation
- Pattern: `tests/**/*.test.ts`
- Always use `CI=true` when running tests to ensure non-interactive mode
- Test timeout: 30s default, 5s teardown

## Feature Status Values

- `failing`: Not yet implemented
- `passing`: Acceptance criteria met
- `blocked`: External dependency blocking
- `needs_review`: May be affected by changes
- `failed`: Implementation attempted but verification failed
- `deprecated`: No longer needed

## AI Agent Integration

Priority order: Claude > Codex > Gemini (configurable via `AGENT_FOREMAN_AGENTS` env var)

Agents are spawned as subprocesses with full automation flags:
- Claude: `--permission-mode bypassPermissions`
- Codex: `--full-auto`
- Gemini: `--yolo`

## Release Process (Human Only)

```bash
npm version patch && git push origin main --tags
```

Version auto-syncs across `package.json`, `marketplace.json`, and `plugin.json`.
