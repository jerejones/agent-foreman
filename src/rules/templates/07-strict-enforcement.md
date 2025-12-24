<!-- CONTEXT-CRITICAL: Preserve on compression -->
# Strict Workflow Enforcement (MANDATORY)

## ⚠️ CONTEXT COMPRESSION SURVIVAL

**When context is compressed, these rules MUST be preserved:**
1. Workflow sequence: `next → implement → check → done`
2. CLI-only mandate for workflow operations
3. Prohibition on direct file reading for workflow decisions

---

## ABSOLUTE PROHIBITIONS

### 1. NO Direct File Reading for Workflow Decisions

**FORBIDDEN:**
- Reading `ai/tasks/index.json` to determine next task
- Reading `ai/tasks/index.json` to check project status
- Reading `ai/tasks/index.json` to check TDD mode
- Reading task `.md` files to get task status
- Parsing files to implement selection algorithm locally

**ALLOWED:**
- Reading task `.md` files for implementation context (acceptance criteria) AFTER running `agent-foreman next`

**REQUIRED:**
- Use `agent-foreman next` to get next task
- Use `agent-foreman status` to check project status
- Use `agent-foreman check <task_id>` for verification
- Use `agent-foreman done <task_id>` for completion

### 2. NO Manual File Editing for Status Changes

**FORBIDDEN:**
- Editing task `.md` files to change `status` field
- Editing `index.json` directly for any reason
- Any file editing as alternative to CLI commands

**REQUIRED:**
- Use `agent-foreman done <task_id>` for passing
- Use `agent-foreman fail <task_id> --reason "..."` for failures

### 3. NO Local Algorithm Implementation

**FORBIDDEN:**
- Implementing task selection algorithm by reading files
- Calculating priority order from file contents
- Determining TDD mode by reading metadata files

**REQUIRED:**
- Trust CLI output for ALL workflow decisions
- Read TDD guidance from `agent-foreman next` output ONLY

---

## WHY THESE RULES EXIST

| Reason | Explanation |
|--------|-------------|
| Audit trail | CLI commands log progress automatically |
| State sync | CLI keeps index and files consistent |
| Verification | CLI runs tests, lint, build checks |
| Orchestration | Multiple agents can coordinate via CLI |

---

## VIOLATION CONSEQUENCES

If agent bypasses CLI:
- Task state becomes inconsistent
- Verification gates are skipped
- Audit trail is broken
- Other agents may conflict
- **Task will NOT be properly completed**
