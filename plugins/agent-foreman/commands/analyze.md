---
description: Analyze existing project structure and generate comprehensive survey report
allowed-tools: Bash, Read, Glob, Grep
argument-hint: [path] [--verbose]
---

# EXECUTE NOW

Run this command immediately:

```bash
agent-foreman analyze
```

Wait for completion. Do not interrupt.

Output: `docs/ARCHITECTURE.md`

## If User Specifies Path

| User Says | Execute |
|-----------|---------|
| Custom path provided | `agent-foreman analyze <path>` |
| "verbose" / "detailed" | `agent-foreman analyze --verbose` |
| (default) | `agent-foreman analyze` |

## After Completion

Report the output location and key findings:
- Tech stack detected
- Directory structure
- Modules discovered
- Completion assessment

**Note:** Read-only operation. No code changes. No commits.
