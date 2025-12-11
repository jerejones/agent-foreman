# Workflow for Each Session

## Mode Detection

**If a feature_id is provided** (e.g., `agent-foreman next auth.login`):
- Work on that specific feature only
- Complete it and stop

**If no feature_id** (e.g., `agent-foreman next`):
- Auto-select highest priority pending feature
- Process features in priority order

---

## IMPORTANT: TDD Mode Check

Before implementing ANY feature, check if strict TDD mode is active:
- Look for `!!! TDD ENFORCEMENT ACTIVE !!!` in `agent-foreman next` output
- Or check `ai/feature_list.json` for `"tddMode": "strict"`

**If TDD mode is strict → MUST follow TDD Workflow below**
**If TDD mode is recommended/disabled → May follow Standard Workflow**

---

## TDD Workflow (MANDATORY when tddMode: strict)

**AI agents MUST follow these steps EXACTLY in order. DO NOT skip any step.**

```bash
# STEP 1: Get feature and TDD guidance
agent-foreman next <feature_id>
# Read the TDD GUIDANCE section carefully
# Note the suggested test files and test cases
```

### STEP 2: RED - Write Failing Tests FIRST

**This step is MANDATORY. DO NOT write implementation code yet.**

1. Create test file at the suggested path (e.g., `tests/module/feature.test.ts`)
2. Write test cases for EACH acceptance criterion
3. Run tests to verify they FAIL:
   ```bash
   CI=true <your-test-command>  # e.g., npm test, pnpm test, yarn test, vitest
   ```
4. **Tests MUST fail** - this confirms tests are valid and testing the right thing

Example test structure:
```typescript
describe('feature-name', () => {
  it('should satisfy acceptance criterion 1', () => {
    // Test implementation
    expect(result).toBe(expected);
  });

  it('should satisfy acceptance criterion 2', () => {
    // Test implementation
  });
});
```

### STEP 3: GREEN - Implement Minimum Code

**Only now may you write implementation code.**

1. Write the MINIMUM code needed to pass tests
2. Do not add extra features or optimizations yet
3. Run tests to verify they PASS:
   ```bash
   CI=true <your-test-command>
   ```
4. **All tests MUST pass** before proceeding

### STEP 4: REFACTOR - Clean Up Under Test Protection

1. Improve code structure, naming, readability
2. Remove duplication
3. Run tests after EACH change to ensure they still pass:
   ```bash
   CI=true <your-test-command>
   ```
4. **Tests MUST remain passing** throughout refactoring

### STEP 5: Verify and Complete

```bash
# Verify implementation meets all criteria
agent-foreman check <feature_id>

# If check passes, complete the feature
agent-foreman done <feature_id>
```

---

## Standard Workflow (when tddMode: recommended or disabled)

### Single Feature Mode

When feature_id is provided:

```bash
# STEP 1: Get the specified feature
agent-foreman next <feature_id>

# STEP 2: Implement feature
# (satisfy ALL acceptance criteria shown)

# STEP 3: Verify implementation (required)
agent-foreman check <feature_id>

# STEP 4: Complete feature (skips re-verification since we just checked)
agent-foreman done <feature_id>
```

### All Features Mode

When no feature_id:

```bash
# STEP 1: Check status
agent-foreman status

# STEP 2: Get next feature
agent-foreman next

# STEP 3: Implement feature
# (satisfy ALL acceptance criteria shown)

# STEP 4: Verify implementation (required)
agent-foreman check <feature_id>

# STEP 5: Complete feature (skips re-verification since we just checked)
agent-foreman done <feature_id>

# STEP 6: Handle result
# - Verification passed? → Continue to STEP 1
# - Verification failed? → Mark as failed, continue to STEP 1
# - All features processed? → STOP, show summary
```

---

## Rules (MUST Follow)

| Rule | Action |
|------|--------|
| TDD mode strict? | MUST follow TDD Workflow (RED → GREEN → REFACTOR) |
| No skipping | Always: status → next → implement → check → done |
| One at a time | Complete current before next |
| No editing criteria | Implement exactly as specified |
| Never kill processes | Let commands finish naturally |

---

## On Verification Failure

When `agent-foreman done` reports verification failure:

1. **DO NOT STOP** - Continue to the next feature
2. Mark the failed feature as `failed`:
   - Edit `ai/feature_list.json`
   - Change `"status": "failing"` to `"status": "failed"`
   - Add to notes: `"Verification failed: [reason from output]"`
3. Log the failure in `ai/progress.log`:
   ```
   YYYY-MM-DDTHH:MM:SSZ VERIFY feature=<id> verdict=fail summary="Marked as failed"
   ```
4. Continue to the next feature immediately

**CRITICAL: NEVER stop due to verification failure - always mark as `failed` and continue!**

---

## Exit Conditions

| Condition | Action |
|-----------|--------|
| All features processed | ✅ STOP - Show summary |
| Single feature completed | ✅ STOP - Feature done |
| User interrupts | ⏹️ STOP - Clean state |

---

## Loop Completion

When all features have been processed:

1. Run `agent-foreman status` to show final summary
2. Report counts:
   - ✓ X features passing
   - ⚡ Y features failed (need investigation)
   - ⚠ Z features needs_review (dependency changes)
   - ✗ W features still failing (not attempted)
3. List features that failed verification with their failure reasons

---

## Priority Order (Auto-Selected)

1. `needs_review` → highest priority
2. `failing` → next priority
3. Lower `priority` number within same status
