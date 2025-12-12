---
name: feature-run
description: Executes unattended batch processing of all pending features with autonomous decision-making. Use when running all features automatically, batch processing without supervision, completing entire feature backlog, or working on a specific feature by ID. Triggers on 'run all features', 'complete all features', 'batch processing', 'unattended mode', 'auto-complete features', 'run feature'.
---

# Feature Run

**Mode**: Work on all features or a specific one

⚡ **UNATTENDED MODE** (when no feature_id provided)
- NO questions allowed
- NO stopping for errors
- MUST complete all features

## Mode Detection

**If feature_id provided** (e.g., `feature-run auth.login`):
- Work on that specific feature only
- Complete it and stop

**If no feature_id** (e.g., `feature-run`):
- Auto-complete all pending features
- Loop until all done
- **UNATTENDED MODE ACTIVE** - see rules below

---

## Single Feature Mode

When feature_id is provided:

```bash
# STEP 1: Get the specified feature
agent-foreman next <feature_id>

# STEP 2: Implement (satisfy ALL acceptance criteria)
# ... write code ...

# STEP 3: Verify implementation
agent-foreman check <feature_id>

# STEP 4: Mark complete + commit
agent-foreman done <feature_id>
```

---

## All Features Mode

When no feature_id:

```bash
# STEP 1: Check remaining features
agent-foreman status

# STEP 2: Get next priority feature
agent-foreman next

# STEP 3: Implement (satisfy ALL acceptance criteria)
# ... write code ...

# STEP 4: Verify implementation
agent-foreman check <feature_id>

# STEP 5: Mark complete + commit
agent-foreman done <feature_id>

# STEP 6: Handle result
# - Verification passed? → Continue to STEP 1
# - Verification failed? → Run 'agent-foreman fail <feature_id> -r "reason"', continue to STEP 1
# - All features processed? → DONE (show summary)
```

---

## Rules

| Rule | Description |
|------|-------------|
| One at a time | Complete current before next |
| No skipping | Always status → next → implement → check → done |
| No editing criteria | Implement as specified |
| Never kill processes | Let commands finish naturally |

## Priority Order

1. `needs_review` → may be broken (highest)
2. `failing` → not implemented
3. Lower `priority` number

---

## Check TDD Mode First

Look for "!!! TDD ENFORCEMENT ACTIVE !!!" in `agent-foreman next` output.

### TDD Workflow (when strict mode active)

```bash
# STEP 1: Get feature + TDD guidance
agent-foreman next <feature_id>

# STEP 2: RED - Write failing tests FIRST
# Create test file at suggested path
# Run tests: <your-test-command>
# Verify tests FAIL (confirms tests are valid)

# STEP 3: GREEN - Implement minimum code
# Write minimum code to pass tests
# Run tests: <your-test-command>
# Verify tests PASS

# STEP 4: REFACTOR - Clean up
# Clean up code while keeping tests passing

# STEP 5: Verify + Complete
agent-foreman check <feature_id>
agent-foreman done <feature_id>
```

**CRITICAL: DO NOT write implementation code before tests exist in strict TDD mode!**

---

## NO QUESTIONS ALLOWED (CRITICAL)

When in ALL-FEATURES mode (no feature_id provided):

⛔ **NEVER ASK THE USER ANY QUESTIONS**

| Situation | Action |
|-----------|--------|
| Ambiguous requirement | Make a reasonable decision, proceed |
| Missing file or dependency | Create it or skip, proceed |
| Multiple implementation options | Choose the simplest, proceed |
| Unclear acceptance criteria | Interpret literally, proceed |
| Test failure | Note it, proceed |
| Verification failure | Run `agent-foreman fail <id> -r "reason"`, continue |
| Any unexpected error | Log it, continue to next |

**Forbidden phrases** - NEVER output:
- "Should I...?"
- "Do you want me to...?"
- "Which approach would you prefer?"
- "I need clarification on..."
- "Before I proceed, could you..."

**Required behavior**:
- ALWAYS make autonomous decisions
- ALWAYS continue to the next feature
- ONLY stop when status shows 0 pending features

---

## Loop Enforcement (MUST FOLLOW)

When in ALL-FEATURES mode:

1. **CHECK**: Run `agent-foreman status` - note pending count
2. **LOOP**: While pending count > 0:
   a. Run `agent-foreman next` - get feature details
   b. Implement feature - satisfy ALL criteria
   c. Run `agent-foreman check <id>` - verify
   d. Run `agent-foreman done <id>` - complete
   e. Handle result:
      - Pass? → Continue to step 2
      - Fail? → Run `agent-foreman fail <id> -r "reason"`, continue to step 2
3. **EXIT**: Only when pending count = 0

### Never Stop For:
- Questions
- Errors
- Failures
- Ambiguity
- Missing files
- Test failures

### Only Stop When:
- `agent-foreman status` shows 0 features with `failing` or `needs_review` status

---

## On Verification Failure

When `agent-foreman done` reports verification failure:

1. **DO NOT STOP** - This is the most critical rule
2. **DO NOT ASK** - Never ask user what to do
3. Mark the failed feature using the fail command:
   ```bash
   agent-foreman fail <feature_id> --reason "Brief description of failure"
   ```
4. **IMMEDIATELY** run `agent-foreman next` for the next feature
5. Continue the loop - DO NOT pause, reflect, or ask for guidance

**This applies to ALL errors, not just verification failures.**

---

## Exit When

| Condition | Action |
|-----------|--------|
| All features processed | STOP - Show summary |
| Single feature completed | STOP - Feature done |
| User interrupts | STOP - Clean state |

**CRITICAL: NEVER stop due to verification failure - always use `agent-foreman fail` and continue!**

## Loop Completion

When all features have been processed:

1. Run `agent-foreman status` to show final summary
2. Report counts:
   - X features passing
   - Y features failed (need investigation)
   - Z features needs_review (dependency changes)
   - W features still failing (not attempted)
3. List features that failed verification with their failure reasons
