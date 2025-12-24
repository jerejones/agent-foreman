# TDD Mode - Test-Driven Development

## CRITICAL: AI Agent Instructions

**When `tddMode: "strict"` is active, AI agents MUST:**

1. **NEVER write implementation code before tests exist**
2. **ALWAYS create test files FIRST**
3. **ALWAYS verify tests fail before implementing**
4. **ALWAYS verify tests pass after implementing**
5. **NEVER skip the RED → GREEN → REFACTOR cycle**

**Violation of these rules will cause `agent-foreman check` and `agent-foreman done` to FAIL.**

---

## TDD Mode Configuration

The project's TDD enforcement is controlled by `metadata.tddMode` in `ai/tasks/index.json`:

| Mode | Effect | AI Agent Behavior |
|------|--------|-------------------|
| `strict` | Tests REQUIRED | MUST follow TDD workflow exactly |
| `recommended` (default) | Tests suggested | SHOULD follow TDD workflow |
| `disabled` | No TDD guidance | MAY skip tests |

---

## Strict Mode Behavior

When `tddMode: "strict"`:
- `agent-foreman check` **BLOCKS** if test files are missing
- `agent-foreman done` **BLOCKS** if test files are missing
- All features auto-migrate to `testRequirements.unit.required: true`
- TDD workflow is **MANDATORY**, not optional

---

## The TDD Cycle: RED → GREEN → REFACTOR

### Phase 1: RED (Write Failing Tests)

**DO THIS FIRST. No implementation code yet.**

1. Read the acceptance criteria from `agent-foreman next` output
2. Create test file at the suggested path
3. Write one test for each acceptance criterion
4. Run tests: `CI=true <your-test-command>` (e.g., npm test, pnpm test, vitest)
5. **Verify tests FAIL** - this proves tests are checking the right thing

```typescript
// Example: tests/auth/login.test.ts
describe('auth.login', () => {
  it('should authenticate user with valid credentials', () => {
    const result = login('user@example.com', 'password123');
    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
  });

  it('should reject invalid credentials', () => {
    const result = login('user@example.com', 'wrong');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid credentials');
  });
});
```

### Phase 2: GREEN (Make Tests Pass)

**Now write implementation code.**

1. Write the MINIMUM code to make tests pass
2. Do not add extra features
3. Do not optimize prematurely
4. Run tests: `CI=true <your-test-command>`
5. **Verify ALL tests PASS**

### Phase 3: REFACTOR (Improve Code Quality)

**Clean up while tests protect you.**

1. Improve naming, structure, readability
2. Remove duplication
3. Apply design patterns if appropriate
4. Run tests after EACH change: `CI=true <your-test-command>`
5. **Tests MUST remain passing**

---

## Test File Locations

When `agent-foreman next` shows TDD guidance, it suggests test file paths:

```
Suggested Test Files:
   Unit: tests/module/feature.test.ts
   E2E:  e2e/module/feature.spec.ts
```

**ALWAYS use these suggested paths** - they match the patterns in `testRequirements`.

---

## Verification Gates

### Before Implementation

The AI agent MUST verify:
- [ ] Test file exists at suggested path
- [ ] Tests cover ALL acceptance criteria
- [ ] Tests FAIL when run (RED phase complete)

### After Implementation

The AI agent MUST verify:
- [ ] All tests PASS
- [ ] No test was modified to make it pass artificially
- [ ] Implementation satisfies the original acceptance criteria

### Command Verification

```bash
# Check that tests exist and implementation is correct
agent-foreman check <task_id>

# If check passes, complete the task
agent-foreman done <task_id>
```

---

## User Control via Natural Language

| User Says | Action |
|-----------|--------|
| "enable strict TDD" / "require tests" | Set `tddMode: "strict"` |
| "disable strict TDD" / "optional tests" | Set `tddMode: "recommended"` |
| "turn off TDD" | Set `tddMode: "disabled"` |

To change mode manually, edit `ai/tasks/index.json`:
```json
{
  "metadata": {
    "tddMode": "strict",
    ...
  }
}
```

---

## Common Mistakes to Avoid

### WRONG: Implementation First

```
1. Read acceptance criteria
2. Write implementation code  <- WRONG! Tests don't exist yet
3. Write tests that pass
4. Done
```

### CORRECT: Tests First

```
1. Read acceptance criteria
2. Write tests for each criterion
3. Run tests - verify they FAIL
4. Write implementation code
5. Run tests - verify they PASS
6. Refactor if needed
7. Done
```

---

## Why TDD Matters

1. **Tests verify the right behavior** - Writing tests first ensures you understand the requirements
2. **Prevents over-engineering** - You only write code to pass tests
3. **Enables safe refactoring** - Tests catch regressions immediately
4. **Documents behavior** - Tests serve as executable specifications
5. **Catches bugs early** - Failing tests reveal problems before deployment

---

## testRequirements Structure

```json
"testRequirements": {
  "unit": {
    "required": false,
    "pattern": "tests/auth/**/*.test.ts",
    "cases": ["should login", "should logout"]
  },
  "e2e": {
    "required": false,
    "pattern": "e2e/auth/**/*.spec.ts",
    "tags": ["@auth"],
    "scenarios": ["user can login"]
  }
}
```

- `required: true` - Task cannot complete without matching test files (TDD enforcement)
- `pattern` - Glob pattern for selective test execution in quick mode
- `cases`/`scenarios` - Expected test names (optional, for documentation)
