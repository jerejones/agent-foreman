# Commands

```bash
# View project status
agent-foreman status

# Work on next priority feature
agent-foreman next

# Work on specific feature
agent-foreman next <feature_id>

# Fast check (default, no task_id): Git diff → selective tests + task impact
agent-foreman check

# Fast check with AI verification for affected tasks
agent-foreman check --ai

# Full check (all tests + build + E2E): Auto-selects next task
agent-foreman check --full

# Task-specific verification (no AI by default)
agent-foreman check <task_id>
# → Runs: typecheck + lint + tests + build
# → Skips: AI analysis (use --ai to enable)

# Task-specific verification with AI exploration
agent-foreman check <task_id> --ai
# → Full checks + AI autonomous exploration

# Mark feature as done (skips verification by default, use after check)
agent-foreman done <feature_id>

# Mark feature as done (with verification, for manual use)
agent-foreman done <feature_id> --no-skip-check

# Mark feature as done with AI verification
agent-foreman done <feature_id> --no-skip-check --ai

# Full mode - run all tests (slower, for final verification)
agent-foreman done <feature_id> --full --no-skip-check

# Skip E2E tests (faster iterations)
agent-foreman done <feature_id> --skip-e2e

# Skip auto-commit (manual commit)
agent-foreman done <feature_id> --no-commit

# Disable loop mode (no continuation reminder)
agent-foreman done <feature_id> --no-loop

# Mark feature as failed (for verification failures, continue to next)
agent-foreman fail <feature_id> --reason "Reason for failure"

# Analyze impact of changes
agent-foreman impact <feature_id>

# Scan project verification capabilities
agent-foreman scan

# View or change TDD mode
agent-foreman tdd                    # Show current mode
agent-foreman tdd strict             # Enable strict TDD
agent-foreman tdd recommended        # Enable recommended TDD (default)
agent-foreman tdd disabled           # Disable TDD guidance

# Bootstrap/development/testing (init.sh)
./ai/init.sh bootstrap              # Install dependencies
./ai/init.sh dev                    # Start dev server
./ai/init.sh check                  # Run all checks (tests, types, lint, build, e2e)
./ai/init.sh check --quick          # Quick mode: unit tests + E2E by tags only
./ai/init.sh check --full           # Full mode: all tests including full E2E suite
./ai/init.sh check --skip-e2e       # Skip E2E tests entirely
./ai/init.sh check "pattern"        # Run tests matching pattern
```
