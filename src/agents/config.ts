/**
 * AI Agent Configuration
 */

import type { AgentConfig } from "./types.js";

/**
 * Default AI agents configuration
 * All agents use highest permission mode for automated scanning without human intervention
 * Priority order: Claude > Codex > Gemini (configurable via AGENT_FOREMAN_AGENTS)
 */
export const DEFAULT_AGENTS: AgentConfig[] = [
  // Claude: --print for non-interactive, --permission-mode bypassPermissions for full access (highest priority)
  // Note: Using --permission-mode bypassPermissions instead of --dangerously-skip-permissions
  // because the latter is blocked when running as root user
  // Note: "-" at the end indicates stdin input (fixes Claude Code v2.0.67+ stdin validation issue)
  {
    name: "claude",
    command: ["claude", "--print", "--output-format", "text", "--permission-mode", "bypassPermissions", "-"],
    promptViaStdin: true,
  },
  // Codex: exec mode with full-auto approval
  {
    name: "codex",
    command: ["codex", "exec", "--skip-git-repo-check", "--full-auto", "-"],
    promptViaStdin: true,
  },
  // Gemini: non-interactive text output with auto-approve all tools (yolo mode)
  {
    name: "gemini",
    command: ["gemini", "--output-format", "text", "--yolo"],
    promptViaStdin: true,
  },
];
