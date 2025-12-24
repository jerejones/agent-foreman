---
description: Scan codebase and generate ARCHITECTURE.md documentation
allowed-tools: Bash, Read, Glob, Grep, Skill
argument-hint: "[path] [--verbose]"
---

# STEP 0: INVOKE SKILL (MANDATORY)

**BEFORE doing anything else, you MUST invoke the `project-analyze` skill:**

```
Skill({ skill: "project-analyze" })
```

The instructions below are a fallback only if the skill fails to load.

---

# FALLBACK: EXECUTE NOW

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
