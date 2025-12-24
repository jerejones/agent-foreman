/**
 * Script Strategy Constants
 */

/** Default timeout for script execution (60 seconds) */
export const DEFAULT_TIMEOUT = 60000;

/** Dangerous command patterns that should be blocked for security */
export const DANGEROUS_PATTERNS = [
  /rm\s+(-rf?|--recursive)\s+[\/~]/i, // rm -rf with absolute paths
  /rm\s+(-rf?|--recursive)\s+\.\./i, // rm -rf with parent directory
  />\s*\/dev\/sd[a-z]/i, // Writing to block devices
  /mkfs\./i, // Filesystem formatting
  /dd\s+.*of\s*=\s*\/dev/i, // dd to devices
  /:\s*\(\)\s*\{\s*:\|\:/i, // Fork bomb pattern
  /wget\s+.*\|\s*(bash|sh|zsh)/i, // Download and pipe to shell
  /curl\s+.*\|\s*(bash|sh|zsh)/i, // Download and pipe to shell
  /eval\s+\$\(/i, // Eval with command substitution
  /chmod\s+777\s+\//i, // chmod 777 on root paths
  /chown\s+.*\s+\//i, // chown on root paths
];

/** Shell injection patterns to check in arguments */
export const SHELL_INJECTION_PATTERNS = [
  /\|\s*(bash|sh|zsh|ksh|csh)/i, // Pipe to shell
  /;\s*(rm|chmod|chown|mkfs|dd)/i, // Command chaining with dangerous commands
  /`[^`]*`/, // Backtick command substitution
  /\$\([^)]+\)/, // $() command substitution
];
