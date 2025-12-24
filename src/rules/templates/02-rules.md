# Rules

1. **One task per session** - Complete or pause cleanly before switching
2. **Don't modify acceptance criteria** - Only change `status` and `notes`
3. **Update status promptly** - Mark tasks passing when criteria met
4. **Leave clean state** - No broken code between sessions
5. **Use single-line log format** - One line per entry, not verbose Markdown
6. **Never kill running processes** - Let `agent-foreman` commands complete naturally, even if they appear slow or timed out. They may be doing important work (verification, git commits, survey regeneration). Just wait for completion.
7. **Use CI=true for tests** - Always set `CI=true` environment variable when running any test commands (e.g., `CI=true npm test`, `CI=true pnpm test`, `CI=true vitest`) to ensure non-interactive mode and consistent behavior.
8. **Strict workflow compliance** - Follow EXACTLY: `next → implement → check → done`. NO skipping steps, NO reordering, NO improvisation. Do not invent alternative workflows or add extra steps.
9. **Use relative paths only** - All file references in generated content (tasks, specs, configs, documentation) MUST use project-relative paths (e.g., `ai/tasks/`, `src/utils/`). NEVER use absolute paths (e.g., `/Users/...`, `/home/...`, `C:\...`). This ensures portability across team members' machines.
10. **CLI-only for workflow** - NEVER read `ai/tasks/` files to determine task status, selection, or workflow decisions. Always use CLI commands (`agent-foreman next`, `agent-foreman status`, etc.).
11. **No manual status edits** - NEVER edit task files to change status. Use `agent-foreman done/fail` commands only.
12. **No file-based shortcuts** - NEVER implement selection algorithm locally by reading index.json. Trust CLI output.
